# Homebrew Cask for Clean Browser.
#
# Put this in a public "homebrew-tap" repo as Casks/clean-browser.rb, then:
#   brew install --cask Grkmyldz148/tap/clean-browser
#
# For a stricter cask, swap `sha256 :no_check` for the real digest of the asset:
#   shasum -a 256 clean-browser-<version>-arm64.dmg
cask "clean-browser" do
  version "0.1.0"
  sha256 :no_check

  url "https://github.com/Grkmyldz148/clean-browser/releases/download/v#{version}/clean-browser-#{version}-arm64.dmg"
  name "Clean Browser"
  desc "Chromium-based browser for clean, framed website screenshots"
  homepage "https://github.com/Grkmyldz148/clean-browser"

  depends_on arch: :arm64
  depends_on macos: ">= :big_sur"

  app "Clean Browser.app"

  # Unsigned (ad-hoc) build: strip the quarantine flag after install so macOS
  # opens it without the "damaged" prompt. (Homebrew removed the --no-quarantine
  # CLI flag, so we do it here instead.)
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Clean Browser.app"]
  end

  caveats <<~EOS
    Clean Browser is unsigned (not notarized). If macOS still reports it as
    "damaged", clear the quarantine flag manually:

      xattr -dr com.apple.quarantine "/Applications/Clean Browser.app"
  EOS
end
