import { createIcons, icons } from "lucide";
import "./styles.css";

import { captureCleanShot, captureFullPageShot, copyCleanShot } from "./capture";
import {
  addressForm,
  addressInput,
  addressLockButton,
  assertElement,
  backButton,
  captureButton,
  closeButton,
  forwardButton,
  fullPageButton,
  maximizeButton,
  minimizeButton,
  presetButtons,
  reloadButton,
  sizeChips,
  sizeCustomForm,
  sizeHInput,
  sizeMenu,
  sizePopover,
  sizeToggle,
  sizeWInput
} from "./dom";
import { applyPreset, applySize, goBack, goForward, navigate, reload, setCustomAddress } from "./navigation";
import { appWindow, electronBridge, HOME_URL } from "./runtime";
import { state } from "./state";
import { applyAppearanceSettings, loadAppearanceSettings } from "./theme";
import { layoutBrowser } from "./ui";

// ---------- Boot ----------

createIcons({ icons });
applyAppearanceSettings(loadAppearanceSettings());

if (electronBridge) {
  void electronBridge.getSettings().then((settings) => {
    applyAppearanceSettings(settings);
    window.requestAnimationFrame(() => void layoutBrowser(false));
  });
}

// ---------- Address bar ----------

addressForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  // In custom-address mode the bar is display-only — keep the text, don't navigate.
  if (state.addressOverride !== null) {
    assertElement(addressInput, "address input").blur();
    return;
  }
  void navigate(assertElement(addressInput, "address input").value);
});

addressInput?.addEventListener("input", () => {
  if (state.addressOverride !== null) {
    state.addressOverride = assertElement(addressInput, "address input").value;
  }
});

addressLockButton?.addEventListener("click", () => setCustomAddress(state.addressOverride === null));

// ---------- Toolbar buttons ----------

backButton?.addEventListener("click", () => void goBack());
forwardButton?.addEventListener("click", () => void goForward());
reloadButton?.addEventListener("click", () => void reload());
captureButton?.addEventListener("click", () => void captureCleanShot());
fullPageButton?.addEventListener("click", () => void captureFullPageShot());

closeButton?.addEventListener("click", () => {
  if (electronBridge) {
    void electronBridge.closeWindow();
  } else {
    void appWindow?.close();
  }
});
minimizeButton?.addEventListener("click", () => {
  if (electronBridge) {
    void electronBridge.minimizeWindow();
  } else {
    void appWindow?.minimize();
  }
});
maximizeButton?.addEventListener("click", () => {
  if (electronBridge) {
    void electronBridge.toggleMaximize();
  } else {
    void appWindow?.toggleMaximize();
  }
});

for (const button of presetButtons) {
  button.addEventListener("click", () => {
    const preset = button.dataset.preset;
    if (preset) {
      for (const other of presetButtons) {
        other.classList.toggle("is-active", other === button);
      }
      void applyPreset(preset);
    }
  });
}

// ---------- Size & aspect popover ----------

function setSizePopover(open: boolean): void {
  if (!sizePopover || !sizeToggle) {
    return;
  }
  sizePopover.hidden = !open;
  sizeToggle.setAttribute("aria-expanded", String(open));

  // Seed the custom inputs with the current window size when opening.
  if (open && sizeWInput && sizeHInput) {
    sizeWInput.value = String(Math.round(window.innerWidth));
    sizeHInput.value = String(Math.round(window.innerHeight));
  }
}

sizeToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  setSizePopover(Boolean(sizePopover?.hidden));
});

for (const chip of sizeChips) {
  chip.addEventListener("click", () => {
    void applySize(Number(chip.dataset.w), Number(chip.dataset.h));
    setSizePopover(false);
  });
}

sizeCustomForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const width = Number(sizeWInput?.value);
  const height = Number(sizeHInput?.value);
  if (width && height) {
    void applySize(width, height);
    setSizePopover(false);
  }
});

// Dismiss the popover on an outside click.
document.addEventListener("click", (event) => {
  if (sizePopover?.hidden) {
    return;
  }
  if (sizeMenu && !sizeMenu.contains(event.target as Node)) {
    setSizePopover(false);
  }
});

// ---------- Window + keyboard ----------

window.addEventListener("resize", () => {
  void layoutBrowser(false);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.metaKey) {
    void captureCleanShot();
  } else if (event.key === "," && event.metaKey) {
    event.preventDefault();
    void electronBridge?.openSettings();
  } else if (event.key === "Escape" && sizePopover && !sizePopover.hidden) {
    setSizePopover(false);
  }
});

// ---------- Main-process messages ----------

electronBridge?.onMenuReload(() => void reload());
electronBridge?.onSettingsChanged((settings) => {
  applyAppearanceSettings(settings);
  window.requestAnimationFrame(() => void layoutBrowser(false));
});
electronBridge?.onCaptureRequest(() => void captureCleanShot());
electronBridge?.onFullPageCaptureRequest(() => void captureFullPageShot());
electronBridge?.onCopyRequest(() => void copyCleanShot());
electronBridge?.onChromeVisibility((visibility) => {
  document.body.classList.toggle("hide-traffic", !visibility.traffic);
  document.body.classList.toggle("hide-address", !visibility.address);
  document.body.classList.toggle("hide-toolbar", !visibility.toolbar);
  window.requestAnimationFrame(() => void layoutBrowser(false));
});
// A preset switch (or "Default" reset) from the settings window can also restore
// the saved viewport size and, for the default, send us back to the home page.
electronBridge?.onApplyScene?.((scene) => {
  if (scene.viewport) {
    if (scene.viewport.preset) {
      for (const button of presetButtons) {
        button.classList.toggle("is-active", button.dataset.preset === scene.viewport.preset);
      }
      void applyPreset(scene.viewport.preset);
    } else {
      void applySize(scene.viewport.width, scene.viewport.height);
    }
  }
  if (scene.navigateHome) {
    void navigate(HOME_URL, false);
  }
});

// Restore the previous session (last URL, viewport preset, chrome visibility),
// falling back to the home page. The window is already sized to the preset by
// the main process, so here we only mirror the active button + visibility.
async function restoreSession(): Promise<void> {
  if (!electronBridge) {
    await navigate(HOME_URL, false);
    return;
  }

  try {
    const session = await electronBridge.getSession();

    document.body.classList.toggle("hide-traffic", !session.chromeVisibility.traffic);
    document.body.classList.toggle("hide-address", !session.chromeVisibility.address);
    document.body.classList.toggle("hide-toolbar", !session.chromeVisibility.toolbar);

    if (session.viewportPreset) {
      for (const button of presetButtons) {
        button.classList.toggle("is-active", button.dataset.preset === session.viewportPreset);
      }
    }

    await navigate(session.lastUrl ?? HOME_URL, false);
  } catch {
    await navigate(HOME_URL, false);
  }
}

void restoreSession();
