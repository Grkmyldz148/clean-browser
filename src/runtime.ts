import { getCurrentWindow } from "@tauri-apps/api/window";

import { DEFAULT_URL } from "./constants";

// The app ships in two shells: Electron (primary, via the preload bridge) and
// Tauri. These constants/predicates let the rest of the code branch on shell.
export const electronBridge = window.cleanBrowser ?? null;

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function isElectronRuntime(): boolean {
  return electronBridge?.runtime === "electron";
}

export const appWindow = isTauriRuntime() ? getCurrentWindow() : null;
export const HOME_URL = electronBridge?.homeUrl ?? DEFAULT_URL;
