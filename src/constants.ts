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

export const VIEWPORT_PRESETS: Record<string, ViewportPreset> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 820 },
  phone: { width: 390, height: 844 }
};

// Injected into the page to read its dominant background + a representative
// corner-radius ratio, driving auto-match theming.
export const PAGE_PROBE = `(() => {
  const meta = document.querySelector('meta[name="theme-color"]')?.content;
  const probe = (element) => {
    if (!element) return null;
    const color = getComputedStyle(element).backgroundColor;
    return color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent' ? color : null;
  };
  const background = meta || probe(document.body) || probe(document.documentElement) || '#ffffff';
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

// Hides the page's scrollbars for cleaner capture edges; injected for the shot.
export const SCROLLBAR_HIDE_CSS = `
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
  html, body { scrollbar-width: none !important; -ms-overflow-style: none !important; }
`;
