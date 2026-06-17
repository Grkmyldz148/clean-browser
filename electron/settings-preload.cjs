const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("settingsBridge", {
  get: () => ipcRenderer.invoke("settings:get"),
  update: (settings) => ipcRenderer.invoke("settings:update", settings),
  reset: () => ipcRenderer.invoke("settings:reset"),
  resetAll: () => ipcRenderer.invoke("app:reset-default"),
  listPresets: () => ipcRenderer.invoke("presets:list"),
  savePreset: (name) => ipcRenderer.invoke("presets:save", name),
  applyPreset: (id) => ipcRenderer.invoke("presets:apply", id),
  deletePreset: (id) => ipcRenderer.invoke("presets:delete", id),
  onChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("settings:changed", listener);
    return () => ipcRenderer.removeListener("settings:changed", listener);
  }
});
