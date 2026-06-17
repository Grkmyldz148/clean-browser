import { invoke } from "@tauri-apps/api/core";

import { composeFullPage, exportImage } from "./compose";
import { SCROLLBAR_HIDE_CSS } from "./constants";
import { assertElement, browserChrome } from "./dom";
import { pageLabel } from "./navigation";
import { appWindow, electronBridge } from "./runtime";
import { state } from "./state";
import type { CaptureResult, FullPageTile } from "./types";
import { setBusy, showToast } from "./ui";
import { loadImage } from "./utils";

// Temporarily strip the page's scrollbars for cleaner capture edges. Injected
// into the <webview> just before a shot and removed once it's done.
async function hidePageScrollbars(): Promise<void> {
  if (!state.pageView || state.scrollbarCssKey !== null || !state.appearanceSettings.hideScrollbarsInCapture) {
    return;
  }
  try {
    state.scrollbarCssKey = await state.pageView.insertCSS(SCROLLBAR_HIDE_CSS);
  } catch {
    state.scrollbarCssKey = null;
  }
}

async function restorePageScrollbars(): Promise<void> {
  if (!state.pageView || state.scrollbarCssKey === null) {
    return;
  }
  const key = state.scrollbarCssKey;
  state.scrollbarCssKey = null;
  await state.pageView.removeInsertedCSS(key).catch(() => undefined);
}

export async function captureCleanShot(): Promise<void> {
  if (!appWindow && !electronBridge) {
    showToast("Run the Tauri app to take screenshots");
    return;
  }

  if (!state.browserWebview && !state.pageView && !state.browserReady) {
    showToast("Open a page first");
    return;
  }

  setBusy(true);
  document.body.classList.add("capture-mode");

  try {
    await hidePageScrollbars();
    await new Promise((resolve) => window.setTimeout(resolve, 180));

    if (electronBridge) {
      // Capture the framed window, then resample + encode it to the chosen
      // export scale / format / quality before saving.
      const shot = await electronBridge.capture();
      const image = await loadImage(shot.dataUrl);
      const exported = exportImage(image, shot.width, shot.height, state.appearanceSettings);
      const result = await electronBridge.saveImage(exported.dataUrl, pageLabel(state.currentUrl));

      showToast(`Saved ${exported.width} × ${exported.height} ${exported.ext.toUpperCase()}`);
      await electronBridge.reveal(result.path).catch(() => undefined);
    } else {
      const result = await invoke<CaptureResult>("capture_clean_screenshot", {
        cropTop: 0,
        viewportHeight: window.innerHeight,
        label: pageLabel(state.currentUrl)
      });

      showToast(`Saved ${result.width} x ${result.height} PNG`);
      await invoke("reveal_in_finder", { path: result.path }).catch(() => undefined);
    }
  } catch (error) {
    showToast("Screenshot failed.");
    console.error(error);
  } finally {
    await restorePageScrollbars();
    document.body.classList.remove("capture-mode");
    setBusy(false);
  }
}

export async function copyCleanShot(): Promise<void> {
  if (!electronBridge) {
    showToast("Copy to clipboard needs the Electron app");
    return;
  }

  if (!state.pageView && !state.browserReady) {
    showToast("Open a page first");
    return;
  }

  setBusy(true);
  document.body.classList.add("capture-mode");

  try {
    await hidePageScrollbars();
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const result = await electronBridge.copyToClipboard();
    showToast(`Copied ${result.width} × ${result.height} to clipboard`);
  } catch (error) {
    showToast("Copy failed.");
    console.error(error);
  } finally {
    await restorePageScrollbars();
    document.body.classList.remove("capture-mode");
    setBusy(false);
  }
}

export async function captureFullPageShot(): Promise<void> {
  if (!electronBridge) {
    showToast("Full page capture needs the Electron app");
    return;
  }

  if (!state.pageView || !state.browserReady) {
    showToast("Open a page first");
    return;
  }

  let webContentsId: number;
  try {
    webContentsId = state.pageView.getWebContentsId();
  } catch {
    showToast("Page is not ready yet");
    return;
  }

  setBusy(true);
  document.body.classList.add("capture-mode");

  try {
    await hidePageScrollbars();
    // Let capture-mode settle (tools fade out) before lifting the bar strip.
    await new Promise((resolve) => window.setTimeout(resolve, 180));

    // Main scrolls the page one viewport at a time (freezing fixed elements so
    // they don't repeat) and hands back the tiles to stitch.
    const page = await electronBridge.captureFullPage(webContentsId, window.devicePixelRatio || 1);
    if (!page.tiles.length) {
      throw new Error("No tiles captured");
    }

    const barRect = assertElement(browserChrome, "browser chrome").getBoundingClientRect();
    const barDataUrl = await electronBridge.captureRegion({
      x: barRect.left,
      y: barRect.top,
      width: barRect.width,
      height: barRect.height
    });

    const [barImage, tileImages] = await Promise.all([
      loadImage(barDataUrl),
      Promise.all(page.tiles.map((tile) => loadImage(tile.dataUrl)))
    ]);

    const tiles: FullPageTile[] = tileImages.map((image, index) => ({
      image,
      y: page.tiles[index].y
    }));

    // Preload the custom photo (if that backdrop is active) so it can be drawn
    // into the matte; loading from a data URL keeps the canvas un-tainted.
    const settings = state.appearanceSettings;
    const backdropImage =
      settings.backdrop === "custom" && settings.customBackdrop
        ? await loadImage(settings.customBackdrop).catch(() => null)
        : null;

    const dpr = window.devicePixelRatio || 1;
    const composite = composeFullPage(tiles, page.width, page.height, barImage, settings, backdropImage);
    const exported = exportImage(
      composite,
      composite.width / dpr,
      composite.height / dpr,
      state.appearanceSettings
    );
    const result = await electronBridge.saveImage(
      exported.dataUrl,
      `${pageLabel(state.currentUrl)}-fullpage`
    );

    const note = page.truncated ? " (very long page — clipped)" : "";
    showToast(`Saved ${exported.width} × ${exported.height} ${exported.ext.toUpperCase()}${note}`);
    await electronBridge.reveal(result.path).catch(() => undefined);
  } catch (error) {
    showToast("Full page screenshot failed.");
    console.error(error);
  } finally {
    await restorePageScrollbars();
    document.body.classList.remove("capture-mode");
    setBusy(false);
  }
}
