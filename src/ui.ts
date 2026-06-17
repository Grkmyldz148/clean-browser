import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

import { currentFrameRadius } from "./compose";
import { assertElement, browserContent, captureButton, fullPageButton, reloadButton, toast } from "./dom";
import { electronBridge } from "./runtime";
import { state } from "./state";
import type { BrowserBounds } from "./types";

let toastTimer: number | undefined;

export function showToast(message: string): void {
  const toastElement = assertElement(toast, "toast");
  toastElement.textContent = message;
  toastElement.classList.add("visible");

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toastElement.classList.remove("visible");
  }, 3600);
}

export function setBusy(isBusy: boolean): void {
  document.body.classList.toggle("is-loading", isBusy);
  assertElement(reloadButton, "reload button").disabled = isBusy;
  assertElement(captureButton, "capture button").disabled = isBusy;
  if (fullPageButton) {
    fullPageButton.disabled = isBusy;
  }
}

export function browserBounds(): BrowserBounds {
  const rect = assertElement(browserContent, "browser content").getBoundingClientRect();

  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    radius: currentFrameRadius(state.appearanceSettings.frameRadius)
  };
}

export async function layoutBrowser(cleanMode = false): Promise<void> {
  // Electron renders the page as an in-DOM <webview>, sized and clipped by CSS,
  // so there is no native surface to position here.
  if (electronBridge) {
    return;
  }

  const bounds = browserBounds();
  if (!state.browserWebview) {
    return;
  }

  await state.browserWebview.setPosition(new LogicalPosition(bounds.x, cleanMode ? 0 : bounds.y));
  await state.browserWebview.setSize(
    new LogicalSize(bounds.width, cleanMode ? window.innerHeight : bounds.height)
  );
}
