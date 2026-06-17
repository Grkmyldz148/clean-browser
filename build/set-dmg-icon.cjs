// electron-builder sets the *volume* icon (shown when the DMG is mounted) but
// not the .dmg file's own Finder icon — so the file shows the generic disk-image
// icon. This afterAllArtifactBuild hook embeds the app icon into each .dmg's
// resource fork and flags it as a custom icon, the classic Rez/SetFile way.
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function (buildResult) {
  const icon = path.join(__dirname, "..", "src-tauri", "icons", "icon.icns");
  const tmpIcns = "/tmp/_dmg-fileicon.icns";
  const tmpRsrc = "/tmp/_dmg-fileicon.rsrc";

  for (const file of buildResult.artifactPaths.filter((f) => f.endsWith(".dmg"))) {
    try {
      fs.copyFileSync(icon, tmpIcns);
      execSync(`sips -i "${tmpIcns}"`, { stdio: "ignore" });
      execSync(`DeRez -only icns "${tmpIcns}" > "${tmpRsrc}"`);
      execSync(`Rez -append "${tmpRsrc}" -o "${file}"`);
      execSync(`SetFile -a C "${file}"`);
      console.log("  • set custom Finder icon on", path.basename(file));
    } catch (error) {
      console.warn("  • could not set dmg file icon:", error.message);
    }
  }

  return [];
};
