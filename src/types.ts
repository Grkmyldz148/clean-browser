// Shared type definitions for the renderer.

export type CaptureResult = {
  path: string;
  width: number;
  height: number;
};

export type ViewportPreset = {
  width: number;
  height: number;
};

export type BrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

export type AppearanceSettings = {
  canvasColor: string;
  barColor: string;
  barHeight: number;
  frameRadius: number;
  addressRadius: number;
  addressWidth: number;
  canvasPadding: number;
  shadowOpacity: number;
  hideToolsInCapture: boolean;
  hideScrollbarsInCapture: boolean;
  autoMatch: boolean;
  backdrop: string;
  customBackdrop: string;
  exportScale: number;
  exportFormat: "png" | "jpeg" | "webp";
  exportQuality: number;
};

export type PageStyle = {
  background: string;
  radiusRatio: number;
};

// Electron's <webview> tag — the browser surface for the loaded page.
export type WebviewTag = HTMLElement & {
  src: string;
  reload(): void;
  goBack(): void;
  goForward(): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  getURL(): string;
  getWebContentsId(): number;
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  insertCSS(css: string): Promise<string>;
  removeInsertedCSS(key: string): Promise<void>;
};

// One captured viewport slice of a full-page shot, placed at scroll offset `y`.
export type FullPageTile = { image: HTMLImageElement; y: number };

export type ExportResult = { dataUrl: string; ext: string; width: number; height: number };
