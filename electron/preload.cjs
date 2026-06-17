const { contextBridge, ipcRenderer } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const HOME_URL = pathToFileURL(path.join(__dirname, "..", "landing", "index.html")).href;

contextBridge.exposeInMainWorld("cleanBrowser", {
  runtime: "electron",
  homeUrl: HOME_URL,
  capture: () => ipcRenderer.invoke("browser:capture"),
  captureFullPage: (webContentsId, dpr) => ipcRenderer.invoke("browser:capture-fullpage", { webContentsId, dpr }),
  captureRegion: (rect) => ipcRenderer.invoke("browser:capture-region", rect),
  saveImage: (dataUrl, label) => ipcRenderer.invoke("browser:save-image", { dataUrl, label }),
  copyToClipboard: () => ipcRenderer.invoke("browser:copy"),
  reveal: (path) => ipcRenderer.invoke("browser:reveal", path),
  setWindowSize: (size) => ipcRenderer.invoke("window:set-size", size),
  getSession: () => ipcRenderer.invoke("session:get"),
  setLastUrl: (url) => ipcRenderer.invoke("session:set-url", url),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  openSettings: () => ipcRenderer.invoke("settings:open"),
  onSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  },
  onCaptureRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("capture:request", listener);
    return () => ipcRenderer.removeListener("capture:request", listener);
  },
  onFullPageCaptureRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("capture:fullpage-request", listener);
    return () => ipcRenderer.removeListener("capture:fullpage-request", listener);
  },
  onCopyRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("capture:copy-request", listener);
    return () => ipcRenderer.removeListener("capture:copy-request", listener);
  },
  onChromeVisibility: (callback) => {
    const listener = (_event, visibility) => callback(visibility);
    ipcRenderer.on("chrome:visibility", listener);
    return () => ipcRenderer.removeListener("chrome:visibility", listener);
  },
  onMenuReload: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("menu:reload", listener);
    return () => ipcRenderer.removeListener("menu:reload", listener);
  },
  onApplyScene: (callback) => {
    const listener = (_event, scene) => callback(scene);
    ipcRenderer.on("app:apply-scene", listener);
    return () => ipcRenderer.removeListener("app:apply-scene", listener);
  }
});
