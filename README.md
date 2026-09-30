# Dark Safari

A Safari web extension that adds a configurable dark mode to any website —
including sites that don't support `prefers-color-scheme`. Sites that already
ship a dark theme are detected automatically and left alone.

## Features

- Dark mode via CSS filters on every site; photos, video and canvas keep
  their natural colors
- Brightness, contrast and warmth sliders, plus a grayscale toggle
- Per-website overrides, and optional per-page overrides ("Advanced")
- Auto-detects natively dark sites and disables itself there (an explicit
  toggle always wins)
- Keyboard shortcuts: ⌥⇧D toggle for the current site · ⌥⇧P cycle presets ·
  ⌥⇧F open the popup

## Repository layout

| Path | Purpose |
| --- | --- |
| `extension/` | The web extension itself (shared across all platforms) |
| `extension/shared/` | Settings model, storage, scope resolution |
| `extension/content/` | Content script + CSS applying the dark theme |
| `extension/popup/` | Toolbar popup UI |
| `scripts/make_icons.py` | Generates the extension icons (not tracked in git) |
| `test/` | Browser harnesses with a stubbed WebExtension API |
| `xcode/Dark Safari/` | Xcode project wrapping the extension for macOS + iOS |

## Building

Prerequisites: Xcode (15+) with command line tools. The Xcode project
references `extension/` directly, so extension changes need no regeneration —
just rebuild.

First, generate the icons (they are build artifacts and not tracked in git):

```sh
python3 scripts/make_icons.py
```

### macOS

```sh
xcodebuild -project "xcode/Dark Safari/Dark Safari.xcodeproj" \
  -scheme "Dark Safari (macOS)" -configuration Debug \
  -derivedDataPath xcode/DerivedData build
open "xcode/DerivedData/Build/Products/Debug/Dark Safari.app"
```

Launching the app registers the extension with Safari. Then, in Safari:

1. Settings → Advanced → enable "Show features for web developers" (once)
2. Settings → Developer → check **Allow unsigned extensions** (needs your
   password; resets when Safari quits — a real signing team removes this step)
3. Settings → Extensions → enable **Dark Safari**
4. Grant website access: "Always Allow on Every Website", or per-site via the
   toolbar button

Faster dev loop (skips the app entirely): Settings → Developer →
**Add Temporary Extension…** → select the `extension/` folder. Use the
Reload button in the Extensions pane after code changes.

### iPhone / iPad

The iOS target shares the same extension sources. You need the iOS platform
SDK installed (Xcode → Settings → Components) and, for a real device, a
development team set on the targets.

Simulator:

```sh
xcodebuild -project "xcode/Dark Safari/Dark Safari.xcodeproj" \
  -scheme "Dark Safari (iOS)" -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' build
```

Or open the project in Xcode, pick the "Dark Safari (iOS)" scheme and run.
On the device/simulator: run the app once, then Settings → Apps → Safari →
Extensions → Dark Safari → enable it and allow it for all websites. The
popup with all controls is reachable from the puzzle/extension button in
Safari's address bar.

### Distribution

For the App Store or notarized distribution, set your team on all four
targets in Xcode (Signing & Capabilities) and archive both platform schemes.
Signed builds don't need "Allow unsigned extensions".

## Testing without Safari

`test/harness.html` and `test/harness-dark.html` run the real content script
against a stubbed `browser.storage` API; `test/popup-harness.html` does the
same for the popup. Serve the repo root and open them:

```sh
python3 -m http.server 8642
# http://localhost:8642/test/harness.html
```

`test/plain.html` has no stubs — it only turns dark when a real extension
build is active in the browser, which makes it useful for verifying the
Safari install.
