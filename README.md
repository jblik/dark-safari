# Dark Safari

A Safari web extension that adds a configurable dark mode to any website —
including sites that don't support `prefers-color-scheme`. Sites that already
ship a dark theme are detected automatically and left alone.

## Features

- Dark mode via CSS filters on every site; photos, video, and canvas keep
  their natural colors
- Brightness, contrast, and warmth sliders, plus a grayscale toggle
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
| `xcode/Dark Safari/` | Xcode project wrapping the extension for macOS + iOS |

## Installation

Prerequisites: Xcode (15+) with command line tools. The Xcode project
references `extension/` directly, so extension changes need no regeneration —
just rebuild.

An unsigned build only survives while Safari's "Allow unsigned extensions" is
ticked, which resets every time Safari quits. Signing the app makes the
extension persist across restarts; the same signing setup covers both macOS and
iOS.

1. **Get a signing certificate.** In Xcode → Settings → Accounts, add your
   Apple ID. A free Apple ID ("Personal Team") issues an *Apple Development*
   certificate, which is enough for the extension to persist on your own
   devices.
2. **Assign the team.** For all four targets — `Dark Safari` and
   `Dark Safari Extension` on both macOS and iOS — open Signing & Capabilities,
   keep "Automatically manage signing" checked, and set Team to your account.
   (There are no entitlements or app groups to reconcile.) If a Personal Team
   reports the bundle IDs as taken, change the `com.jblik` prefix to something
   unique.

### macOS

Build Release and install to `/Applications` (a shared location — `sudo` — so
every user account on the Mac can see the app):

```sh
xcodebuild -project "xcode/Dark Safari/Dark Safari.xcodeproj" \
  -scheme "Dark Safari (macOS)" -configuration Release \
  -derivedDataPath xcode/DerivedData build
sudo cp -R "xcode/DerivedData/Build/Products/Release/Dark Safari.app" /Applications/
open "/Applications/Dark Safari.app"
```

Launching the app registers the extension with Safari. Extension enablement is
per-user: in each macOS account, Safari → Settings → Extensions → enable
**Dark Safari**, then grant website access ("Always Allow on Every Website", or
per-site via the toolbar button). Because the app is properly signed it stays
enabled across restarts — no "Allow unsigned extensions" needed. Other users
may see a one-time Gatekeeper prompt on first launch.

Verify the signature:

```sh
codesign -dv --verbose=4 "/Applications/Dark Safari.app" 2>&1 \
  | grep -E "Authority|TeamIdentifier"
```

You should see an "Apple Development" (or "Developer ID Application") authority
and your Team ID — not `adhoc`.

### iPhone / iPad

The iOS targets share the same extension sources; you need the iOS platform SDK
installed (Xcode → Settings → Components). Open the project in Xcode, pick the
**Dark Safari (iOS)** scheme, select your connected device, and press Run —
this builds, signs, and installs the app on the device.

On a Personal Team build, the first launch is blocked until you trust the
profile: on the device, Settings → General → VPN & Device Management → your
Apple ID → Trust.

Then enable the extension: Settings → Apps → Safari → Extensions → Dark Safari
→ turn it on and allow it for all websites. The popup with all controls is
reachable from the puzzle/extension button in Safari's address bar.

