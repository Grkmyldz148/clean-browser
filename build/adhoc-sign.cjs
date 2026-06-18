// Without a paid Apple Developer ID we can't notarize, but a *proper* ad-hoc
// signature (sealing the whole bundle) is far better than the minimal
// linker-only signature electron-builder leaves when signing is skipped — it
// avoids the "is damaged and can't be opened" verdict on Apple Silicon. This
// afterPack hook seals the packaged .app before the DMG is assembled.
const { execSync } = require("node:child_process");
const path = require("node:path");

module.exports = async function (context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }
  // Only ad-hoc seal the *unsigned* build (CI sets CSC_IDENTITY_AUTO_DISCOVERY
  // to "false"). When a real Developer ID identity is available, electron-builder
  // signs + notarizes the bundle itself, so skip this pass — an ad-hoc signature
  // here would clobber the proper one.
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY !== "false") {
    console.log("  • skipping ad-hoc sign (Developer ID signing enabled)");
    return;
  }
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log("  • ad-hoc signing", appPath);
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: "inherit" });
};
