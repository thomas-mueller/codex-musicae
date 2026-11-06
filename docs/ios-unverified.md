# iOS app — what is unverified and how to check it (PLT-013, PLT-014)

_Owner note (delete this block before sending): send this file (and, for route A, an invitation to the Firebase tester group, see `docs/ios-distribution.md`) to anyone with a Mac, an iPad or an iPhone who offers to help. Collect the filled-in checklist (section 5) in a message or a shared note. Results: items 1–8 all OK → PLT-013 `done`; everything on the checklist tried on a device → PLT-014 `done` and the `UNVERIFIED(ios)` markers of the verified files may go; problems → bug reports (or `docs/questions.md`). The statuses stay `todo` until then._

---

## 1. What this is

CodexMusicae also exists as an iOS app (Capacitor shell with Swift plugins). Nobody who works on it owns a Mac, so the Swift code was only ever compiled by a CI job, never run. Everything below is **unverified until you have run it on an iPad or iPhone** — please do not assume anything works. This document is for the native app only; the web app in Safari has its own checklist (`docs/tester-checklist-ios-safari.md`).

## 2. Get the app

**Route A — a build from the owner (easiest).** If the owner has set up ad hoc distribution (`docs/ios-distribution.md`), you get an invitation from Firebase App Distribution; opening it on your device registers your device (the owner then sends you a new build that contains your device). Install it from the Firebase page.

**Route B — build it yourself with Xcode and a free Personal Team.**

1. Needs a Mac with Xcode (iOS 16.4 SDK or newer), Node.js 24 (see `.nvmrc`), and the repository.
2. In the repository folder:
   ```bash
   npm ci
   npm run build
   npx cap sync ios
   npx cap open ios
   ```
3. In Xcode choose the project **App** → target **App** → *Signing & Capabilities*: tick *Automatically manage signing* and select your **Personal Team** (your Apple ID, free). A free account needs a bundle ID that is not taken: change it to something unique **for your local run only** (for example `app.web.codexmusicae.<yourname>`) and do not commit that change.
4. Choose an iPad or iPhone simulator or your connected device and press Run. On a real device, trust your developer profile first (*Settings → General → VPN & Device Management*). A free account's app stops working after 7 days and allows three apps at a time.
5. Note the iOS and Xcode versions for the report.

## 3. Where the unverified code is

Every Swift file carries the marker `// UNVERIFIED(ios)` in its first line. The files that cannot carry a marker are listed separately.

| File | What it must do | Checked by (item in section 5) | Typical failure |
|---|---|---|---|
| `ios/App/App/DocumentAccessPlugin.swift` — picker | "Open" shows the Files picker for PDFs, several files at once, files stay where they are (open in place) and each gets a security-scoped bookmark. | 1, 2 | picker never appears; picked file cannot be read |
| `DocumentAccessPlugin.swift` — chunked read | Reads the file in chunks through the bridge, every access balanced with start/stop of the security scope. | 2, 10 | file does not open; memory kill with a big file |
| `DocumentAccessPlugin.swift` — write back | Saving writes a temp file and then replaces the original in one coordinated step (copy fallback if the provider refuses a replace). | 2 | "save failed" icon; ink missing after reopening the file elsewhere |
| `DocumentAccessPlugin.swift` — references | A file picked once can be reopened later without the picker (bookmark); a moved or deleted file reports "needs re-open". | 3, 11 | picker asked every time; stale file opens empty |
| `DocumentAccessPlugin.swift` — "save a copy" | Shows the export dialog (an empty file is exported first, then filled); cancelling changes nothing. | 5 | no dialog; empty or damaged PDF |
| `DocumentAccessPlugin.swift` — "Open in…" queue | Files handed to the app are queued, the web side is told, and read-only sources open read-only. | 4 | nothing opens; wrong lock state |
| `ios/App/App/AppDelegate.swift` | Passes every URL the system hands to the app to the plugin above (and still to Capacitor). | 4 | "Open in…" does nothing |
| `ios/App/App/BridgeViewController.swift` | Registers the two native plugins; hides the status bar and the home indicator while presenting. | 1, 6 | picker never appears (plugins not registered); bars stay visible |
| `ios/App/App/ImmersivePlugin.swift` | Presentation mode: bars hidden, screen kept awake; leaving restores both. | 6, 7 | bars visible; screen dims; bars stay hidden afterwards |

Not markable (checked by the compile and by `npm run lint`, but not on a device):

| File | What it must do | Checked by |
|---|---|---|
| `ios/App/App.xcodeproj/project.pbxproj` | Deployment target iOS 16.4, bundle ID, the Swift files are part of the build. | 1 |
| `ios/App/App/Info.plist` | PDF is a supported document type (open in place), so the app is offered in Files / "Open in…". | 4 |
| `ios/App/App/Base.lproj/Main.storyboard` | Uses `BridgeViewController` as the web view controller. | 1, 6 |
| `ios/App/App/Assets.xcassets/` | Placeholder app icon and launch image (just grey with the icon). | 1 |
| `.github/workflows/ios.yml` (signed steps) | Signs an ad hoc build and uploads it (route A). | — (owner) |

## 4. Before you start

Please fill in: device model ____  iOS version ____  Xcode version (route B) ____  route A / B ____  version text from the app (tap the "i" info icon) ____

Have two PDFs ready in the Files app (one in *On My iPad/iPhone*, one in iCloud Drive if you use it), and a PDF as a mail attachment or in a chat if you can. For item 10 any scanned score of about 50 MB will do.

## 5. Checklist

Answer each with **OK / problem / not tested**; for a problem write what you saw.

| # | Test | Answer |
|---|---|---|
| 1 | The app starts and shows the start screen (no white screen, no crash). Tap the folder icon: the Files picker for PDFs appears. | |
| 2 | Pick a PDF: it opens in a tab. Draw a few strokes in pen mode and wait for the save (the save icon settles). Open the same file in the Files app or another PDF app: is your writing in it? | |
| 3 | Close the app completely (swipe it away), start it again: your tab is back, and the file saves again without asking you to pick it. | |
| 4 | In the Files app open a PDF with "Open in… / Share → CodexMusicae" (or tap it): it opens as a tab, read-write, while the app is running **and** when the app was closed. Do the same with a PDF from a mail attachment: it opens with the lock icon (read-only). | |
| 5 | Tap the three-dots icon, then the download icon ("save a copy"): the system save dialog appears. Cancel it: nothing happens. Do it again and confirm: open the new file in another app — is it a valid PDF with your writing? | |
| 6 | Tap the middle of the page: presentation mode. Are the status bar and the home indicator hidden? Leave it with the middle tap: are they back and the layout as before? | |
| 7 | In presentation mode leave the device alone for about 3 minutes: the screen stays on. After leaving presentation mode, does it sleep normally again? | |
| 8 | Rotate the device (and, on an iPad, use full screen/split view if you like): does the layout adapt? Is nothing hidden behind the notch or the home indicator? | |
| 9 | Pedal or keyboard (if you have one): next/previous slide works. | |
| 10 | A PDF of about 50 MB opens, the app stays responsive while it loads and saves, and is not killed by the system. | |
| 11 | Move or delete a file that was open in the app, close and restart the app: its tab shows the "needs re-open" icon; one tap offers the picker and the picked file keeps the old position. | |

Anything else odd or slow? Please write it down.

## 6. How to report

- Which item(s) and **OK / problem** per item, plus the table in section 4.
- Screenshots of what you saw (a screen recording is even better for items 2–6).
- The version text from the "i" info icon.
- For a crash or a blank screen: the Xcode console output (route B: the debug area at the bottom of Xcode, or *Window → Devices and Simulators → Open Console* for a connected device).
- Send everything to the owner.
