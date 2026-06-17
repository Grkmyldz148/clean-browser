import type { Webview } from "@tauri-apps/api/webview";

import { DEFAULT_APPEARANCE, DEFAULT_URL } from "./constants";
import type { AppearanceSettings, PageStyle, WebviewTag } from "./types";

// Mutable, shared renderer state. Modules read and write fields here so the
// behaviour can live in focused files without threading everything through
// function arguments.
export const state = {
  browserWebview: null as Webview | null,
  pageView: null as WebviewTag | null,
  browserReady: false,
  currentUrl: DEFAULT_URL,
  historyStack: [DEFAULT_URL] as string[],
  historyIndex: 0,
  lastPageStyle: null as PageStyle | null,
  // Custom address-bar text (demo/marketing). Kept apart from currentUrl so
  // navigation and capture labels still use the real page.
  addressOverride: null as string | null,
  // Key for the temporary scrollbar-hiding stylesheet injected during a capture.
  scrollbarCssKey: null as string | null,
  appearanceSettings: { ...DEFAULT_APPEARANCE } as AppearanceSettings
};
