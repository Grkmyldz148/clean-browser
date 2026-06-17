import { BACKDROPS } from "./backdrop";
import { mixRgb, parseCssColor, relativeLuminance, rgbToHex } from "./color";
import { DEFAULT_APPEARANCE, SETTINGS_KEY } from "./constants";
import { electronBridge } from "./runtime";
import { state } from "./state";
import type { AppearanceSettings, PageStyle } from "./types";
import { clamp } from "./utils";

export function loadAppearanceSettings(): AppearanceSettings {
  if (electronBridge) {
    return DEFAULT_APPEARANCE;
  }

  try {
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    if (!saved) {
      window.localStorage.removeItem("clean-browser-appearance");
      return DEFAULT_APPEARANCE;
    }

    return normalizeAppearanceSettings(JSON.parse(saved));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function normalizeAppearanceSettings(settings: Partial<AppearanceSettings>): AppearanceSettings {
  return {
    ...DEFAULT_APPEARANCE,
    ...settings
  };
}

export function applyAppearanceSettings(settings: AppearanceSettings): void {
  state.appearanceSettings = normalizeAppearanceSettings(settings);
  const s = state.appearanceSettings;
  const root = document.documentElement;

  root.style.setProperty("--canvas-color", s.canvasColor);
  root.style.setProperty("--page-color", s.canvasColor);
  // The page surface stays neutral white (like a real browser) in every mode,
  // so neither the matte nor the auto-match tint bleeds through a site's
  // transparent header. Auto-match only recolors the bar and surround.
  root.style.setProperty("--page-surface", "#ffffff");
  root.style.setProperty("--bar-color", s.barColor);
  root.style.setProperty("--bar-height", `${s.barHeight}px`);
  root.style.setProperty("--frame-radius", `${s.frameRadius}px`);
  root.style.setProperty("--address-radius", `${s.addressRadius}px`);
  root.style.setProperty("--address-width", `${s.addressWidth}px`);
  root.style.setProperty("--canvas-padding", `${s.canvasPadding}px`);
  root.style.setProperty("--shadow-opacity", `${s.shadowOpacity / 100}`);

  if (s.backdrop === "custom" && s.customBackdrop) {
    root.style.setProperty("--backdrop", `url("${s.customBackdrop}") center / cover no-repeat`);
  } else {
    const backdrop = BACKDROPS[s.backdrop];
    root.style.setProperty("--backdrop", backdrop && backdrop.css ? backdrop.css : "var(--page-color)");
  }

  document.body.classList.toggle("hide-tools-in-capture", s.hideToolsInCapture);
  document.body.classList.toggle("auto-match", s.autoMatch);
  applyBarContrast(s.barColor);

  // In auto-match mode, re-derive color + radius from the last seen page so
  // toggling the mode (or tweaking other settings) updates instantly.
  if (s.autoMatch && state.lastPageStyle) {
    applyAdaptiveTheme(state.lastPageStyle);
  }
}

export function applyBarContrast(barColor: string): void {
  const parsed = parseCssColor(barColor);
  const isDark = parsed ? relativeLuminance(parsed) < 0.5 : false;
  document.body.classList.toggle("bar-dark", isDark);
}

// "Auto-match" mode — shape the frame from the live page: tint the bar + matte
// toward the page color, and echo the site's corner-radius proportions.
export function applyAdaptiveTheme(style: PageStyle): void {
  if (!state.appearanceSettings.autoMatch) {
    return;
  }

  const parsed = parseCssColor(style.background);
  if (!parsed) {
    return;
  }

  const root = document.documentElement;
  const luminance = relativeLuminance(parsed);

  const isDark = luminance < 0.5;

  // Matte around the frame follows the page so the export feels cohesive.
  const canvasTarget = isDark
    ? mixRgb(parsed, { r: 18, g: 19, b: 22 }, 0.5)
    : mixRgb(parsed, { r: 245, g: 245, b: 244 }, 0.72);
  const canvasHex = rgbToHex(canvasTarget);
  root.style.setProperty("--canvas-color", canvasHex);
  root.style.setProperty("--page-color", canvasHex);

  // The bar becomes a chrome surface drawn from the page: a dark site gets a
  // dark bar (lifted just enough to read as a surface), a light site a light
  // one. Text legibility is handled by applyBarContrast (the .bar-dark flip).
  const barTarget = isDark
    ? mixRgb(parsed, { r: 255, g: 255, b: 255 }, 0.1)
    : mixRgb(parsed, { r: 255, g: 255, b: 255 }, 0.5);
  const barHex = rgbToHex(barTarget);
  root.style.setProperty("--bar-color", barHex);
  applyBarContrast(barHex);

  // Echo the site's roundness: ratio is corner radius / element min-side (0–0.5).
  const ratio = clamp(style.radiusRatio || 0, 0, 0.5);
  const addressRadius = Math.round(clamp(ratio * 36, 3, 18));
  const frameRadius = Math.round(clamp(ratio * 44, 0, 22));
  root.style.setProperty("--address-radius", `${addressRadius}px`);
  root.style.setProperty("--frame-radius", `${frameRadius}px`);
}
