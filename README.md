# BrowOS

A beautiful makeover for your new tab. Works in Firefox 109+ and Chromium browsers.

## Load it (unpacked)

**Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and pick `manifest.json`.
Temporary add-ons are removed when Firefox closes; to keep it, package and sign it through addons.mozilla.org, or use Firefox Developer/Nightly with `xpinstall.signatures.required` set to false.

**Chrome / Edge / Brave:** open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and pick this folder.

## Use it

- Type in the search bar and press Enter to search in a new tab (or open a typed link).
- Click **Add app** to save a website. Right-click an app to rename it, edit its link, or remove it.
- Press and hold an app for one second, then drag it to a new spot.
- The three-line button (bottom right) holds add app, screensaver, theme, sound, settings, and save/load file.
- Your apps and settings are kept in extension storage and stay until you uninstall the extension. **Save to file** makes a backup you can load again with **Load from file** (the screensaver video is not included in the file).
