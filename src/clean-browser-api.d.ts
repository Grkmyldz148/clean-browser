type CleanBrowserCaptureResult = {
  path: string;
  width: number;
  height: number;
};

type CleanBrowserRawCapture = {
  dataUrl: string;
  width: number;
  height: number;
};

type CleanBrowserExportFormat = "png" | "jpeg" | "webp";

type CleanBrowserAppearanceSettings = {
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
  exportFormat: CleanBrowserExportFormat;
  exportQuality: number;
};

type CleanBrowserFullPageTile = {
  dataUrl: string;
  y: number;
};

type CleanBrowserFullPageResult = {
  tiles: CleanBrowserFullPageTile[];
  width: number;
  height: number;
  truncated: boolean;
};

type CleanBrowserRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CleanBrowserSession = {
  lastUrl: string | null;
  viewportPreset: string | null;
  chromeVisibility: { traffic: boolean; address: boolean; toolbar: boolean };
};

type CleanBrowserBridge = {
  runtime: "electron";
  homeUrl: string;
  capture: () => Promise<CleanBrowserRawCapture>;
  captureFullPage: (webContentsId: number, dpr: number) => Promise<CleanBrowserFullPageResult>;
  captureRegion: (rect: CleanBrowserRect) => Promise<string>;
  saveImage: (dataUrl: string, label: string) => Promise<{ path: string }>;
  copyToClipboard: () => Promise<{ width: number; height: number }>;
  reveal: (path: string) => Promise<void>;
  setWindowSize: (size: { width: number; height: number; preset?: string }) => Promise<void>;
  getSession: () => Promise<CleanBrowserSession>;
  setLastUrl: (url: string) => Promise<void>;
  closeWindow: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  getSettings: () => Promise<CleanBrowserAppearanceSettings>;
  openSettings: () => Promise<void>;
  onSettingsChanged: (callback: (settings: CleanBrowserAppearanceSettings) => void) => () => void;
  onCaptureRequest: (callback: () => void) => () => void;
  onFullPageCaptureRequest: (callback: () => void) => () => void;
  onCopyRequest: (callback: () => void) => () => void;
  onChromeVisibility: (
    callback: (visibility: { traffic: boolean; address: boolean; toolbar: boolean }) => void
  ) => () => void;
  onMenuReload: (callback: () => void) => () => void;
  onApplyScene: (
    callback: (scene: {
      navigateHome?: boolean;
      viewport?: { width: number; height: number; preset: string | null } | null;
    }) => void
  ) => () => void;
};

interface Window {
  cleanBrowser?: CleanBrowserBridge;
}
