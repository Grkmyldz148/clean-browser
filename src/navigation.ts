import { LogicalSize } from "@tauri-apps/api/dpi";
import { Webview } from "@tauri-apps/api/webview";

import { DEFAULT_URL, PAGE_PROBE, VIEWPORT_PRESETS } from "./constants";
import {
  addressInput,
  addressLockButton,
  assertElement,
  backButton,
  browserContent,
  forwardButton,
  presetButtons,
  stagePlaceholder
} from "./dom";
import { appWindow, electronBridge, HOME_URL, isElectronRuntime } from "./runtime";
import { state } from "./state";
import { applyAdaptiveTheme } from "./theme";
import type { PageStyle, WebviewTag } from "./types";
import { browserBounds, layoutBrowser, setBusy, showToast } from "./ui";
import { clamp } from "./utils";

export function normalizeUrl(rawValue: string): string {
  const value = rawValue.trim();

  if (!value) {
    return DEFAULT_URL;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return value;
  }

  if (value.includes(".") && !value.includes(" ")) {
    return `https://${value}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

export function pageLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "capture";
  }
}

export function isHomeUrl(url: string): boolean {
  return url === HOME_URL || url.split("#")[0].endsWith("/landing/index.html");
}

// What the address bar should show for a real URL: blank on the bundled home
// page, the URL otherwise. A custom-address override wins over both.
export function displayedAddress(url: string): string {
  if (state.addressOverride !== null) {
    return state.addressOverride;
  }
  return isHomeUrl(url) ? "" : url;
}

export function updateHistoryControls(): void {
  if (isElectronRuntime()) {
    return;
  }

  assertElement(backButton, "back button").disabled = state.historyIndex <= 0;
  assertElement(forwardButton, "forward button").disabled =
    state.historyIndex >= state.historyStack.length - 1;
}

function ensurePageView(): WebviewTag {
  if (state.pageView) {
    return state.pageView;
  }

  const view = document.createElement("webview") as WebviewTag;
  view.id = "page-view";
  view.setAttribute("partition", "persist:clean-browser");
  view.setAttribute("useragent", navigator.userAgent.replace(/ Electron\/[\d.]+/i, ""));
  assertElement(browserContent, "browser content").appendChild(view);

  view.addEventListener("did-start-loading", () => setBusy(true));
  view.addEventListener("did-stop-loading", () => {
    setBusy(false);
    state.browserReady = true;
    syncPageState();
    void runAdaptiveAnalysis();
  });
  view.addEventListener("did-navigate", () => syncPageState());
  view.addEventListener("did-navigate-in-page", () => syncPageState());
  view.addEventListener("did-fail-load", (event) => {
    const detail = event as unknown as { errorCode: number; validatedURL?: string };
    if (detail.errorCode === -3) {
      return;
    }
    showToast(`Could not open ${detail.validatedURL || state.currentUrl}`);
  });
  view.addEventListener("new-window", (event) => {
    const detail = event as unknown as { url?: string };
    event.preventDefault();
    if (detail.url) {
      view.src = detail.url;
    }
  });

  state.pageView = view;
  return view;
}

export function syncPageState(): void {
  if (!state.pageView) {
    return;
  }

  state.currentUrl = state.pageView.getURL() || state.currentUrl;
  // Keep the start page address bar clean and inviting rather than showing a
  // long file:// path for the bundled home page (unless a custom address is set).
  assertElement(addressInput, "address input").value = displayedAddress(state.currentUrl);
  assertElement(stagePlaceholder, "stage placeholder").classList.add("hidden");
  assertElement(backButton, "back button").disabled = !state.pageView.canGoBack();
  assertElement(forwardButton, "forward button").disabled = !state.pageView.canGoForward();

  // Remember real pages so the next launch reopens here (home page excluded).
  if (electronBridge && !isHomeUrl(state.currentUrl)) {
    void electronBridge.setLastUrl(state.currentUrl);
  }
}

// Probe the live page for its dominant background + corner-radius ratio and
// feed auto-match. Runs through the <webview> so it works for the DOM surface.
async function runAdaptiveAnalysis(): Promise<void> {
  if (!state.pageView) {
    return;
  }

  try {
    const style = (await state.pageView.executeJavaScript(PAGE_PROBE, false)) as PageStyle | null;
    if (style && style.background) {
      state.lastPageStyle = {
        background: style.background,
        radiusRatio: typeof style.radiusRatio === "number" ? style.radiusRatio : 0
      };
      applyAdaptiveTheme(state.lastPageStyle);
    }
  } catch {
    // Page blocked script evaluation; keep the previous theme.
  }
}

export async function createBrowserWebview(url: string): Promise<void> {
  setBusy(true);

  if (electronBridge) {
    const view = ensurePageView();
    view.src = url;
    state.currentUrl = url;
    assertElement(addressInput, "address input").value = displayedAddress(url);
    return;
  }

  const nativeWindow = appWindow;
  if (!nativeWindow) {
    state.currentUrl = url;
    assertElement(addressInput, "address input").value = url;
    updateHistoryControls();
    setBusy(false);
    showToast("Run the Tauri app for the native browser surface");
    return;
  }

  const oldWebview = state.browserWebview;
  state.browserWebview = null;

  if (oldWebview) {
    await oldWebview.close().catch(() => undefined);
  }

  const label = `browser_${Date.now()}`;
  const bounds = browserBounds();

  await new Promise<void>((resolve, reject) => {
    const webview = new Webview(nativeWindow, label, {
      url,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });

    webview.once("tauri://created", () => {
      state.browserWebview = webview;
      state.currentUrl = url;
      assertElement(addressInput, "address input").value = url;
      assertElement(stagePlaceholder, "stage placeholder").classList.add("hidden");
      updateHistoryControls();
      setBusy(false);
      resolve();
    });

    webview.once("tauri://error", (event) => {
      setBusy(false);
      reject(new Error(String(event.payload)));
    });
  });
}

export async function navigate(url: string, pushHistory = true): Promise<void> {
  const normalizedUrl = normalizeUrl(url);

  try {
    await createBrowserWebview(normalizedUrl);

    if (pushHistory && !isElectronRuntime()) {
      state.historyStack = state.historyStack.slice(0, state.historyIndex + 1);
      state.historyStack.push(normalizedUrl);
      state.historyIndex = state.historyStack.length - 1;
      updateHistoryControls();
    }
  } catch (error) {
    showToast(`Could not open ${normalizedUrl}`);
    setBusy(false);
    console.error(error);
  }
}

export async function goBack(): Promise<void> {
  if (electronBridge) {
    if (state.pageView?.canGoBack()) {
      state.pageView.goBack();
    }
    return;
  }

  if (state.historyIndex <= 0) {
    return;
  }

  state.historyIndex -= 1;
  await createBrowserWebview(state.historyStack[state.historyIndex]);
}

export async function goForward(): Promise<void> {
  if (electronBridge) {
    if (state.pageView?.canGoForward()) {
      state.pageView.goForward();
    }
    return;
  }

  if (state.historyIndex >= state.historyStack.length - 1) {
    return;
  }

  state.historyIndex += 1;
  await createBrowserWebview(state.historyStack[state.historyIndex]);
}

export async function reload(): Promise<void> {
  if (electronBridge) {
    state.pageView?.reload();
    return;
  }

  await createBrowserWebview(state.currentUrl);
}

export async function applyPreset(name: string): Promise<void> {
  const preset = VIEWPORT_PRESETS[name];

  if (!preset) {
    return;
  }

  if (electronBridge) {
    await electronBridge.setWindowSize({
      width: preset.width,
      height: preset.height,
      preset: name
    });
    return;
  }

  if (!appWindow) {
    return;
  }

  await appWindow.setSize(new LogicalSize(preset.width, preset.height));
  window.setTimeout(() => void layoutBrowser(), 140);
}

// Resize to an arbitrary width × height (aspect-ratio chips / custom input).
// This isn't one of the named device presets, so clear their active highlight
// and don't persist it as the launch preset.
export async function applySize(width: number, height: number): Promise<void> {
  const w = clamp(Math.round(width || 0), 200, 4000);
  const h = clamp(Math.round(height || 0), 200, 4000);

  for (const button of presetButtons) {
    button.classList.remove("is-active");
  }

  if (electronBridge) {
    await electronBridge.setWindowSize({ width: w, height: h });
    return;
  }

  if (!appWindow) {
    return;
  }

  await appWindow.setSize(new LogicalSize(w, h));
  window.setTimeout(() => void layoutBrowser(), 140);
}

// Toggle the custom-address override. When turning it on we seed it with
// whatever the bar currently shows so the user can edit from there; turning it
// off restores the real URL.
export function setCustomAddress(active: boolean): void {
  const input = assertElement(addressInput, "address input");

  if (active) {
    state.addressOverride = input.value;
    document.body.classList.add("address-custom");
    input.placeholder = "Type a custom address";
    addressLockButton?.setAttribute("aria-label", "Clear custom address");
    if (addressLockButton) {
      addressLockButton.title = "Clear custom address";
    }
    input.focus();
    input.select();
  } else {
    state.addressOverride = null;
    document.body.classList.remove("address-custom");
    input.placeholder = "Search or enter address";
    addressLockButton?.setAttribute("aria-label", "Custom address text");
    if (addressLockButton) {
      addressLockButton.title = "Show a custom address in the bar";
    }
    input.value = displayedAddress(state.currentUrl);
  }
}
