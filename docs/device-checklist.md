# Device checklist

Manual tests that cannot be verified by the automated tests. Each item is **manual device test required** until the owner has run it and recorded the result here. The release checklist at the end (M17 S5) is the list to run on a real Android tablet before every release; the M16 tables above are the detailed items it builds on.

Result column: `todo` | `ok` | `fail (note)`.

## M16 S2 — Android immersive mode, keep awake, back button (PLT-005, PLT-006, PLT-007)

| # | Test | Req | Result |
|---|---|---|---|
| S2-1 | Enter presentation mode: status bar and navigation bar are hidden. | PLT-006 | todo |
| S2-2 | A swipe from a screen edge shows the bars transiently; they hide again by themselves. | PLT-006 | todo |
| S2-3 | On a device with a display cutout or rounded corners, the slide draws under the cutout; the progress line and the slide stay inside the bottom inset (`env(safe-area-inset-bottom)`). | PLT-006 | todo |
| S2-4 | Leave presentation mode: system bars are back, the layout is as before (no jump). | PLT-006 | todo |
| S2-5 | The screen stays on for 5 minutes without touch in presentation mode, and may time out normally after leaving it. | PLT-005 | todo |
| S2-6 | Open a system dialog (for example the share sheet or a permission prompt) from presentation mode and dismiss it: the bars are hidden again. | PLT-006 | todo |
| S2-7 | Back in presentation mode returns to annotation mode (the app stays open). | PLT-007 | todo |
| S2-8 | Back with a popup open closes the popup first. | PLT-007 | todo |
| S2-9 | Back in annotation mode with nothing open minimizes the app. | PLT-007 | todo |

PLT-006 and PLT-007 stay `todo` in `docs/requirements.md` until every item above is `ok`.

## M16 S3 — Android file access in place and "Open with" (PLT-008, FIL-018, FIL-019)

| # | Test | Req | Result |
|---|---|---|---|
| S3-1 | Open file: pick a PDF (and two at once); each opens in a tab. | PLT-008 | todo |
| S3-2 | Annotate, wait for the autosave, close the tab and reopen the file from the recent list: the ink is there. | PLT-008 | todo |
| S3-3 | Edit in place: after the autosave, open the same file in another viewer (for example the system PDF viewer) and check that the ink is in it. | PLT-008 | todo |
| S3-4 | Restart the app (swipe it away): the reopen of a picked file works without a new permission prompt (`isPersisted`). | PLT-008 | todo |
| S3-5 | "Open with" from the Files app, from a provider that grants write access: the file opens in a tab, read-write, and saves in place. | FIL-018 | todo |
| S3-6 | "Open with" from a source that grants read access only (for example a mail attachment): the file opens read-only (lock icon); "save a copy" writes a new file through the system dialog. | FIL-018, FIL-016 | todo |
| S3-7 | "Open with" while the app is already running: the file opens as a further tab, no second instance. Cold start with "Open with" also opens the file. | FIL-018 | todo |
| S3-8 | Save a copy: the system "create document" dialog appears; cancelling it changes nothing; accepting writes a valid PDF. | PLT-008 | todo |
| S3-9 | A 30 MB PDF opens in at most 10 s and the app stays responsive (scrolling, toolbar) during the read and during a save. | PLT-008, NFR | todo |
| S3-10 | Kill the app (force stop) during a save of a large file, then reopen: the file still opens, or the original can be recovered from "save a copy" (LIM-011, the truncating write is not atomic). | LIM-011 | todo |
| S3-11 | Web, desktop Chromium with the installed PWA: right-click a PDF, "Open with" CodexMusicae: it opens in a tab; a second file goes to the running window. | FIL-019 | todo |

PLT-008 and FIL-018 stay `todo` in `docs/requirements.md` until every Android item above is `ok`.

## M16 S4 — Tab and position restore (NFR-015)

| # | Test | Req | Result |
|---|---|---|---|
| S4-1 | Open two PDFs, go to a later slide in one and scroll the other in organization mode, force-stop the app, start it again: both tabs are back, the last active tab is selected, the mode is annotation mode. | FIL-011, FIL-012 | todo |
| S4-2 | The slide position and the organization scroll position of each tab are back (the slide shows the system it showed before). | FIL-014 | todo |
| S4-3 | Leave the app in presentation mode, force-stop it, start it again: annotation mode, not presentation. | FIL-012 | todo |
| S4-4 | Revoke access to a file (move or delete it), restart: its tab shows the needs-re-open icon; one tap offers the picker, the picked file keeps the stored position. | FIL-013 | todo |
| S4-5 | Draw, then force-stop the app immediately: after the restart at most the changes since the last autosave are lost (autosave delay), the session itself is current. | NFR-015 | todo |
| S4-6 | Let the system kill the WebView (background the app, open other heavy apps), return: tabs and positions are back. | NFR-015 | todo |

NFR-015 stays `todo` in `docs/requirements.md` until S4-5 and S4-6 are `ok`.

## Release checklist (M17 S5, TST-006, NFR-016)

Owner, real Android tablet, before every release. Copy this section for each run, fill in the header and tick the items.

```
Device: ______  Android: ____  WebView/Chrome: ____  App version (info icon): ____  Date: ____
```

- [ ] Install from Firebase App Distribution; the app starts offline (airplane mode).
- [ ] Open a 100+ page PDF; time to first slide (< 8 s): ____ s; scroll organization mode: smooth? _NFR-016, TST-008_
- [ ] Detection finished; bars correct on 3 sample pages. _DET-001, DET-003_
- [ ] Annotation mode: slide change latency feels instant (< 0.2 s). _NFR-001_
- [ ] Draw with finger (and stylus): no visible lag; undo/redo; eraser. _NFR-002, ANN-005, ANN-006_
- [ ] Bluetooth pedal: next / previous in annotation and presentation; holding the pedal does not skip. _NAV-001_
- [ ] Presentation: system bars hidden, content under the cutout, screen stays on 5 min, back button leaves, back in annotation minimizes. _PLT-005, PLT-006, PLT-007_
- [ ] Rotate the device in all three modes: layout and slide recomputed, position kept. _FIL-014_
- [ ] In-place save: edit, close, reopen; open the file in another viewer: ink visible. _PLT-008, SAV-011_
- [ ] "Open with" from the Files app (and read-only case: lock icon, save a copy works). _FIL-018, FIL-016_
- [ ] Kill the app while drawing: restart restores tabs and positions; unsaved loss only since the last autosave. _FIL-011, FIL-013, NFR-015_
- [ ] Large file (30 MB) opens < 10 s; app responsive. _PLT-008_
- [ ] Memory: open 3 large PDFs in tabs, switch tabs: no crash. _NFR-004, NFR-016_
- [ ] Stylus (tablet with a stylus): the pen draws with hover and the palm resting on the screen, no stray marks; finger swipes and taps turn slides while the pen tool is active; "allow finger drawing" in the pen popup makes fingers draw again. Note device and stylus: ____ _STY-001, STY-002, STY-003, STY-004_

Notes:

NFR-016 and the device part of TST-006 stay `todo` in `docs/requirements.md` until a run of this list is recorded as `ok`. The automated budgets (`perf` job) measure a desktop Chromium, not this tablet.
