const { app, BrowserWindow, Menu, ipcMain, shell, webContents, clipboard, nativeImage, dialog } = require("electron");

// Auto-update (electron-updater) is required defensively: if it ever fails to
// resolve in a packaged build, the app still launches and simply runs without
// auto-update instead of crashing on startup.
let autoUpdater = null;
try {
  ({ autoUpdater } = require("electron-updater"));
} catch (error) {
  console.error("electron-updater unavailable; auto-update disabled:", error);
}
const fs = require("node:fs");
const path = require("node:path");

const SETTINGS_FILE_NAME = "appearance-settings-v4.json";
const DEFAULT_APPEARANCE = {
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
const EXPORT_FORMATS = ["png", "jpeg", "webp"];
const BACKDROP_IDS = [
  "none",
  "snow",
  "graphite",
  "indigo",
  "sunset",
  "ocean",
  "grape",
  "mint",
  "dusk",
  "custom"
];
// The composite ends up on a 2D canvas, which Chromium caps near 32767px per
// side. Captures come back at the device pixel ratio, so clamp the clip in
// *device* pixels and convert back to CSS using the renderer's dpr.
const MAX_FULLPAGE_DEVICE_HEIGHT = 30000;
const BREAKPOINTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
  laptop: { width: 1280, height: 800 },
  desktop: { width: 1440, height: 900 }
};
// The bar's viewport presets — must match VIEWPORT_PRESETS in the renderer.
// Derived from BREAKPOINTS so the toolbar presets and the "Resize to
// Breakpoint" menu stay in lock-step (phone === mobile breakpoint).
const VIEWPORT_PRESETS = {
  desktop: BREAKPOINTS.desktop,
  laptop: BREAKPOINTS.laptop,
  tablet: BREAKPOINTS.tablet,
  phone: BREAKPOINTS.mobile
};
// The preset the window opens at on first launch (before the user picks one).
const DEFAULT_VIEWPORT_PRESET = "laptop";
const SESSION_FILE_NAME = "session-state-v1.json";
const PRESETS_FILE_NAME = "appearance-presets-v1.json";
const MAX_PRESETS = 100;

let mainWindow = null;
let settingsWindow = null;
let appearanceSettings = { ...DEFAULT_APPEARANCE };
// User-saved appearance presets: { id, name, settings }. Switch/apply, delete,
// and "save current as preset" are all driven from the settings window.
let appearancePresets = [];
// Persisted across restarts: last real URL, last viewport preset, and the
// chrome-visibility toggles. chromeVisibility aliases sessionState's copy.
let sessionState = {
  lastUrl: null,
  viewportPreset: DEFAULT_VIEWPORT_PRESET,
  chromeVisibility: { traffic: true, address: true, toolbar: true }
};
let chromeVisibility = sessionState.chromeVisibility;

function projectPath(...segments) {
  return path.join(__dirname, "..", ...segments);
}

function iconPath() {
  const png = projectPath("src-tauri", "icons", "icon.png");
  return fs.existsSync(png) ? png : undefined;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeAppearanceSettings(settings = {}) {
  return {
    canvasColor: normalizeColor(settings.canvasColor, DEFAULT_APPEARANCE.canvasColor),
    barColor: normalizeColor(settings.barColor, DEFAULT_APPEARANCE.barColor),
    barHeight: clampNumber(settings.barHeight, 44, 92, DEFAULT_APPEARANCE.barHeight),
    frameRadius: clampNumber(settings.frameRadius, 0, 36, DEFAULT_APPEARANCE.frameRadius),
    addressRadius: clampNumber(settings.addressRadius, 4, 22, DEFAULT_APPEARANCE.addressRadius),
    addressWidth: clampNumber(settings.addressWidth, 280, 760, DEFAULT_APPEARANCE.addressWidth),
    canvasPadding: clampNumber(settings.canvasPadding, 0, 48, DEFAULT_APPEARANCE.canvasPadding),
    shadowOpacity: clampNumber(settings.shadowOpacity, 0, 40, DEFAULT_APPEARANCE.shadowOpacity),
    hideToolsInCapture: settings.hideToolsInCapture !== false,
    hideScrollbarsInCapture: settings.hideScrollbarsInCapture !== false,
    autoMatch: settings.autoMatch === true,
    backdrop: BACKDROP_IDS.includes(settings.backdrop)
      ? settings.backdrop
      : DEFAULT_APPEARANCE.backdrop,
    customBackdrop:
      typeof settings.customBackdrop === "string" && /^data:image\//i.test(settings.customBackdrop)
        ? settings.customBackdrop
        : "",
    exportScale: clampNumber(settings.exportScale, 1, 3, DEFAULT_APPEARANCE.exportScale),
    exportFormat: EXPORT_FORMATS.includes(settings.exportFormat)
      ? settings.exportFormat
      : DEFAULT_APPEARANCE.exportFormat,
    exportQuality: clampNumber(settings.exportQuality, 40, 100, DEFAULT_APPEARANCE.exportQuality)
  };
}

function settingsPath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
}

function loadAppearanceSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    appearanceSettings = normalizeAppearanceSettings(JSON.parse(raw));
  } catch {
    appearanceSettings = { ...DEFAULT_APPEARANCE };
  }
}

function saveAppearanceSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(appearanceSettings, null, 2));
  } catch (error) {
    console.error("Could not save settings", error);
  }
}

function sessionPath() {
  return path.join(app.getPath("userData"), SESSION_FILE_NAME);
}

function loadSessionState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(sessionPath(), "utf8"));
    const visibility = parsed.chromeVisibility || {};
    sessionState = {
      lastUrl: typeof parsed.lastUrl === "string" && parsed.lastUrl ? parsed.lastUrl : null,
      viewportPreset: VIEWPORT_PRESETS[parsed.viewportPreset] ? parsed.viewportPreset : DEFAULT_VIEWPORT_PRESET,
      chromeVisibility: {
        traffic: visibility.traffic !== false,
        address: visibility.address !== false,
        toolbar: visibility.toolbar !== false
      }
    };
  } catch {
    sessionState = {
      lastUrl: null,
      viewportPreset: DEFAULT_VIEWPORT_PRESET,
      chromeVisibility: { traffic: true, address: true, toolbar: true }
    };
  }
  chromeVisibility = sessionState.chromeVisibility;
}

function saveSessionState() {
  try {
    fs.mkdirSync(path.dirname(sessionPath()), { recursive: true });
    fs.writeFileSync(sessionPath(), JSON.stringify(sessionState, null, 2));
  } catch (error) {
    console.error("Could not save session", error);
  }
}

function presetsPath() {
  return path.join(app.getPath("userData"), PRESETS_FILE_NAME);
}

function normalizeViewport(viewport) {
  if (!viewport || typeof viewport !== "object") {
    return null;
  }
  const width = clampNumber(viewport.width, 200, 4000, 0);
  const height = clampNumber(viewport.height, 200, 4000, 0);
  if (!width || !height) {
    return null;
  }
  return { width, height, preset: VIEWPORT_PRESETS[viewport.preset] ? viewport.preset : null };
}

function normalizePreset(preset = {}) {
  return {
    id: typeof preset.id === "string" && preset.id ? preset.id : makePresetId(),
    name: String(preset.name || "Untitled").trim().slice(0, 40) || "Untitled",
    settings: normalizeAppearanceSettings(preset.settings || {}),
    // A preset also remembers the window size it was saved at, so switching to it
    // restores the frame look *and* the viewport.
    viewport: normalizeViewport(preset.viewport)
  };
}

function makePresetId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function loadPresets() {
  try {
    const parsed = JSON.parse(fs.readFileSync(presetsPath(), "utf8"));
    appearancePresets = Array.isArray(parsed)
      ? parsed.filter((preset) => preset && typeof preset === "object").map(normalizePreset).slice(0, MAX_PRESETS)
      : [];
  } catch {
    appearancePresets = [];
  }
}

function savePresets() {
  try {
    fs.mkdirSync(path.dirname(presetsPath()), { recursive: true });
    fs.writeFileSync(presetsPath(), JSON.stringify(appearancePresets, null, 2));
  } catch (error) {
    console.error("Could not save presets", error);
  }
}

function broadcastAppearanceSettings() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("settings:changed", appearanceSettings);
  }

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("settings:changed", appearanceSettings);
  }
}

function createWindow() {
  // Reopen at the last chosen viewport preset (if any), else the default size.
  const startPreset = VIEWPORT_PRESETS[sessionState.viewportPreset];
  mainWindow = new BrowserWindow({
    width: startPreset ? startPreset.width : 1280,
    height: startPreset ? startPreset.height : 820,
    minWidth: 360,
    minHeight: 480,
    frame: false,
    title: "Clean Browser",
    backgroundColor: "#ffffff",
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  });

  mainWindow.on("closed", () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }

    mainWindow = null;
  });

  if (process.env.CLEAN_BROWSER_DEV_URL) {
    mainWindow.loadURL(process.env.CLEAN_BROWSER_DEV_URL);
  } else {
    mainWindow.loadFile(projectPath("dist", "index.html"));
  }
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 604,
    title: "Settings",
    parent: mainWindow || undefined,
    modal: false,
    resizable: false,
    minimizable: false,
    fullscreenable: false,
    titleBarStyle: "hiddenInset",
    vibrancy: "under-window",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "settings-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.show();
  });

  settingsWindow.loadFile(path.join(__dirname, "settings.html"));
}

function resizeToBreakpoint(name) {
  const breakpoint = BREAKPOINTS[name];
  if (!mainWindow || mainWindow.isDestroyed() || !breakpoint) {
    return;
  }

  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }

  mainWindow.setContentSize(breakpoint.width, breakpoint.height + appearanceSettings.barHeight);
  mainWindow.center();
}

function broadcastChromeVisibility() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("chrome:visibility", chromeVisibility);
  }
}

function createApplicationMenu() {
  const template = [
    {
      label: "Clean Browser",
      submenu: [
        {
          label: "Check for Updates...",
          click: () => checkForUpdates({ manual: true })
        },
        {
          label: "Settings...",
          accelerator: "CommandOrControl+,",
          click: () => openSettingsWindow()
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "File",
      submenu: [
        {
          label: "Take Screenshot",
          accelerator: "CommandOrControl+Shift+S",
          click: () => mainWindow?.webContents.send("capture:request")
        },
        {
          label: "Take Full Page Screenshot",
          accelerator: "CommandOrControl+Shift+F",
          click: () => mainWindow?.webContents.send("capture:fullpage-request")
        },
        {
          label: "Copy Screenshot",
          accelerator: "CommandOrControl+Shift+C",
          click: () => mainWindow?.webContents.send("capture:copy-request")
        },
        { type: "separator" },
        { role: "close" }
      ]
    },
    {
      // Standard edit roles — without these, Cmd+C / Cmd+V / Cmd+X / Cmd+A /
      // Cmd+Z don't fire in the page, address bar, or settings inputs.
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload Page",
          accelerator: "CommandOrControl+R",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("menu:reload");
            }
          }
        },
        { type: "separator" },
        {
          label: "Hide Traffic Lights",
          type: "checkbox",
          checked: !chromeVisibility.traffic,
          click: (item) => {
            chromeVisibility.traffic = !item.checked;
            broadcastChromeVisibility();
            saveSessionState();
          }
        },
        {
          label: "Hide Address Bar",
          type: "checkbox",
          checked: !chromeVisibility.address,
          click: (item) => {
            chromeVisibility.address = !item.checked;
            broadcastChromeVisibility();
            saveSessionState();
          }
        },
        {
          label: "Hide Toolbar",
          type: "checkbox",
          checked: !chromeVisibility.toolbar,
          click: (item) => {
            chromeVisibility.toolbar = !item.checked;
            broadcastChromeVisibility();
            saveSessionState();
          }
        },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        {
          label: "Resize to Breakpoint",
          submenu: [
            {
              label: "Mobile",
              accelerator: "CommandOrControl+1",
              click: () => resizeToBreakpoint("mobile")
            },
            {
              label: "Tablet",
              accelerator: "CommandOrControl+2",
              click: () => resizeToBreakpoint("tablet")
            },
            {
              label: "Laptop",
              accelerator: "CommandOrControl+3",
              click: () => resizeToBreakpoint("laptop")
            },
            {
              label: "Desktop",
              accelerator: "CommandOrControl+4",
              click: () => resizeToBreakpoint("desktop")
            }
          ]
        },
        { type: "separator" },
        { role: "front" }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function safeLabel(value) {
  return String(value || "capture")
    .toLowerCase()
    .replace(/[^a-z0-9._ -]/g, "")
    .replace(/[\s._-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "capture";
}

function screenshotsDirectory() {
  const directory = path.join(app.getPath("pictures"), "Clean Browser");
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

// Capture the visible framed window and hand the raw bitmap (lossless PNG data
// URL) plus its logical size back to the renderer, which applies the export
// scale + format + quality on a canvas before saving via browser:save-image.
ipcMain.handle("browser:capture", async () => {
  const image = await mainWindow.capturePage();
  const size = image.getSize();
  return {
    dataUrl: image.toDataURL(),
    width: size.width,
    height: size.height
  };
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pin every position:fixed / sticky element in place (fixed → absolute,
// sticky → relative) so it appears once at its document spot instead of
// riding along on every scroll tile. Originals are stashed on the page window.
const FREEZE_FIXED_EXPR = `(() => {
  const changed = [];
  const nodes = document.querySelectorAll('body *');
  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i];
    const pos = getComputedStyle(el).position;
    if (pos === 'fixed' || pos === 'sticky') {
      changed.push([el, el.style.getPropertyValue('position'), el.style.getPropertyPriority('position')]);
      el.style.setProperty('position', pos === 'fixed' ? 'absolute' : 'relative', 'important');
    }
  }
  window.__cbFrozen = changed;
  return changed.length;
})()`;

const RESTORE_FIXED_EXPR = `(() => {
  const changed = window.__cbFrozen || [];
  for (let i = 0; i < changed.length; i += 1) {
    const el = changed[i][0], value = changed[i][1], priority = changed[i][2];
    if (value) { el.style.setProperty('position', value, priority); }
    else { el.style.removeProperty('position'); }
  }
  delete window.__cbFrozen;
})()`;

async function evaluateInPage(dbg, expression) {
  const { result } = await dbg.sendCommand("Runtime.evaluate", {
    expression,
    returnByValue: true
  });
  return result ? result.value : undefined;
}

// Full page = the entire scroll height of the loaded page. Rather than a single
// beyond-viewport shot (which tiles fixed elements and trips up many real
// sites), we walk the page one viewport at a time, capture each frame, and hand
// the tiles back to the renderer to stitch — the approach screenshot tools use.
ipcMain.handle("browser:capture-fullpage", async (_event, options = {}) => {
  const target = webContents.fromId(Number(options.webContentsId));
  if (!target || target.isDestroyed()) {
    throw new Error("Page web contents not available");
  }

  const dbg = target.debugger;
  let attachedHere = false;
  let frozen = false;
  const tileDelay = clampNumber(options.tileDelay, 40, 600, 150);

  try {
    if (!dbg.isAttached()) {
      dbg.attach("1.3");
      attachedHere = true;
    }

    await evaluateInPage(dbg, FREEZE_FIXED_EXPR);
    frozen = true;

    const metrics = await dbg.sendCommand("Page.getLayoutMetrics");
    const content = metrics.cssContentSize || metrics.contentSize || {};
    const layout = metrics.cssLayoutViewport || {};
    const width = Math.max(1, Math.ceil(content.width || layout.clientWidth || 0));
    const viewportHeight = Math.max(1, Math.floor(layout.clientHeight || 0));
    const fullHeight = Math.max(1, Math.ceil(content.height || 0));
    const dpr = Number(options.dpr) > 0 ? Number(options.dpr) : 1;
    const maxCssHeight = Math.floor(MAX_FULLPAGE_DEVICE_HEIGHT / dpr);
    const totalHeight = Math.min(fullHeight, maxCssHeight);

    const tiles = [];
    let target_y = 0;
    let lastY = -1;
    let guard = 0;

    while (guard < 120) {
      guard += 1;

      const actualY = Math.round(
        (await evaluateInPage(
          dbg,
          `(() => { window.scrollTo(0, ${target_y}); return window.scrollY || document.documentElement.scrollTop || 0; })()`
        )) || 0
      );

      // Page can't scroll any further — stop before re-shooting the same frame.
      if (actualY <= lastY && tiles.length > 0) {
        break;
      }

      await sleep(tileDelay);

      const shot = await dbg.sendCommand("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false
      });

      tiles.push({ dataUrl: `data:image/png;base64,${shot.data}`, y: actualY });
      lastY = actualY;

      if (actualY + viewportHeight >= totalHeight) {
        break;
      }

      target_y = actualY + viewportHeight;
    }

    return {
      tiles,
      width,
      height: totalHeight,
      truncated: totalHeight < fullHeight
    };
  } finally {
    if (frozen) {
      await evaluateInPage(dbg, RESTORE_FIXED_EXPR).catch(() => undefined);
      await evaluateInPage(dbg, "window.scrollTo(0, 0)").catch(() => undefined);
    }
    if (attachedHere) {
      try {
        dbg.detach();
      } catch {
        // Already detached or page gone — nothing to clean up.
      }
    }
  }
});

// Grab a rectangular slice of the main window (used to lift the chrome bar so it
// can be stitched on top of the full-page shot). Rect is in DIP / CSS pixels.
ipcMain.handle("browser:capture-region", async (_event, rect = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("Main window not available");
  }

  const image = await mainWindow.capturePage({
    x: Math.max(0, Math.round(rect.x || 0)),
    y: Math.max(0, Math.round(rect.y || 0)),
    width: Math.max(1, Math.round(rect.width || 1)),
    height: Math.max(1, Math.round(rect.height || 1))
  });

  return image.toDataURL();
});

// Persist an exported image (data URL produced in the renderer) to disk. The
// renderer has already applied scale + format + quality, so we just decode the
// chosen format and write it with the matching extension.
ipcMain.handle("browser:save-image", (_event, options = {}) => {
  const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(String(options.dataUrl || ""));
  if (!match) {
    throw new Error("Expected a PNG / JPEG / WebP data URL");
  }

  const buffer = Buffer.from(match[2], "base64");
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const filename = `clean-browser-${safeLabel(options.label)}-${Date.now()}.${ext}`;
  const filePath = path.join(screenshotsDirectory(), filename);
  fs.writeFileSync(filePath, buffer);
  return { path: filePath };
});

// Copy the framed shot straight to the clipboard (no file), for quick pasting
// into Slack / Figma / Notion. The capture is already a nativeImage.
ipcMain.handle("browser:copy", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("Main window not available");
  }

  const image = await mainWindow.capturePage();
  clipboard.writeImage(image);
  const size = image.getSize();
  return { width: size.width, height: size.height };
});

ipcMain.handle("browser:reveal", (_event, filePath) => {
  if (filePath) {
    shell.showItemInFolder(filePath);
  }
});

ipcMain.handle("window:set-size", (_event, size) => {
  if (!mainWindow) {
    return;
  }

  mainWindow.setContentSize(Math.round(size.width), Math.round(size.height));

  // Remember the chosen preset so the next launch reopens at this size.
  if (size.preset && VIEWPORT_PRESETS[size.preset]) {
    sessionState.viewportPreset = size.preset;
    saveSessionState();
  }
});

ipcMain.handle("session:get", () => ({
  lastUrl: sessionState.lastUrl,
  viewportPreset: sessionState.viewportPreset,
  chromeVisibility: sessionState.chromeVisibility
}));

ipcMain.handle("session:set-url", (_event, url) => {
  const next = typeof url === "string" && url ? url : null;
  if (next === sessionState.lastUrl) {
    return;
  }
  sessionState.lastUrl = next;
  saveSessionState();
});

ipcMain.handle("window:close", () => mainWindow?.close());
ipcMain.handle("window:minimize", () => mainWindow?.minimize());
ipcMain.handle("window:toggle-maximize", () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle("settings:get", () => appearanceSettings);

ipcMain.handle("settings:open", () => {
  openSettingsWindow();
});

ipcMain.handle("settings:update", (_event, nextSettings = {}) => {
  appearanceSettings = normalizeAppearanceSettings({
    ...appearanceSettings,
    ...nextSettings
  });
  saveAppearanceSettings();
  broadcastAppearanceSettings();
  return appearanceSettings;
});

ipcMain.handle("settings:reset", () => {
  appearanceSettings = { ...DEFAULT_APPEARANCE };
  saveAppearanceSettings();
  broadcastAppearanceSettings();
  return appearanceSettings;
});

ipcMain.handle("presets:list", () => appearancePresets);

ipcMain.handle("presets:save", (_event, name) => {
  let viewport = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [width, height] = mainWindow.getContentSize();
    viewport = { width, height, preset: sessionState.viewportPreset };
  }
  const preset = normalizePreset({ name, settings: appearanceSettings, viewport });
  appearancePresets = [...appearancePresets, preset].slice(-MAX_PRESETS);
  savePresets();
  return { presets: appearancePresets, savedId: preset.id };
});

ipcMain.handle("presets:apply", (_event, id) => {
  const preset = appearancePresets.find((entry) => entry.id === id);
  if (preset) {
    appearanceSettings = normalizeAppearanceSettings(preset.settings);
    saveAppearanceSettings();
    broadcastAppearanceSettings();
    if (preset.viewport && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("app:apply-scene", { viewport: preset.viewport });
    }
  }
  return appearanceSettings;
});

ipcMain.handle("presets:delete", (_event, id) => {
  appearancePresets = appearancePresets.filter((entry) => entry.id !== id);
  savePresets();
  return appearancePresets;
});

// Full "factory default": reset the frame look, forget the restored session, and
// send the live window back to the home page at the default desktop size.
ipcMain.handle("app:reset-default", () => {
  appearanceSettings = { ...DEFAULT_APPEARANCE };
  saveAppearanceSettings();
  broadcastAppearanceSettings();

  sessionState.lastUrl = null;
  saveSessionState();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("app:apply-scene", {
      navigateHome: true,
      viewport: {
        width: VIEWPORT_PRESETS.desktop.width,
        height: VIEWPORT_PRESETS.desktop.height,
        preset: "desktop"
      }
    });
  }

  return appearanceSettings;
});

// Links with target="_blank" and window.open() calls would normally spawn a
// new window/tab. This browser is a single surface, and the old <webview>
// "new-window" event that used to redirect them was removed in Electron 22+.
// Catch the popup here instead and steer the same webview to the target URL so
// the link opens in the current page rather than vanishing.
app.on("web-contents-created", (_event, contents) => {
  if (contents.getType() !== "webview") {
    return;
  }

  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      // Defer: navigating from inside the handler callback is unsupported.
      queueMicrotask(() => {
        if (!contents.isDestroyed()) {
          contents.loadURL(url);
        }
      });
    }
    return { action: "deny" };
  });
});

// Tracks an in-flight update check so overlapping checks (launch + manual)
// don't stack, and so the manual path knows when to surface a result dialog.
let updateCheckInFlight = false;
let manualUpdateCheck = false;

function setupAutoUpdater() {
  if (!autoUpdater) {
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-not-available", () => {
    if (manualUpdateCheck && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        message: "You're up to date",
        detail: `Clean Browser ${app.getVersion()} is the latest version.`,
        buttons: ["OK"]
      });
    }
    manualUpdateCheck = false;
    updateCheckInFlight = false;
  });

  autoUpdater.on("update-downloaded", async (info) => {
    updateCheckInFlight = false;
    manualUpdateCheck = false;
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
      message: `Clean Browser ${info.version} is ready`,
      detail: "Restart the app to finish updating. It will also install automatically the next time you quit."
    });
    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", (error) => {
    updateCheckInFlight = false;
    if (manualUpdateCheck && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: "error",
        message: "Update check failed",
        detail: String(error && error.message ? error.message : error),
        buttons: ["OK"]
      });
    }
    manualUpdateCheck = false;
  });
}

function checkForUpdates({ manual = false } = {}) {
  // Auto-update only works for a packaged, signed app reading the published
  // GitHub release feed — there is nothing to update against in development.
  if (!autoUpdater || !app.isPackaged) {
    if (manual && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        message: "Updates are only available in the installed app",
        detail: "Run the packaged Clean Browser to check for updates.",
        buttons: ["OK"]
      });
    }
    return;
  }
  if (updateCheckInFlight) {
    manualUpdateCheck = manualUpdateCheck || manual;
    return;
  }
  updateCheckInFlight = true;
  manualUpdateCheck = manual;
  autoUpdater.checkForUpdates().catch((error) => {
    updateCheckInFlight = false;
    console.error("Auto-update check failed:", error);
  });
}

app.whenReady().then(() => {
  loadAppearanceSettings();
  loadSessionState();
  loadPresets();
  createApplicationMenu();
  setupAutoUpdater();

  // Packaged builds use icon.icns; in dev the dock shows the default Electron
  // icon, so set it explicitly from the app icon.
  if (process.platform === "darwin" && app.dock) {
    const icon = iconPath();
    if (icon) {
      try {
        app.dock.setIcon(nativeImage.createFromPath(icon));
      } catch {
        // Non-fatal: fall back to the default dock icon.
      }
    }
  }

  createWindow();

  // Check once on launch; if a newer release exists it downloads in the
  // background and prompts to restart when ready.
  checkForUpdates();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
