# Device checklist

Manual tests that cannot be verified by the automated tests. Each item is **manual device test required** until the owner has run it and recorded the result here. M17 completes this list.

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
