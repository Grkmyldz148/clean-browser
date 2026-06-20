import type { AppearanceSettings, ViewportPreset } from "./types";

export const DEFAULT_URL = "https://example.com";
export const SETTINGS_KEY = "clean-browser-appearance-v4";

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  canvasColor: "#ffffff",
  barColor: "#fbfbfa",
  barHeight: 56,
  frameRadius: 0,
  addressRadius: 11,
  addressWidth: 460,
  canvasPadding: 0,
  shadowOpacity: 0,
  hideToolsInCapture: true,
  hideScrollbarsInCapture: true,
  autoMatch: false,
  backdrop: "none",
  customBackdrop: "",
  exportScale: 2,
  exportFormat: "png",
  exportQuality: 92
};

// Mirrors the main process's "Resize to Breakpoint" menu (BREAKPOINTS in
// electron/main.cjs) so the toolbar presets and the menu stay in lock-step.
export const VIEWPORT_PRESETS: Record<string, ViewportPreset> = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  phone: { width: 390, height: 844 }
};

// The preset the window opens at on first launch (before the user picks one).
export const DEFAULT_VIEWPORT_PRESET = "laptop";

// Injected into the page to read its dominant background + a representative
// corner-radius ratio, driving auto-match theming.
export const PAGE_PROBE = `(() => {
  const clean = (c) => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' ? c : null;
  const bgOf = (el) => el ? clean(getComputedStyle(el).backgroundColor) : null;

  // The painted page canvas is the ground truth of what the user sees behind
  // the content — trust it over theme-color, which sites often set for a
  // different scheme (a light theme-color on a dark page makes the bar white).
  let background = bgOf(document.body) || bgOf(document.documentElement);

  // Wrapper-themed SPAs leave body/html transparent and paint an inner shell;
  // sample the real element stack near the top of the viewport instead.
  if (!background) {
    const cx = Math.floor((window.innerWidth || 1024) / 2);
    outer: for (const y of [10, 48, 96]) {
      let el = document.elementFromPoint(cx, y);
      while (el && el !== document.documentElement) {
        const c = bgOf(el);
        if (c) { background = c; break outer; }
        el = el.parentElement;
      }
    }
  }

  // theme-color is only a hint — honour the active colour scheme, then fall
  // back to white when the page paints nothing of its own.
  if (!background) {
    const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    const pick = metas.find((m) => { try { return !m.media || matchMedia(m.media).matches; } catch (e) { return !m.media; } }) || metas[0];
    if (pick && pick.content) background = pick.content;
  }

  background = background || '#ffffff';
  const selector = 'button, input, a[class], [role="button"], [class*="btn"], [class*="card"], [class*="rounded"]';
  const ratios = [];
  const nodes = document.querySelectorAll(selector);
  for (let i = 0; i < nodes.length && ratios.length < 240; i += 1) {
    const rect = nodes[i].getBoundingClientRect();
    if (rect.width < 24 || rect.height < 16 || rect.width > 1000) continue;
    const radius = parseFloat(getComputedStyle(nodes[i]).borderTopLeftRadius) || 0;
    if (radius <= 0.5) continue;
    ratios.push(Math.min(0.5, radius / Math.min(rect.width, rect.height)));
  }
  let radiusRatio = 0;
  if (ratios.length) { ratios.sort((a, b) => a - b); radiusRatio = ratios[Math.floor(ratios.length / 2)]; }
  return { background, radiusRatio };
})()`;

// A trimmed background-only probe used to cheaply poll for live theme changes
// (a dark-mode toggle, a delayed JS theme). It deliberately skips PAGE_PROBE's
// radius scan — no querySelectorAll / getBoundingClientRect — so it can run a
// couple of times a second without forcing layout. Returns a colour string, or
// '' when the page paints nothing of its own.
export const BG_PROBE = `(() => {
  const clean = (c) => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' ? c : null;
  const bgOf = (el) => el ? clean(getComputedStyle(el).backgroundColor) : null;
  let bg = bgOf(document.body) || bgOf(document.documentElement);
  if (!bg) {
    const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    const pick = metas.find((m) => { try { return !m.media || matchMedia(m.media).matches; } catch (e) { return !m.media; } }) || metas[0];
    if (pick && pick.content) bg = pick.content;
  }
  return bg || '';
})()`;

// Hides the page's scrollbars for cleaner capture edges; injected for the shot.
export const SCROLLBAR_HIDE_CSS = `
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
  html, body { scrollbar-width: none !important; -ms-overflow-style: none !important; }
`;
