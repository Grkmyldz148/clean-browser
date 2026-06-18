<div align="center">

<img src="app-icon.svg" width="128" alt="Clean Browser" />

# Clean Browser

**Frame any website in a polished macOS browser shell and capture a pixel‑perfect screenshot — in one click.**

![macOS](https://img.shields.io/badge/macOS-11%2B-000000?logo=apple&logoColor=white)
![Apple Silicon](https://img.shields.io/badge/Apple%20Silicon-arm64-555555)
![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron&logoColor=white)
![Chromium](https://img.shields.io/badge/engine-Chromium-4285F4?logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/version-0.1.0-4f46e5)
![Made by Görkem YILDIZ](https://img.shields.io/badge/made%20by-G%C3%B6rkem%20YILDIZ-1d1e22)

<br/>

<img src="videos/HK-jQl2WUAEWT-g.jpeg" width="840" alt="Clean Browser — a framed screenshot on a backdrop" />

</div>

---

## ⚡ Quick install

```sh
brew install --cask --force Grkmyldz148/tap/clean-browser
```

<div align="center">

<a href="https://github.com/Grkmyldz148/clean-browser/releases/latest"><img src="https://img.shields.io/badge/Download%20DMG-Latest%20release-4f46e5?style=for-the-badge&logo=apple&logoColor=white&labelColor=1d1e22" alt="Download the latest Clean Browser DMG" height="46" /></a>

<sub>macOS · Apple Silicon · free &amp; open source — always the newest signed <code>.dmg</code></sub>

</div>

---

## ✨ Why Clean Browser

Marketing shots, docs, changelogs and social posts look better when the site sits in a clean browser frame on a nice backdrop. Clean Browser is a tiny Chromium browser whose **whole job is producing that shot**: open a URL, style the chrome, pick a backdrop, and export at retina resolution — without a design tool, plugins, or manual cropping.

- 🖼 **The frame is the product.** The styled macOS bar stays in the exported image.
- ⚡️ **One click.** Viewport or full‑page capture, straight to `~/Pictures/Clean Browser` or the clipboard.
- 🎨 **Tunable & repeatable.** Every frame detail is adjustable and savable as a named preset.

---

## 🎬 Demos

<div align="center">

<img src="videos/demo-1.gif" width="80%" alt="Settings, backdrops and export in Clean Browser" />

<sub><b>Settings · backdrops · export</b> · <a href="videos/demo-1.mp4">watch full MP4 ↗</a></sub>

<br/><br/>

<img src="videos/demo-2.gif" width="80%" alt="Browsing and framing a site across viewports" />

<sub><b>Browse &amp; frame across viewports</b> · <a href="videos/demo-2.mp4">watch full MP4 ↗</a></sub>

</div>

---

## 🧩 Features

**Frame & chrome**
- Styled macOS browser shell with traffic lights and an address bar that stays in the shot
- Live page rendered in an embedded **Chromium** view inside the frame
- Custom / fake address text (show `yoursite.com` while loading `localhost:3000`)
- Manual **light / dark** chrome theme, or **Auto‑match** — derive the bar color & corner radius from the open page

**Backdrops & canvas**
- Backdrop gallery: solids, mesh gradients, and your own **custom photo** (with an always‑present “+” to add/replace)
- Matte padding, page corner radius, canvas color and soft shadow

**Capture & export**
- **Viewport** screenshot (`⌘⏎`) and **full‑page** scrolling capture (`⌘⇧F`)
- **Copy to clipboard** (`⌘⇧C`) or save to `~/Pictures/Clean Browser`
- Export scale **@1× / @2× / @3×**, format **PNG / JPEG / WebP**, with quality control
- Capture options: hide the toolbar and scrollbars for cleaner edges

**Sizing & presets**
- Viewport presets — **desktop / tablet / phone** — plus aspect‑ratio chips (16:9, 1:1, 9:16, OG) and custom `W × H`
- **Frame presets**: save the current look *and* window size as a named preset, switch between them, delete, or jump back to **Default**
- Session restore: last URL, viewport size and chrome visibility are remembered

**Native settings**
- Tabbed Settings window (**Frame · Canvas · Export**) with macOS vibrancy, light/dark support and a live preview — open with `⌘,`

---

## ⬇️ Install

> **Apple Silicon (arm64) only.** Releases are **signed with a Developer ID and notarized by Apple**, so they open with a normal double‑click — no Gatekeeper workaround needed. Intel Macs need a separate `x64`/universal build.

### Homebrew (recommended)

```sh
brew install --cask --force Grkmyldz148/tap/clean-browser
```

### Download

<a href="https://github.com/Grkmyldz148/clean-browser/releases/latest"><img src="https://img.shields.io/badge/Download%20DMG-Latest%20release-4f46e5?style=for-the-badge&logo=apple&logoColor=white&labelColor=1d1e22" alt="Download the latest Clean Browser DMG" height="46" /></a>

1. Click **Download DMG** above — always the newest **`clean-browser-<version>-arm64.dmg`** — or browse every build on [Releases](https://github.com/Grkmyldz148/clean-browser/releases).
2. Open it and drag **Clean Browser** onto **Applications**.
3. Double‑click to launch — it's signed and notarized, so macOS opens it without warnings.

> Clean Browser is signed with a **Developer ID Application** certificate and **notarized + stapled** by Apple.

---

## ⌨️ Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Take screenshot | `⌘⏎` |
| Full‑page screenshot | `⌘⇧F` |
| Copy screenshot to clipboard | `⌘⇧C` |
| Open Settings | `⌘,` |
| Reload page | `⌘R` |
| Resize → mobile / tablet / laptop / desktop | `⌘1` · `⌘2` · `⌘3` · `⌘4` |
| Cut · Copy · Paste · Select all · Undo | `⌘X` · `⌘C` · `⌘V` · `⌘A` · `⌘Z` |

---

## 🛠 Development

```sh
npm install
npm run electron:dev
```

Press `⌘,` (or **Clean Browser → Settings…**) to tune the frame live.

---

## 📦 Build

Produce the macOS DMG (custom install layout + app‑icon volume icon):

```sh
npm run electron:build
```

For a local **unsigned** build, skip code‑signing discovery:

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build
```

Output lands in `release/electron/`. A post‑build hook (`build/set-dmg-icon.cjs`) embeds the app icon into the `.dmg` file so it shows in Finder.

---

## 🗂 Project structure

```
clean-browser/
├─ index.html              # app shell (browser chrome + stage)
├─ src/                    # renderer: navigation, capture, theme, backdrop, settings glue
├─ electron/
│  ├─ main.cjs             # main process: windows, menu, IPC, capture, presets, DMG icon
│  ├─ settings.html        # tabbed Settings window (Frame · Canvas · Export)
│  └─ preload.cjs          # context‑isolated bridges
├─ landing/index.html      # bundled home / start page
├─ src-tauri/icons/        # app icon set (icns / png / ico …)
├─ build/                  # DMG background + icon hook
└─ release/electron/       # packaged .app and .dmg
```

---

## ⚙️ Engine note — Electron vs Tauri

The shipping target is **Electron**, which bundles **Chromium** inside the app — the right choice when the captured browser must be genuinely Chrome/Chromium‑based and render identically everywhere.

A **Tauri** target is kept as an alternate lightweight shell, but Tauri does **not** bundle Chromium (it uses the system WebView: WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux), so screenshots can differ by platform.

```sh
npm run tauri:dev     # alternate WebView shell
npm run tauri:build
```

---

## 🧭 Roadmap

Planned work (full list in [`ROADMAP.md`](ROADMAP.md)): element/cookie‑banner hiding before capture, page zoom, recent‑URL bookmarks, loading progress bar, annotation & redaction, a capture‑history gallery, and batch capture.

---

<div align="center">
  <img src="videos/HK8pxGXXQAE5gj5.jpeg" width="420" alt="Clean Browser in the macOS Dock" />
  <br/><br/>
  <sub>Built by <b>Görkem YILDIZ</b> · for clean shots.</sub>
</div>
