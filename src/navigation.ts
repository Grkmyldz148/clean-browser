import { LogicalSize } from "@tauri-apps/api/dpi";
import { Webview } from "@tauri-apps/api/webview";

import { BG_PROBE, DEFAULT_URL, PAGE_PROBE, VIEWPORT_PRESETS } from "./constants";
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
import { clamp, loadImage } from "./utils";

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
  // Required so the <webview> routes target="_blank" links and window.open()
  // calls to the main process handler instead of silently swallowing them.
  // Without it, Electron blocks the popup before the handler is ever consulted.
  view.setAttribute("allowpopups", "");
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
  // target="_blank" links and window.open() popups are redirected into this
  // same surface by the main process (setWindowOpenHandler in main.cjs). The
  // <webview> "new-window" event that used to handle this was removed in
  // Electron 22+, so there is nothing to listen for here anymore.

  state.pageView = view;
  startAdaptiveWatch();
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

// Pick the dominant colour out of a captured strip. A plain average would wash
// black text on white (or vice versa) into a muddy grey, so we bucket colours
// on a coarse grid and return the average of the most-populated bucket.
function dominantColor(image: HTMLImageElement): string | null {
  const SAMPLE_W = 48;
  const SAMPLE_H = 8;
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  // Downscaling into a tiny canvas averages neighbouring pixels for us.
  ctx.drawImage(image, 0, 0, SAMPLE_W, SAMPLE_H);
  const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);

  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) {
      continue;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r & 0xf0) << 16) | ((g & 0xf0) << 8) | (b & 0xf0);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { n: 0, r: 0, g: 0, b: 0 };
      buckets.set(key, bucket);
    }
    bucket.n += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    if (!best || bucket.n > best.n) {
      best = bucket;
    }
  }
  if (!best) {
    return null;
  }
  return `rgb(${Math.round(best.r / best.n)}, ${Math.round(best.g / best.n)}, ${Math.round(best.b / best.n)})`;
}

// Capture the top strip of the live page — the band the chrome physically sits
// against — and read its dominant colour from the actual pixels. This catches
// what CSS can't: gradients, hero images, canvas/WebGL surfaces. Returns null
// (so the caller can fall back to the CSS probe) when capture isn't available.
async function sampleTopStripColor(view: WebviewTag): Promise<string | null> {
  if (!electronBridge) {
    return null;
  }
  const rect = view.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) {
    return null;
  }
  const stripHeight = Math.round(clamp(rect.height * 0.1, 24, 64));
  try {
    const dataUrl = await electronBridge.captureRegion({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: stripHeight
    });
    const image = await loadImage(dataUrl);
    return dominantColor(image);
  } catch {
    return null;
  }
}

// A page's theme can change without a navigation — the user flips the site's
// dark-mode switch, or the site applies its theme via JS just after load. So
// besides running on did-stop-loading we poll and re-detect (see startAdaptiveWatch).
let adaptiveTimer: number | null = null;
// The cheap background signal from the last analysis, so the poll can tell when
// the page's colour actually changes and only then pay for a fresh capture.
let lastAdaptiveSignature: string | null = null;

// Probe the live page for its dominant background + corner-radius ratio and
// feed auto-match. Prefers the captured top-strip colour (real pixels) and
// falls back to the CSS probe when capture is unavailable or hasn't painted.
async function runAdaptiveAnalysis(): Promise<void> {
  if (!state.pageView) {
    return;
  }

  try {
    const [bg, style] = await Promise.all([
      state.pageView.executeJavaScript(BG_PROBE, false) as Promise<string>,
      state.pageView.executeJavaScript(PAGE_PROBE, false) as Promise<PageStyle | null>
    ]);
    // Record the cheap signal the watcher compares against on each tick.
    lastAdaptiveSignature = bg || lastAdaptiveSignature;
    if (!style || !style.background) {
      return;
    }
    const sampled = await sampleTopStripColor(state.pageView);
    state.lastPageStyle = {
      background: sampled || style.background,
      radiusRatio: typeof style.radiusRatio === "number" ? style.radiusRatio : 0
    };
    applyAdaptiveTheme(state.lastPageStyle);
  } catch {
    // Page blocked script evaluation; keep the previous theme.
  }
}

// Re-check the page colour a couple of times a second so live theme switches
// (and post-load theme application) update the chrome — not just the first read.
// Cheap by design: each tick runs only the light BG_PROBE, and the expensive
// capture + re-apply fire solely when that background actually changes.
function startAdaptiveWatch(): void {
  if (adaptiveTimer !== null) {
    return;
  }
  adaptiveTimer = window.setInterval(() => {
    if (
      !state.pageView ||
      !state.appearanceSettings.autoMatch ||
      document.visibilityState !== "visible"
    ) {
      return;
    }
    void (state.pageView.executeJavaScript(BG_PROBE, false) as Promise<string>)
      .then((bg) => {
        if (bg && bg !== lastAdaptiveSignature) {
          return runAdaptiveAnalysis();
        }
        return undefined;
      })
      .catch(() => undefined);
  }, 1200);
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
