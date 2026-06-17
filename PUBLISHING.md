# Publishing Clean Browser

Clean Browser ships **unsigned** (no paid Apple Developer ID). That's fine for a
free/open‑source release — it just means users do a one‑time Gatekeeper approval
(or install via Homebrew with `--no-quarantine`).

> Replace `OWNER` everywhere below (and in `homebrew/clean-browser.rb` +
> `README.md`) with your GitHub username/org. Quick one‑liner from the repo root:
>
> ```sh
> grep -rl OWNER . --include=*.rb --include=*.md | xargs sed -i '' 's/OWNER/your-username/g'
> ```

## 1. Put it on GitHub

```sh
git init           # already initialised if you cloned
git add -A
git commit -m "Clean Browser 0.1.0"
git branch -M main
git remote add origin https://github.com/OWNER/clean-browser.git
git push -u origin main
```

## 2. Cut a release (automated)

Pushing a tag triggers `.github/workflows/release.yml`, which builds the DMG on a
GitHub‑hosted Apple Silicon runner and attaches it to a GitHub Release:

```sh
npm version patch        # bumps package.json, creates a vX.Y.Z tag
git push --follow-tags
```

The resulting asset is `clean-browser-<version>-arm64.dmg`.

> Local build (same output): `CSC_IDENTITY_AUTO_DISCOVERY=false npm run electron:build`

## 3. Homebrew tap (optional but nicest UX)

1. Create a public repo named **`homebrew-tap`** under your account.
2. Copy `homebrew/clean-browser.rb` into it as `Casks/clean-browser.rb`.
3. After each release, update the cask's `version` and `sha256`:

   ```sh
   shasum -a 256 release/electron/clean-browser-<version>-arm64.dmg
   ```

Users then install with:

```sh
brew install --cask --no-quarantine OWNER/tap/clean-browser
```

`--no-quarantine` is what lets the unsigned app open without the "damaged" prompt.

## 4. Want a warning‑free install?

That requires a paid **Apple Developer Program** account ($99/yr): sign with a
**Developer ID Application** certificate and **notarize + staple**. Once you have
the cert, drop `CSC_IDENTITY_AUTO_DISCOVERY=false`, add an `afterSign`
notarization step, and the build signs/notarizes automatically.
