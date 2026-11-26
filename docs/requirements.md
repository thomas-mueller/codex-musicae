# Requirements — CodexMusicae

Read only the IDs your milestone file lists (use `grep -n "DET-005" docs/requirements.md`). Do not read this whole file.

## Format

`- **TOPIC-nnn** [target·status·milestone] Statement. _P: platform note._`

- **ID:** never reused or renumbered. Removed items stay with status `dropped`.
- **target:** `v1` | `v1-optional` | `v2` | `backlog` (backlog items live in `docs/limitations.md` until promoted).
- **status:** `todo` | `done` | `changed` | `dropped`. Set `done` only when the tests for the ID pass.
- **milestone:** `M<n>` (see `docs/roadmap.md`; for target `v2` it is a V2 milestone of `docs/roadmap-v2.md`, file `docs/milestones/V2-Mnn.md`). Every ID belongs to exactly one milestone.
- A V1 entry that V2 changes or removes keeps its text and gets status `changed` or `dropped` with the note *(Changed in V2 → ID, V2-Mn.)*; the new behavior is the named `v2` entry. Old texts and the map from the V2 requirement IDs (`docs/v2-requirements.md`) to these IDs are in `docs/changelog.md`.
- `T:path` refers to a value in `src/config/tunables.ts`.
- Statements are testable. If you find one that is not, add it to `docs/questions.md` and stop; do not guess.

## Glossary

- **System:** one detected rectangle containing one line of music (all staves of that line). Systems are numbered 1..N in print order across all pages that have systems.
- **Page display space:** the pdf.js scale-1 viewport of a page (CropBox and `/Rotate` applied), origin top-left, unit PDF points. All stored geometry uses it.
- **Junction:** a cut point between consecutive systems. Junction 0 is before system 1, junction k (1..N-1) is between system k and k+1, junction N is after system N.
- **Bar:** the translucent horizontal band that represents a junction on one page in organization mode. A junction has one bar, or two when it lies on a page change (bottom bar of page p and top bar of page p+1).
- **Padding:** the median vertical gap between consecutive systems on a page. **Padded area:** a system's box expanded by the padding on all sides, clamped to the page.
- **Playing order:** the sequence of **entries**; each entry is one occurrence of a system. **Arrival:** the playing position being at a junction (at start, after a forward step, or after a jump). **Pass n:** the n-th arrival at a junction.
- **Region:** the merged padded areas of consecutive entries that are adjacent in print order on the same page.
- **Slide:** a group of consecutive entries shown together. **Fit scale:** the scale at which the slide (annotation, presentation) or page width (organization) fits the available area.
- **Orientation:** landscape if viewport width ≥ height, else portrait.

V2 terms (target `v2` entries):

- **System side:** the left side (start) or the right side (end) of a system. Marks are stored on a system side; `core/` derives the junctions from them (right side of system k = junction k, left side of system k = junction k−1).
- **Mark:** start mark, jump start, jump target, bookmark, stop or slide break, stored on one system side. **Start mark:** the mark where the playing order begins. **Bookmark:** a labelled mark without effect on the playing order.
- **System on page:** the 1-based number of a system among the systems of its page, in reading order (top to bottom, then left to right).
- **Cross-file reference:** a jump target or bookmark in another file, stored in the source file as target file name, page and system on page.
- **File entry:** the top-bar control for the current file that replaces the V1 tabs; "tab" in V1 entries means an open file.
- **Edition:** free (Android, iOS), paid (Android, iOS) or web (behaves as free). **Feature switch:** an on/off value per feature in the feature-configuration file of a build.

---

## GEN — General

- **GEN-001** [v1·done·M1] The app title, PWA name and launcher name are `T:identity.appName`.
- **GEN-002** [v1·changed·M3] The Android applicationId and Capacitor appId are `T:identity.appId`. *(Changed in V2 → GEN-011, V2-M3.)*
- **GEN-003** [v1-optional·changed·M18] The iOS bundle ID is `T:identity.appId`. *(Changed in V2 → GEN-011, V2-M3.)*
- **GEN-004** [v1·done·M0] The GitHub repository is private and has no license file; only built apps (web, Android, optionally iOS) are distributed.
- **GEN-005** [v1·done·M8] PDF content is processed on the device only; no network request carries PDF content or PDF-derived data.
- **GEN-006** [v1·done·M1] The app has no account, no backend beyond static hosting, no analytics and no crash reporting.
- **GEN-007** [v1·done·M7] The app has a single light theme; there is no dark mode.
- **GEN-008** [v1·done·M7] Every area not covered by PDF content (around the slide, filler outside the page, the empty state) uses `T:colors.canvasGrey`.
- **GEN-009** [v1·changed·M7] Every control is an icon from the icon set; visible text is limited to numbers, the version string and error codes. *(Changed in V2 → GEN-013, V2-M5.)*
- **GEN-010** [v1·done·M7] Every icon-only control has an accessible label from the translation files.
- **GEN-011** [v2·done·M3] The free and the paid app have distinct application IDs (Android `applicationId`, Capacitor `appId`, iOS bundle ID), both in `src/config/tunables.ts` (`T:identity.appId` for free plus one value for paid).
- **GEN-012** [v2·done·M3] A static check fails when an analytics or crash-reporting package is a dependency.
- **GEN-013** [v2·todo·M5] Controls stay icons; visible text is limited to numbers, the version string, error codes, file names, mark labels and user texts, text annotations, the settings mode, dialogs and hint bubbles.

## I18 — Localization

- **I18-001** [v1·done·M1] All user-visible strings come from translation files through the translation layer; a lint rule fails the build on text literals in templates.
- **I18-002** [v1·changed·M1] A second language can be added by adding one translation file, without code changes. v1 ships English only. *(Changed in V2 → I18-003, V2-M5.)*
- **I18-003** [v2·todo·M5] The app has translation files for English, German, Spanish, French, Italian, Portuguese (Brazil) and Dutch; a test fails when a key of the English file is missing in another file.
- **I18-004** [v2·todo·M5] The language follows the system language, can be changed in the General settings group, and falls back to English when the system language is not available.
- **I18-005** [v2·todo·M16] All seven translation files are complete: no value is copied from English and every parameter placeholder matches the English one.
- **I18-006** [v2·todo·M16] In every language no text is cut off on any screen (top bar, settings, popups, dialogs, hint bubbles) in the phone and tablet profiles.
- **I18-007** [v2·todo·M19] Before release the six non-German languages are reviewed by native speakers; a language without review is published marked as machine-assisted or removed (owner decision).

## FIL — Files and tabs

- **FIL-001** [v1·done·M8] The open-file control opens the platform file picker for PDFs with multiple selection; each selected PDF opens in its own tab.
- **FIL-002** [v1·done·M8] Opening a PDF that is already open focuses its existing tab. Same file means: `isSameEntry` (web handles), same URI (Android), else equal name, size and last-modified time.
- **FIL-003** [v1·changed·M8] Each tab shows the file name, a close icon and a status marker (unsaved dot, error icon, read-only lock icon, needs-re-open icon). *(Changed in V2 → FIL-021, V2-M6.)*
- **FIL-004** [v1·changed·M8] In expanded layout the tabs are a tab bar; in compact layout one button shows the current tab name and opens the list of all tabs. *(Changed in V2 → FIL-023, V2-M6.)*
- **FIL-005** [v1·done·M8] Switching tabs keeps the global mode, tool and tool settings; per tab are position, zoom, aspect-ratio override, undo history and document data.
- **FIL-006** [v1·done·M15] Closing a tab saves it first; if saving fails the tab stays open and shows the error icon.
- **FIL-007** [v1·done·M7] With no tab open, all chrome stays visible, the PDF area shows only canvas grey, controls that need a document are disabled, open-file and recent files stay enabled.
- **FIL-008** [v1·changed·M8] A recent-files list (max `T:resources.recentFilesMax`, newest first) opens from the open-file control; selecting an entry reopens it, or asks to re-pick the file if access is lost. *(Changed in V2 → FIL-026, V2-M6.)*
- **FIL-009** [v1·done·M8] An encrypted, damaged or zero-page PDF opens as a tab in error state (error icon, tooltip with reason); it never crashes the app.
- **FIL-010** [v1·done·M15] While a tab has pending changes it shows the unsaved dot; it disappears after a successful save.
- **FIL-011** [v1·done·M16] At startup the app reopens the previous tabs, selects the last active tab and restores each tab's position.
- **FIL-012** [v1·changed·M16] After startup the mode is annotation mode, even if the app was closed in presentation mode. *(Changed in V2 → FIL-048, V2-M16.)*
- **FIL-013** [v1·done·M16] A tab whose file access cannot be restored shows the needs-re-open state; one tap re-picks the file or re-grants permission.
- **FIL-014** [v1·done·M16] The persisted position per tab is the playing-order system index of the first entry on the current slide plus the organization-mode page and scroll offset.
- **FIL-015** [v1·done·M8] The preferences store (`T:persistence.keyPrefix`) holds UI state and file references only, never PDF-derived data. _P: web stores file handles in IndexedDB, other values in localStorage; Android uses Capacitor Preferences._
- **FIL-016** [v1·changed·M15] If a file cannot be written, its tab shows the read-only lock icon and offers "save a copy"; ink, jumps and breaks stay editable in memory. *(Changed in V2 → FIL-039, V2-M6.)*
- **FIL-017** [v1·todo·M15] "Save a copy" writes the modified PDF to a new file. _P: web download or save picker; Android document-create intent._
- **FIL-018** [v1·todo·M16] The Android app is offered for PDF `VIEW` intents ("Open with…") and opens the file in a tab, requesting write access.
- **FIL-019** [v1·done·M16] The PWA manifest registers a PDF file handler. _P: effective only in desktop Chromium._
- **FIL-020** [v2·todo·M6] There is no Save button; files are saved by autosave only (SAV-008 triggers).
- **FIL-021** [v2·todo·M6] The top bar shows one entry for the current file containing, in this order, the file name, a status marker and a close icon.
- **FIL-022** [v2·todo·M6] The status marker of the file entry shows modified (unsaved changes), error, read-only lock or needs-re-open, always at the same position; in free and web it is the only change indicator.
- **FIL-023** [v2·todo·M6] A click on the file entry opens the list of all open files; there is no tab bar in any layout.
- **FIL-024** [v2·todo·M6] Previous-file and next-file buttons without labels sit left and right of the file entry; each is disabled at the first or last open file.
- **FIL-025** [v2·todo·M6] A "+" button right of the next-file button opens the file picker; it replaces the V1 open-file control.
- **FIL-026** [v2·todo·M6] A long press on "+" opens the recent-files list (FIL-008 contents and behavior); in free and web the list is switched off (EDN feature switch).
- **FIL-027** [v2·todo·M6] The file entry takes the remaining top-bar width and the file list is full width; a name is shortened with an ellipsis only when it does not fit.
- **FIL-028** [v2·todo·M6] Open files are listed in opening order and cannot be reordered.
- **FIL-029** [v2·todo·M6] The Android app accepts PDFs shared through `SEND` intents (share sheet) in addition to `VIEW` and opens them like picked files.
- **FIL-030** [v2·todo·M6] The iOS app accepts PDFs from the share sheet and "Open with" through the URL-open event (`UNVERIFIED(ios)`).
- **FIL-031** [v2·todo·M6] There is no limit on the number of open files and no automatic closing or eviction of open files.
- **FIL-032** [v2·todo·M6] Files opened because they are referenced look and behave like every other open file.
- **FIL-033** [v2·todo·M6] Before the first write of a file in a session an overwrite dialog is shown; it appears at most once per file per session.
- **FIL-034** [v2·todo·M6] Until the overwrite dialog is answered nothing is written; the changes stay in memory and the modified marker stays.
- **FIL-035** [v2·todo·M6] The save scheduled after detection (SAV-012) also waits for the overwrite dialog.
- **FIL-036** [v2·todo·M6] The overwrite dialog offers Overwrite, Save as new file and Cancel; Cancel writes nothing.
- **FIL-037** [v2·todo·M6] "Save as new file" writes to a new location chosen by the user, which then becomes the file of that entry.
- **FIL-038** [v2·todo·M6] The overwrite dialog can be switched off for the current file or for all files; the choice persists across sessions where persistence is switched on.
- **FIL-039** [v2·todo·M6] A file that cannot be written shows one warning per file per session offering "Save as new file"; the modified marker stays.
- **FIL-040** [v2·todo·M6] A shared-in copy without write access opens read-only.
- **FIL-041** [v2·todo·M6] Per-file choices are identified by the file name only, stored in the local settings and cleared by "Reset all settings".
- **FIL-042** [v2·todo·M6] Opening a file with cross-file marks tries to open every referenced file, looked up by file name among the open files and the files with persisted access (Android URI permission, iOS bookmark, web handle where persistence is on).
- **FIL-043** [v2·todo·M6] When a referenced file cannot be opened (no match, several matches or no file access), a warning appears, the metadata stays unchanged and the user can open the file manually.
- **FIL-044** [v2·todo·M6] Closing a file that is referenced by another open file keeps the marks and shows a warning at once with "Don't show again" (persisted, cleared by "Reset all settings").
- **FIL-045** [v2·todo·M6] Referenced files open in the background; the current file stays current.
- **FIL-046** [v2·todo·M6] In free and web, closing a modified file asks for confirmation every time; confirming drops the changes.
- **FIL-047** [v2·todo·M6] A file without unsaved changes, including a read-only one, closes without asking.
- **FIL-048** [v2·todo·M16] A newly opened file without embedded systems opens in organization mode; a file with embedded systems opens in annotation mode.

## SAV — Saving and embedded data

- **SAV-001** [v1·done·M15] App data is embedded as one PDF file attachment named `T:saving.metadataFileName` in the `/EmbeddedFiles` name tree; the PDF stays valid and other viewers ignore it.
- **SAV-002** [v1·done·M15] The embedded JSON has an integer `schemaVersion` (`T:saving.schemaVersion`) and is validated by a schema on read.
- **SAV-003** [v1·done·M15] Older schema versions are upgraded on read by migration functions; a newer unknown version is ignored and never overwritten.
- **SAV-004** [v1·changed·M15] The JSON contains: `schemaVersion`, `appVersion`, `pageCount`, detection level, system rectangles per page, jumps, breaks, stops, and optional aspect-ratio overrides per orientation. *(Changed in V2 → SAV-015, V2-M4.)*
- **SAV-005** [v1·done·M15] If the embedded `pageCount` differs from the PDF, the embedded data is discarded and detection runs again.
- **SAV-006** [v1·done·M15] Strokes are saved as standard PDF Ink annotations (`/Subtype /Ink`) with `/InkList`, color, border width, opacity (highlighter) and an appearance stream, so other viewers display them.
- **SAV-007** [v1·done·M14] A stroke is stored in the PDF user space of the page it belongs to, with the PDF's own transform (CropBox, `/Rotate`) applied inversely.
- **SAV-008** [v1·done·M15] Saving triggers: `T:saving.autosaveIdleMs` after the last change, tab switch, tab close, app hidden or paused. Saving never starts while a stroke is in progress.
- **SAV-009** [v1·done·M15] A save builds the complete file bytes in memory first and only then writes; on failure the in-memory state is kept, the tab shows the error icon and the next trigger retries.
- **SAV-010** [v1·done·M15] Saving runs in a worker and does not block drawing or rendering.
- **SAV-011** [v1·todo·M15] Where the platform allows, saving writes to the same file. _P: web in-place only in Chromium (File System Access); Safari and Firefox offer "save a copy" only._
- **SAV-012** [v1·done·M15] After detection completes on a writable file, a save is scheduled so that later opens find embedded detection data and skip detection.
- **SAV-013** [v1·done·M15] Existing annotations of other apps and existing attachments are preserved on save, except ink removed by the eraser (ANN-005).
- **SAV-014** [v1·done·M15] Ink annotation edits made in a tab persist across tab switches within the session even if saving failed.
- **SAV-015** [v2·todo·M4] A new `schemaVersion` stores marks per system and side, the start mark, bookmarks, user texts of marks and cross-file references.
- **SAV-016** [v2·todo·M4] V1 data is migrated on read: a jump origin at junction k goes to the right side of system k, a jump target at junction k to the left side of system k+1, a break or stop at junction k to the right side of system k; V1 files keep opening. A V1 jump with origin junction 0 or target junction N has no system side: a reached pass-1 jump from junction 0 becomes the start mark and a reached jump to junction N becomes a stop, only if all such conversions together keep the V1 playing order and slide breaks; every other such jump is dropped.
- **SAV-017** [v2·todo·M4] Saving writes the new schema only.
- **SAV-018** [v2·todo·M12] Text and stamp annotations are saved as standard PDF annotations with appearance streams, so that other viewers display them, and the app reads them back as editable text and stamps.

## DET — Detection

- **DET-001** [v1·done·M10] When a PDF has no valid embedded data, detection runs automatically for all pages in page order in the background.
- **DET-002** [v1·done·M10] Detection runs in one dedicated web worker, one page at a time, and never blocks the UI thread.
- **DET-003** [v1·changed·M10] A page is rendered to a bitmap at the level's `renderScale`; if width×height exceeds `T:resources.maxCanvasPixels` the scale is reduced to fit. *(Changed in V2 → DET-030, V2-M8.)*
- **DET-004** [v1·changed·M10] The bitmap is converted to gray and binarized with the adaptive mean threshold (`THRESH_BINARY_INV`, ink = foreground; block size and constant per level, `T:detection.levels`); the bounding rectangle and the pixel area of every 4-connected component are collected. The background component (label 0) is not collected. *(Changed in V2 → DET-033, V2-M8.)*
- **DET-005** [v1·done·M5] Selection step 0: without components there are no systems; the pixel areas of all components form the list the threshold is computed from. The function does not modify its input.
- **DET-006** [v1·done·M5] Selection step 1: sort the areas descending and find the first largest gap between consecutive areas (a later equal gap does not replace it); the threshold is the smaller area after that gap, and 0 with a single component. A component qualifies by area if its area is strictly greater than the threshold.
- **DET-007** [v1·done·M5] Selection step 2: a component narrower than `minSystemWidthRatio` × bitmap width is never a system, whatever its area; a width exactly at the limit stays.
- **DET-008** [v1·done·M5] Selection step 3: a component at least `fullWidthSystemRatio` × bitmap width wide is a system whatever its area; otherwise it must qualify by area (DET-006).
- **DET-009** [v1·done·M5] The result is sorted top to bottom (ties left to right); boxes are normalized by the bitmap size and converted to page display space.
- **DET-010** [v1·done·M5] The padding of a page is the median gap between consecutive systems on that page; a page with fewer than two systems uses the median over all pages; if no gap exists, `T:detection.fallbackPaddingPageHeightRatio` × page height.
- **DET-011** [v1·done·M5] A system's padded area is its box expanded by the padding on all four sides, clamped to the page bounds.
- **DET-012** [v1·done·M10] Pages without systems take no part in junctions, slides or the playing order; organization mode shows them as plain PDF pages.
- **DET-013** [v1·changed·M10] Three levels `fast`, `standard`, `fine` each define `minSystemWidthRatio`, `fullWidthSystemRatio`, `renderScale`, `adaptiveBlockSize` and `adaptiveC` (`T:detection.levels`); the default is `T:detection.defaultLevel`. `renderScale` is bitmap pixels per PDF point, written as dpi / 72: `fast` 100 dpi, `standard` 150 dpi, `fine` 200 dpi (ASM-09). *(Changed in V2 → DET-030, V2-M8.)*
- **DET-014** [v1·changed·M11] Organization mode offers a level selector (three icon steps); choosing a level asks for confirmation and then re-runs detection. *(Changed in V2 → DET-030, V2-M8.)*
- **DET-015** [v1·done·M11] During a re-run the previous results stay active; at completion they are swapped in, and jumps, breaks and stops are kept only if the total system count is unchanged, else cleared.
- **DET-016** [v1·changed·M10] Organization mode shows detection progress (processing icon, processed/total pages); slide modes show the slide count as "n+" until detection is complete. *(Changed in V2 → ORG-032, V2-M8.)*
- **DET-017** [v1·changed·M10] Detection pauses while the user interacts (resumes after `T:detection.idleBeforeResumeMs` without input), while the app is hidden, and under battery saver where detectable. *(Changed in V2 → DET-027, V2-M8.)*
- **DET-018** [v1·done·M10] If a page fails (error or out of memory), it is retried once at `renderScale` × `T:detection.retryScaleFactor`; if it fails again the page is marked not detected and processing continues.
- **DET-019** [v1·done·M10] Slides and organization bars are usable for every page whose prefix of earlier pages is finished while later pages are still processing.
- **DET-020** [v1·done·M10] Bitmaps are released after each page; only rectangles are retained.
- **DET-021** [v1·done·M10] Navigating to an unfinished page in organization mode makes it the next page processed; its bars are drawn provisional (`T:colors.orgBar.provisionalOpacity`, no numbers, not selectable) until all earlier pages are finished.
- **DET-022** [v1·done·M10] Detection results are cached in runtime memory only.
- **DET-023** [v1·done·M15] If valid embedded detection data exists, detection is skipped.
- **DET-024** [v1·done·M5] Page width, padding and thresholds are computed per page; documents with mixed page sizes are supported.
- **DET-025** [v2·todo·M8] A short click on the detection tool offers: rerun all pages, rerun the current page, cancel.
- **DET-026** [v2·todo·M8] Rerunning the current page replaces only that page's systems and is one undoable step.
- **DET-027** [v2·todo·M8] On the web detection continues while the app is hidden (the browser may throttle it).
- **DET-028** [v2·todo·M8] On Android and iOS detection pauses while the app is in the background and resumes on return.
- **DET-029** [v2·todo·M8] A running detection cannot be cancelled; a short click on the detection tool during a run is ignored.
- **DET-030** [v2·todo·M8] A long click on the detection tool opens a parameter popup with minimum and maximum system width (unit page width), minimum and maximum system height (unit page height) and resolution in dpi; there are no level buttons.
- **DET-031** [v2·todo·M8] A component is a system only if its width and height lie within the popup limits (in addition to the area rule of DET-006 and the full-width rule of DET-008).
- **DET-032** [v2·todo·M8] The default parameters are the V1 `standard` values (150 dpi, `minSystemWidthRatio`); the defaults of the new limits are chosen on the real-PDF corpus and make no corpus entry worse than V1.
- **DET-033** [v2·todo·M8] `fullWidthSystemRatio`, the adaptive block size and the adaptive constant stay tunables and are not in the popup.
- **DET-034** [v2·todo·M8] The connected-component boxes of each detected page stay in memory until the document closes.
- **DET-035** [v2·todo·M2] The systems found on a page do not depend on the browser: detection works on the working raster of the page, reduced to the level's size inside the detection engine (area averaging, the same code in every browser), and the same corpus PDF gives the same systems per page in Chromium, Firefox and WebKit.

## PLY — Junctions and playing order (pure logic)

- **PLY-001** [v1·done·M5] For N systems the junctions are 0..N as defined in the glossary; each junction maps to its bars (one, or two at a page change).
- **PLY-002** [v1·changed·M6] The playing order is generated by this replay: set position = 0 and all arrival counts = 0; repeat: increment the arrival count at the position; if a jump exists with origin = position and pass = arrival count, set position = its target and repeat; otherwise, if position = N stop; otherwise append system position+1 to the order and set position = position+1. *(Changed in V2 → PLY-015, V2-M4.)*
- **PLY-003** [v1·changed·M6] Pass n of a jump means the n-th arrival at its origin junction, counting the start at junction 0, forward steps and jump arrivals. *(Changed in V2 → PLY-015, V2-M4.)*
- **PLY-004** [v1·done·M6] A jump arrival counts as an arrival at its target, and jumps at the target for that pass fire immediately (chaining).
- **PLY-005** [v1·done·M6] Every jump fires at most once, so generation is finite; a safety cap `T:playingOrder.maxLength` truncates the order and sets a flag.
- **PLY-006** [v1·done·M6] When several jumps share origin and pass, the earliest created wins.
- **PLY-007** [v1·changed·M6] A jump has an integer pass ≥ 1; its origin and its target may be any junction 0..N, and the target differs from the origin. A jump from junction N fires when the end is reached on that pass (D.C. at the end of a piece). *(Changed in V2 → PLY-016, V2-M4.)*
- **PLY-008** [v1·done·M6] Stops: the order is generated ignoring stops, then cut after the last arrival at a stop junction; with several stops the cut giving the shortest order wins; a jump firing at that last arrival is discarded; a stop junction never reached has no effect.
- **PLY-009** [v1·done·M6] A stop may be set at any junction 1..N-1; at most one stop per junction.
- **PLY-010** [v1·done·M6] The numbers of a system are the 1-based positions at which it occurs in the playing order; a system never played has none.
- **PLY-011** [v1·done·M6] A break at junction k forces a slide boundary between two consecutive entries whenever the playing position visited k between them (straight step, jump origin, jump target or chained jump), on every pass.
- **PLY-012** [v1·changed·M6] With no jumps, breaks or stops, the playing order is systems 1..N in print order. *(Changed in V2 → PLY-015, V2-M4.)*
- **PLY-013** [v1·done·M6] A break may be set at any junction 1..N-1.
- **PLY-014** [v2·done·M4] Junctions are derived from system sides: the right side of system k is junction k and the left side of system k is junction k−1; the replay of PLY-002…PLY-008 runs on these junctions.
- **PLY-015** [v2·done·M4] The replay starts at the left side of the system holding the start mark; this start counts as the first arrival there, and systems before it are not played. Without a start mark it starts at junction 0.
- **PLY-016** [v2·done·M4] A jump starts on the right side of a system and targets the left side of a system; it may start on the right side of the last system and target the left side of the first system.

## ORG — Organization mode

- **ORG-001** [v1·done·M9] Organization mode shows the original PDF as a normal continuous vertical-scroll viewer with small gaps between pages on canvas grey.
- **ORG-002** [v1·done·M9] Only visible pages plus `T:resources.orgRenderPagesAround` pages on each side are rendered.
- **ORG-003** [v1·changed·M9] Zoom: default on open is fit-page; the minimum is fit-page; the maximum is `T:zoom.max` × the fit-width scale; the reset button returns to fit-page; content smaller than the viewport is centered; zoom buttons step by `T:zoom.buttonStep`. *(Changed in V2 → ORG-047, V2-M13.)*
- **ORG-004** [v1·done·M9] A "page x of n" indicator shows the page covering the viewport center and updates while scrolling; n counts all pages.
- **ORG-005** [v1·done·M9] Previous/next page buttons and a page slider scroll to a page.
- **ORG-006** [v1·done·M9] Horizontal swipes do not change pages; zoom stays unchanged when the page changes.
- **ORG-007** [v1·done·M9] Drawing is not available in organization mode.
- **ORG-008** [v1·done·M10] Every junction is drawn as a translucent bar over the whitespace gap, full page width: between two systems on a page; for junction 0 from the page top to the top of system 1; for junction N from the bottom of system N to the page bottom; at a page change as two bars (bottom of page p, top of page p+1).
- **ORG-009** [v1·done·M10] Pages without systems have no bars.
- **ORG-010** [v1·changed·M10] Bars use `T:colors.orgBar.tint` at `opacity`; a selected junction uses `selectedOpacity`, on both bars of a page change. *(Changed in V2 → ORG-025, V2-M8.)*
- **ORG-011** [v1·changed·M11] Each bar shows one compact row with the stop symbol and the break scissors line. The playing-order numbers are not on the bars but on the music systems (ORG-012); jump markers sit on the systems too (ORG-018). There is no numbering toggle. *(Changed after review: the numbers and jump badges moved from the bars to the systems.)* *(Changed in V2 → MRK-001, V2-M4.)*
- **ORG-012** [v1·changed·M11] Every music system shows its playing-order numbers (PLY-010), ascending and comma separated ("3, 9"), as a label at the height of the system and horizontally centered on the page. The digits cover `T:layout.systemLabelHeightRatio` of the system height, in the light weight `T:layout.systemLabelFontWeight`, with the color and transparency of the bars (`T:colors.orgBar`). A system that is never played has no label. The bars show no numbers. System numbers in the original PDF order are not shown anywhere. *(Changed after review: formerly the numbers of the system above each bar.)* *(Changed in V2 → ORG-028, V2-M8.)*
- **ORG-013** [v1·changed·M11] Tapping a bar selects its junction; tapping empty space, Esc or back deselects. Taps in organization mode never navigate. *(Changed in V2 → ORG-025, V2-M8.)*
- **ORG-014** [v1·changed·M11] A selected junction shows a chip with icons: jump, slide break, stop, delete (delete only if the junction holds an item). *(Changed in V2 → ORG-042, V2-M10.)*
- **ORG-015** [v1·changed·M11] Jump creation: select the origin, tap the jump icon, all other bars become tappable targets with a hint bar and a cancel icon; page navigation and zoom stay active; tapping a bar creates the jump; Esc or back cancels. *(Changed in V2 → MRK-022, V2-M10.)*
- **ORG-016** [v1·changed·M11] After creation a stepper opens to set the pass number (integer ≥ 1). A new jump starts at the number of the existing jumps with the same origin plus one (first jump of a bar 1, second 2, …). *(Changed after review: the default was always 1.)* *(Changed in V2 → MRK-023, V2-M10.)*
- **ORG-017** [v1·changed·M11] Several jumps may sit on one junction; two jumps with the same origin and pass are allowed (PLY-006). There are no plausibility checks. *(Changed in V2 → MRK-002, V2-M4.)*
- **ORG-018** [v1·changed·M11] Jump markers sit on the music systems. The start is at the right edge of the source system (system `origin`), vertically centered, with the jump icon rotated by `T:layout.markerRotationDeg` (the split points toward the end of the PDF); the end is at the left edge of the system after the target junction, vertically centered, with a merge icon (arrows coming from the beginning of the PDF). Both carry the label "<previous> → <next> ×<pass>": the playing-order numbers of the system played just before the jump and the one played right after it (the numbers shown on the systems, ORG-012); a number that does not exist (start or end of the playing order) or a jump that is never reached shows `T:layout.unknownNumber`. Both ends have one color from `T:colors.jumpPalette`; several markers on a system stack from the edge. At junction 0 (no source system) the start and at junction N (no next system) the end sit on the bar of that junction. *(Changed after review: formerly badges on the bars with page·bar labels, then print numbers.)* *(Changed in V2 → MRK-009, V2-M4.)*
- **ORG-019** [v1·changed·M11] A long press (`T:layout.longPressMs`) on a jump marker scrolls to the other end of the jump. *(Changed in V2 → MRK-050, V2-M10.)*
- **ORG-020** [v1·changed·M11] Tapping a jump marker selects the jump; the chip then offers pass, change target and delete. *(Changed in V2 → MRK-044, MRK-045, V2-M10.)*
- **ORG-021** [v1·changed·M11] A marks-list button opens the list of jumps, slide breaks and stops in the order of the final playing order: an item is placed where the playing position first meets it (a jump where it fires, a stop where it ends the order). Items that are never reached follow at the end, dimmed: jumps in creation order, then breaks, then stops. Labels use playing-order numbers: jump "<previous> → <next> ×<pass>" with its color, slide break scissors icon and "<previous> | <next>", stop the stop icon and "<previous>". Compact layouts show a sheet; expanded layouts show a panel beside the button on the side of the tool strip, which never covers the viewer's scroll bar. Tapping an entry navigates to it and selects it; a swipe to the left or a trash icon deletes it. *(Changed after review.)* *(Changed in V2 → MRK-040, MRK-046, MRK-048, MRK-049, V2-M10.)*
- **ORG-022** [v1·changed·M11] The break icon toggles a slide break on the selected junction; a break shows as a solid line in `T:colors.breakLine` with a scissors icon at the left edge. *(Changed in V2 → MRK-003, V2-M4.)*
- **ORG-023** [v1·changed·M11] The stop icon toggles a stop on the selected junction; it shows the stop icon on the bar. *(Changed in V2 → MRK-003, V2-M4.)*
- **ORG-024** [v1·changed·M11] Deleting a jump, break or stop is immediate and has no undo. *(Changed in V2 → ANN-014, V2-M7.)*
- **ORG-025** [v2·todo·M8] Bars are display only; tapping a bar does nothing.
- **ORG-026** [v2·todo·M8] The Display setting "Highlight systems" fills every system with a transparent area with soft fading edges (color and opacity in tunables).
- **ORG-027** [v2·todo·M8] The Display setting "Highlight vertical-space bars" shows the bars with the V1 look.
- **ORG-028** [v2·todo·M8] The Display setting "Number systems" shows each system's number on its page (the number used in mark labels); playing-order numbers are not shown.
- **ORG-029** [v2·todo·M8] With "Highlight systems" on, system numbers get a cut-out or a contrasting color.
- **ORG-030** [v2·todo·M8] The font weight of a system number depends on the aspect ratio of the system's box (wider and flatter is bolder), mapped in tunables.
- **ORG-031** [v2·todo·M8] A system number keeps the V1 size and is reduced when it does not fit the system width, down to a minimum size in tunables.
- **ORG-032** [v2·todo·M8] Organization mode shows the page counter "x/n" at the right end of the bottom slider, as annotation mode does; during detection n is the number of processed pages followed by "+".
- **ORG-033** [v2·todo·M8] The separate V1 progress counter of organization mode is removed.
- **ORG-034** [v2·todo·M9] The refine tool draws a rectangle that is resizable by its corners and edges and is confirmed by a tap outside it or a confirm icon.
- **ORG-035** [v2·todo·M9] A long click on the refine tool opens a popup with one choice: save the rectangle as a new system box, or hint mode.
- **ORG-036** [v2·todo·M9] A saved rectangle becomes a system box at its reading-order position on the page (top to bottom, then left to right).
- **ORG-037** [v2·todo·M9] In hint mode the rectangle is replaced by the combined bounding box of the detected components lying inside it.
- **ORG-038** [v2·todo·M9] If hint mode finds no component inside the rectangle, the drawn rectangle is accepted without a message.
- **ORG-039** [v2·todo·M9] The delete tool deletes the system that is clicked; moving or splitting a system is done by deleting and redrawing it.
- **ORG-040** [v2·todo·M9] The refine and delete tools work only on pages whose detection has finished.
- **ORG-041** [v2·todo·M9] User-edited systems are saved with the metadata; rerunning all pages asks for confirmation before replacing them.
- **ORG-042** [v2·todo·M10] Organization mode offers the tools detection, refine, delete, bookmark, start, stop, jump and slide break.
- **ORG-043** [v2·todo·M10] No organization tool is active when organization mode opens.
- **ORG-044** [v2·todo·M10] Pressing the active organization tool deactivates it; at most one tool is active.
- **ORG-045** [v2·todo·M10] Choosing another tool cancels a half-defined mark.
- **ORG-046** [v2·todo·M12] Ink, text and stamp annotations are shown read-only in organization mode.
- **ORG-047** [v2·todo·M13] The organization bottom bar has the page indicator, page navigation and zoom controls: zoom in, zoom out, fit page, fit width, 100 % and a choice of percentages.
- **ORG-048** [v2·todo·M13] The organization zoom is restored on reload where persistence is switched on (paid native).

## SLD — Slide composition

- **SLD-001** [v1·done·M6] A slide's shape is the stored aspect ratio r = width / height.
- **SLD-002** [v1·done·M6] The reference width W_ref is the maximum padded-area width over all systems; every slide is W_ref wide in PDF units and W_ref / r high.
- **SLD-003** [v1·done·M6] Slides are filled greedily in playing order: add the next entry while the stack height stays ≤ slide height; a forced break (PLY-011) ends the slide.
- **SLD-004** [v1·done·M6] Consecutive entries that are adjacent in print order on the same page merge into one region whose height runs from the top of the first padded area to the bottom of the last, keeping the PDF content between them.
- **SLD-005** [v1·done·M6] Entries that are not adjacent in print order, or on different pages, form separate regions stacked directly without a gap.
- **SLD-006** [v1·done·M6] If the first region of a slide is taller than the slide height, that slide holds only that entry and is enlarged to the region's height (and height × r wide); other slides keep their scale.
- **SLD-007** [v1·done·M12] The stack is centered vertically; leftover vertical space is split equally above and below.
- **SLD-008** [v1·done·M12] Leftover space (above, below, left, right) shows real PDF content of the neighboring page area, centered on each region; anything outside the page shows canvas grey.
- **SLD-009** [v1·changed·M12] Filler that overlaps the padded area of a system not on this slide is covered, over the full slide width and the vertical extent of that area, by `T:colors.canvasGrey` at `T:colors.overlayOpacity`. *(Changed in V2 → SLD-029, V2-M13.)*
- **SLD-010** [v1·done·M12] The slide is fitted (contain) into the available area; remaining area shows canvas grey. Annotation and presentation mode use the same stored aspect ratio.
- **SLD-011** [v1·done·M12] The display scale is the same on all slides except for slides enlarged by SLD-006.
- **SLD-012** [v1·done·M12] After any change that recomputes slides (ratio, detection, jumps, breaks, stops), the current slide is the one containing the first entry of the previously shown slide.
- **SLD-013** [v1·done·M5] Aspect-ratio steps: range `T:aspectRatio.min` to `max`; "show more" moves to the next lower multiple of `T:aspectRatio.step` strictly below the current value, "show less" to the next higher multiple strictly above (1.78 → 1.7 / 1.8); results are clamped.
- **SLD-014** [v1·changed·M12] The global default ratio is stored per orientation; its first value is the presentation-mode viewport ratio captured at the first presentation entry in that orientation, before that the device screen ratio; rounded to `T:aspectRatio.roundDecimals` and clamped. *(Changed in V2 → SLD-020, V2-M13.)*
- **SLD-015** [v1·done·M12] Changing the ratio with the buttons creates or updates a per-PDF override for the current orientation, stored in the embedded data; on read-only files it exists in memory only.
- **SLD-016** [v1·done·M12] Annotation mode shows "slide x of n" with previous/next buttons and a slider; presentation mode shows no indicator.
- **SLD-017** [v1·changed·M12] "Show more" and "show less" buttons are in the bottom bar (expanded) or the overflow menu (compact), in annotation mode. *(Changed in V2 → SLD-019, V2-M13.)*
- **SLD-018** [v1·done·M12] When zoomed in, the visible part of the slide is re-rendered at higher resolution after the gesture settles; the old bitmap is stretched meanwhile.
- **SLD-019** [v2·todo·M13] The aspect-ratio decrease and increase buttons sit on the right side of the annotation-mode bottom bar in every layout and use the V1 steps (SLD-013).
- **SLD-020** [v2·todo·M13] The start value of the aspect ratio is the device full-screen ratio in the current orientation.
- **SLD-021** [v2·todo·M13] The PDF area is the largest area of the current ratio; the remaining strips are dark gray (`T:colors` value).
- **SLD-022** [v2·todo·M13] After a ratio change a highlighted rectangle and the ratio value are shown for a time set in tunables.
- **SLD-023** [v2·todo·M13] One app-wide page-break setting offers off, auto, and 1, 2, 3 or 4 slides per page.
- **SLD-024** [v2·todo·M13] Page break "off" packs slides as in V1.
- **SLD-025** [v2·todo·M13] Page break "auto" packs as in V1 plus a slide break after each page, distributing the systems of a page evenly over its slides.
- **SLD-026** [v2·todo·M13] With n slides per page (n = 1…4), each page's systems are split into n slides of about equal total height, whole systems only.
- **SLD-027** [v2·todo·M13] With n slides per page the full device screen is used, the aspect-ratio setting is ignored and the ratio buttons are disabled.
- **SLD-028** [v2·todo·M13] With n slides per page, slide breaks are ignored.
- **SLD-029** [v2·todo·M13] The areas left and right of the shown systems show the real PDF content beside them, undimmed, in annotation mode, slide mode and the n-per-page modes; filler above and below stays dimmed (SLD-009 vertical rule).

## ANN — Annotation

- **ANN-001** [v1·changed·M14] Tools are pen, highlighter, eraser. The active tool's button has the toggled look (UIX-011). *(Changed in V2 → ANN-031, V2-M12.)*
- **ANN-002** [v1·done·M14] Tapping an inactive tool activates it; tapping the active tool deactivates it; a long press on the pen or highlighter button opens the color/width popup.
- **ANN-003** [v1·changed·M14] Each tool remembers its last color and width index in the preferences store; defaults `T:annotation.defaultPen` and `defaultHighlighter`. *(Changed in V2 → ANN-024, V2-M11.)*
- **ANN-004** [v1·changed·M14] Pen and highlighter each offer 6 color presets and 3 widths (`T:colors.penPresets`, `highlighterPresets`, `T:annotation.penWidthsPt`, `highlighterWidthsPt`); the highlighter uses opacity `T:annotation.highlighterOpacity` with multiply blending. *(Changed in V2 → ANN-022, V2-M11.)*
- **ANN-005** [v1·done·M15] The eraser removes whole ink annotations whose path lies within `T:annotation.eraserHitRadiusPx` of the pointer, including ink made by other apps; it has no width setting.
- **ANN-006** [v1·changed·M14] Undo and redo cover added and erased strokes per document, up to `T:annotation.undoDepth` steps, and are cleared when the document closes. *(Changed in V2 → ANN-014, V2-M7.)*
- **ANN-007** [v1·done·M14] Drawing works only in annotation mode; entering presentation or organization mode deactivates the tool, and returning does not restore it.
- **ANN-008** [v1·done·M14] While a tool is active, one pointer draws, two pointers zoom and pan; tap zones and swipes are off; pedals, buttons, slider and wheel still navigate.
- **ANN-009** [v1·done·M14] A stroke belongs to the page of the region where it started and is stored in that page's coordinates, even where it continues over other regions or beyond the page edge.
- **ANN-010** [v1·done·M14] A stroke started on filler belongs to the page of the filler content; a stroke started on canvas grey is ignored.
- **ANN-011** [v1·done·M14] The live stroke is drawn on its own canvas layer, only new segments once per animation frame using coalesced pointer events; no per-point change detection; a finished stroke is simplified (`T:annotation.simplifyEpsilonPt`) and committed once.
- **ANN-012** [v1·done·M14] A stroke on a region shown several times in a slide appears on all occurrences.
- **ANN-013** [v1·done·M14] Navigation commands that arrive while a stroke is in progress are applied after the stroke ends.
- **ANN-014** [v2·todo·M7] Undo and redo cover every editing tool of annotation mode and organization mode, including marks and system refinements.
- **ANN-015** [v2·todo·M7] Each document has one history per mode (annotation, organization), each bounded by `T:annotation.undoDepth` and cleared when the document closes.
- **ANN-016** [v2·todo·M7] Undo and redo buttons exist in annotation and organization mode and are disabled when their history has nothing to undo or redo.
- **ANN-017** [v2·todo·M7] Undoing a system deletion restores the system and the marks stored on it.
- **ANN-018** [v2·todo·M11] While a drawing tool is active, pen, finger and mouse draw; two fingers zoom and pan; palm rejection (STY-004) stays.
- **ANN-019** [v2·todo·M11] The finger-drawing toggle and the stylus flag `stylusSeen` no longer exist; stored stylus preferences are ignored.
- **ANN-020** [v2·todo·M11] A long click on a palette color opens a color chooser that changes that palette color.
- **ANN-021** [v2·todo·M11] Pen, text and stamp share one color, chosen in the pen popup; the highlighter has its own color.
- **ANN-022** [v2·todo·M11] Each drawing tool has one thickness value changed with thinner and thicker buttons; step, minimum and maximum are tunables.
- **ANN-023** [v2·todo·M11] The thinner and thicker buttons are disabled at the minimum and maximum.
- **ANN-024** [v2·todo·M11] The thickness is remembered per tool; a stored V1 width index migrates to the nearest thickness value.
- **ANN-025** [v2·todo·M11] A stroke preview of the current thickness and color is shown next to the thickness buttons.
- **ANN-026** [v2·todo·M11] The mouse and pen cursor is a circle of the actual stroke size at the current zoom in the tool color with a contrasting ring; below a tunable size it is a crosshair.
- **ANN-027** [v2·todo·M11] On touch devices a temporary stroke preview appears after each thickness change.
- **ANN-028** [v2·todo·M11] The highlighter opacity is one fixed tunable value above V1's 0.35, chosen on real PDFs; only the highlighter changes.
- **ANN-029** [v2·todo·M11] After changing tool, color or thickness, or after closing a popup, the next pointer-down draws.
- **ANN-030** [v2·todo·M11] A tap that closes a popup never draws.
- **ANN-031** [v2·todo·M12] The annotation tools are pen, highlighter, eraser, text, stamp and mover.
- **ANN-032** [v2·todo·M12] The stamp tool places the selected symbol on each click.
- **ANN-033** [v2·todo·M12] The stamp size changes with smaller and larger buttons; step, minimum and maximum are tunables.
- **ANN-034** [v2·todo·M12] The stamp popup shows the n most recently used stamps (n in tunables, default 8) in a 3×3 grid; the ninth cell opens a scrollable list of all symbols.
- **ANN-035** [v2·todo·M12] In free and web the recent stamps always start with the tunables set.
- **ANN-036** [v2·todo·M12] The stamp tool button shows the selected symbol and the cursor shows a preview of the stamp.
- **ANN-037** [v2·todo·M12] Stamp symbols are glyphs of the bundled Bravura font (SIL OFL); group names are not translated.
- **ANN-038** [v2·todo·M12] The symbol list covers dynamics, accidentals, fingering, strings and bowing, winds and breaths, articulation, rehearsal and navigation (letters, numbers, segno, coda, D.C., D.S., fine) and warnings (glasses, check, arrows, circle, asterisk).
- **ANN-039** [v2·todo·M12] The text tool has a default size and smaller and larger buttons; step, minimum and maximum are tunables.
- **ANN-040** [v2·todo·M12] A click with the text tool places a writing cursor that also previews the text.
- **ANN-041** [v2·todo·M12] Text may span several lines (explicit line breaks only) and is confirmed by tapping elsewhere.
- **ANN-042** [v2·todo·M12] Clicking an existing text with the text tool active edits it; confirming an empty text creates nothing.
- **ANN-043** [v2·todo·M12] The mover tool moves any annotation (stroke, text, stamp) in x and y; it selects annotations like the eraser.
- **ANN-044** [v2·todo·M12] Annotations cannot be resized after creation.
- **ANN-045** [v2·todo·M12] The eraser removes text and stamps as well as strokes.

## NAV — Navigation and input

- **NAV-001** [v1·done·M13] All inputs (keys, wheel, taps, swipes, pinch) are translated into semantic commands by one input layer driven by `T:keymap`; components react to commands only.
- **NAV-002** [v1·changed·M13] Keys (`T:keymap`): next = PageDown, ArrowRight, ArrowDown, Space; previous = PageUp, ArrowLeft, ArrowUp, Shift+Space; first = Home; last = End. Keys with Ctrl, Alt or Meta are ignored. *(Changed in V2 → NAV-021, V2-M7.)*
- **NAV-003** [v1·done·M13] In annotation and presentation mode next/previous move one slide, first/last the first/last slide; there is no wrap-around.
- **NAV-004** [v1·done·M13] Auto-repeated key events are ignored (`T:gestures.allowKeyRepeat`).
- **NAV-005** [v1·done·M13] In organization mode next/previous scroll to the next/previous page and first/last to the first/last page.
- **NAV-006** [v1·done·M13] Tap zones in annotation and presentation mode split the viewport width by `T:gestures.tapZones`: left = previous, right = next, center = toggle presentation/annotation mode. They are off while a drawing tool is active.
- **NAV-007** [v1·done·M13] A tap is a single pointer with duration ≤ `T:gestures.tapMaxDurationMs` and movement ≤ `tapMaxMovePx`; a mouse click counts as a tap.
- **NAV-008** [v1·done·M13] A swipe moves ≥ `T:gestures.swipeMinDistanceFraction` of the viewport width, within `swipeMaxAngleDeg` of horizontal, at ≥ `swipeMinVelocityPxPerMs`; swipe left = next, swipe right = previous.
- **NAV-009** [v1·done·M13] Swipes navigate in presentation mode always, and in annotation mode only at fit zoom with no drawing tool active.
- **NAV-010** [v1·done·M13] Vertical swipes do nothing on slides.
- **NAV-011** [v1·done·M13] Wheel at fit zoom in annotation and presentation mode: normalized deltas (`T:gestures.wheel`) accumulate; reaching `stepThresholdPx` turns one slide, then wheel input is ignored until `idleResetMs` without events or `cooldownMs`, whichever is longer.
- **NAV-012** [v1·done·M13] When zoomed in, the wheel pans (Shift+wheel horizontally) and never turns slides.
- **NAV-013** [v1·done·M13] Ctrl+wheel and trackpad pinch zoom around the pointer (factor exp(−deltaY × `T:gestures.wheel.zoomSensitivity`)) in annotation and organization mode.
- **NAV-014** [v1·done·M13] Touch pinch zooms around the pinch center between `T:zoom.min` and `T:zoom.max`; one finger pans a zoomed view.
- **NAV-015** [v1·done·M13] In annotation mode zoom returns to fit on every slide change; in organization mode zoom persists across page changes.
- **NAV-016** [v1·done·M13] In organization mode a double tap outside bars and jump markers toggles between fit-width and `T:gestures.doubleTapZoomFactor` × fit-width (interval ≤ `doubleTapMaxIntervalMs`, distance ≤ `doubleTapMaxDistancePx`).
- **NAV-017** [v1·done·M13] Presentation mode is always at fit scale; zoom input is ignored.
- **NAV-018** [v1·done·M13] Esc closes in this order: open popup, jump-target picking or selection, presentation mode (back to annotation mode).
- **NAV-019** [v1·done·M13] Pedals work in all modes and with a drawing tool active, because they arrive as keys.
- **NAV-020** [v1·done·M12] A slider and the previous/next buttons jump to a slide in annotation mode.
- **NAV-021** [v2·todo·M7] Keys with Ctrl, Alt or Meta are ignored, except Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z (redo); Cmd is used on macOS and iOS, Ctrl elsewhere.
- **NAV-022** [v2·todo·M7] Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z work in annotation and organization mode, not in slide mode, not in settings mode and not while a text field has focus.
- **NAV-023** [v2·todo·M13] During a touch pinch in annotation mode the content stays under the fingers: the zoom center follows the midpoint and the midpoint movement pans the view.
- **NAV-024** [v2·todo·M13] At low zoom a pinch does not shift the content (pan clamp).
- **NAV-025** [v2·todo·M13] In slide mode, slide-change triggers (keys, pedals, taps, swipes, wheel, buttons) arriving within the dead time after a slide change are dropped, not queued.
- **NAV-026** [v2·todo·M13] The dead time is one global setting shown in seconds (default 0.5 s; minimum, maximum and step in tunables).
- **NAV-027** [v2·todo·M13] There is no dead time outside slide mode; the V1 auto-repeat and wheel locks stay.

## UIX — Layout and modes

- **UIX-001** [v1·changed·M7] The modes are organization, annotation and presentation; the current mode is global state. *(Changed in V2 → UIX-025, V2-M5.)*
- **UIX-002** [v1·done·M7] A segmented three-icon control switches modes, in the same place in both layouts; the active mode is filled, the others outlined; it is hidden in presentation mode.
- **UIX-003** [v1·done·M7] The layout is compact if viewport width < `T:layout.compactMaxWidthPx` or height < `compactMaxHeightPx`, else expanded.
- **UIX-004** [v1·changed·M7] Compact annotation layout: top bar with tab switcher, open-file, mode switch, undo, redo; bottom bar with previous, "slide x of n", next, zoom −, zoom +, zoom reset; one floating button expands to pen, highlighter, eraser; aspect-ratio buttons and the version info sit in the overflow menu. *(Changed in V2 → FIL-021, V2-M6; undo and redo → UIX-033/034, V2-M7.)*
- **UIX-005** [v1·changed·M7] Expanded annotation layout: tab bar on top; vertical tool strip on `T:layout.toolStripSide` with pen, highlighter, eraser, undo, redo; popup next to it; the same bottom bar plus the aspect-ratio buttons. *(Changed in V2 → FIL-021, V2-M6; undo and redo → UIX-033, V2-M7.)*
- **UIX-006** [v1·changed·M7] Organization layout uses the same frame; the tool strip is replaced by level selector, marks-list button and overflow; the bottom bar shows "page x of n", previous, next and zoom buttons. In compact layout the organization controls sit behind one overflow button that opens a sheet. *(Changed in V2 → ORG-042, V2-M10.)*
- **UIX-007** [v1·done·M7] Bars are `T:layout.barHeightPx` high, touch targets are at least `minTouchTargetPx`, icons are monochrome, bars never grow; additional controls go into overflow menus.
- **UIX-008** [v1·done·M7] Bars stay visible in annotation and organization mode; there is no auto-hide.
- **UIX-009** [v1·done·M13] Presentation mode shows only the slide and the progress line, with no bars.
- **UIX-010** [v1·done·M7] One icon set (Material Symbols Outlined, self-hosted) provides all icons; names are in `T:icons`.
- **UIX-011** [v1·done·M7] A toggled control has a filled `T:colors.accent` background and `onAccent` icon; an untoggled control has a transparent background. Exception: the active pen or highlighter button is filled with the tool's current stroke color, with a dark or light icon (`T:colors.iconDefault` / `onAccent`) by contrast.
- **UIX-012** [v1·done·M7] Disabled controls use `T:layout.disabledOpacity` and cannot be focused.
- **UIX-013** [v1·done·M7] Popups close on outside tap, Esc or Android back.
- **UIX-014** [v1·done·M7] Tooltips appear after `T:layout.tooltipHoverDelayMs` hover or `longPressMs` long press.
- **UIX-015** [v1·done·M7] An info icon shows the version string (PIP-005) in a small popover.
- **UIX-016** [v1·done·M7] The layout works from `T:layout.minSupportedWidthPx` to `maxSupportedWidthPx` without page-level horizontal scrolling.
- **UIX-017** [v1·done·M7] Bars respect safe-area insets; the orientation follows the OS and is never locked.
- **UIX-018** [v1·done·M13] Entering presentation mode keeps the current slide; it deactivates the drawing tool and resets zoom.
- **UIX-019** [v1·done·M13] In presentation mode the mouse cursor hides after `T:layout.cursorHideMs` without movement.
- **UIX-020** [v1·done·M13] A green line of `T:layout.progressLineHeightPx` at the bottom edge shows progress = index / (n − 1) of the current slide (100% when n = 1); it is not interactive.
- **UIX-021** [v2·todo·M5] Settings in the settings mode are abstract and non-technical; algorithm parameters are tunables (exception: the detection popup, DET-030).
- **UIX-022** [v2·todo·M5] Wherever a long press is specified, holding the mouse button for `T:layout.longPressMs` is the desktop equivalent; no control has a right-click action.
- **UIX-023** [v2·todo·M5] "Reset all settings" in the General group resets, after confirmation, all user settings: palette colors, thicknesses, language, highlight mode, marks visibility, dead time, suppressed warnings, per-file choices and first-run hints.
- **UIX-024** [v2·todo·M5] "Reset all settings" never changes file content (marks, annotations).
- **UIX-025** [v2·todo·M5] Settings is a fourth mode, opened by the rightmost top-bar button (three lines icon).
- **UIX-026** [v2·todo·M5] The settings mode groups its settings into General, Display, Slide mode and Files.
- **UIX-027** [v2·todo·M5] Tooltips stay completely inside the screen at every edge.
- **UIX-028** [v2·todo·M5] Tooltips may wrap to several lines up to a maximum width in tunables.
- **UIX-029** [v2·todo·M5] Every icon name used by the app is in `T:icons` and exists in the generated sprite; a test checks both.
- **UIX-030** [v2·todo·M5] `docs/icons.md` describes where icons live, how to replace one and which test covers it.
- **UIX-031** [v2·todo·M14] Desktop browsers show no page-level scroll bar at the right edge; scroll bars inside the PDF area stay.
- **UIX-032** [v2·todo·M14] A test places tooltips at all four screen edges in organization, annotation and settings mode and asserts they stay inside the screen.
- **UIX-033** [v2·todo·M7] Undo and redo buttons belong to the tool area in annotation and organization mode: in the tool strip in expanded layout, in the expanded tool popup (FAB group) next to the tools in compact layout. They are disabled when their history is empty (ANN-016).
- **UIX-034** [v2·todo·M7] The top bar contains no undo or redo button in any layout.

## PLT — Platforms

- **PLT-001** [v1·done·M1] Supported browsers: latest two versions of Chrome, Edge, Firefox and Safari (min 16.4) on desktop; Chrome, Firefox, Samsung Internet, Edge on Android; Safari on iPad and iPhone. The targets live in one `browserslist` config.
- **PLT-002** [v1·done·M3] The Android app has `minSdk` 29 (Android 10) in one Gradle location.
- **PLT-003** [v1·done·M1] Platform APIs (Fullscreen API, Wake Lock, File System Access, localStorage, IndexedDB, Capacitor plugins) may be used only in `adapters/` and the composition root; lint fails otherwise. The ports are PdfRenderer, PdfWriter, DetectionEngine, FileAccess, Fullscreen, WakeLock, Preferences, AppLifecycle, OpenWith, BackButton; each gets its implementations in the milestone that first needs it (see `architecture.md`).
- **PLT-004** [v1·done·M16] Presentation mode in browsers uses the Fullscreen API on entry (user gesture); leaving fullscreen with Esc switches to annotation mode; where the API is missing (iPhone Safari) only the app UI is hidden.
- **PLT-005** [v1·done·M16] Presentation mode holds a wake lock (browser Screen Wake Lock, Android keep-awake), releases it on exit and re-acquires it when the app becomes visible again.
- **PLT-006** [v1·todo·M16] Android presentation uses sticky immersive mode and draws under display cutouts (`shortEdges`); exiting restores the system bars.
- **PLT-007** [v1·todo·M16] The Android back button closes popups first, in presentation mode returns to annotation mode, and otherwise has the default behavior.
- **PLT-008** [v1·todo·M16] Android opens files through the Storage Access Framework with persistable read-write permission and writes in place; if write access is not granted the file is read-only (FIL-016). _Risk: the write is a truncating write, not atomic._
- **PLT-009** [v1·done·M2] The web app is a PWA: it works offline after the first load, and a new version activates only at the next app start, never mid-use.
- **PLT-010** [v1·done·M15] Safari and Firefox have no in-place save; saving offers "save a copy".
- **PLT-011** [v1·changed·M17] On every push the E2E suite runs on Chromium, Firefox and WebKit, including Android and iPad/iPhone device profiles. *(Changed in V2 → TST-018, V2-M17.)*
- **PLT-012** [v1-optional·todo·M18] The `ios` Capacitor shell is committed; deployment target iOS 16.4; Info.plist declares PDF as a supported document type with open-in-place.
- **PLT-013** [v1-optional·todo·M18] iOS adapters provide: status bar and home indicator hidden in presentation, keep-awake, document picker with write access, "open with" via the URL-open event, safe-area insets.
- **PLT-014** [v1-optional·todo·M18] All iOS code is marked `// UNVERIFIED(ios)` until a tester has run it on a device.
- **PLT-016** [v1·done·M16] The browser fullscreen request is robust (found on Edge for Windows, where presentation mode stayed windowed): `WebFullscreen.enter()` tries `requestFullscreen({ navigationUI: 'hide' })`, then the plain call, then the `webkit` method; `exit()` and `active` follow `document.fullscreenElement`, not only the change event; a denied entry is retried once on the next gesture (navigation command) in presentation mode, never after Esc; the failure name goes to the developer console only.
- **PLT-017** [v2·todo·M17] iOS autosave and reopen are checked by a tester with files from the Files app, iCloud Drive and one other provider; until then the code stays `UNVERIFIED(ios)`.

## NFR — Non-functional

- **NFR-001** [v1·done·M17] A slide change completes in ≤ `T:budgets.slideChangeP95Ms` (95th percentile) with neighbors prefetched.
- **NFR-002** [v1·done·M17] While drawing, added latency stays ≤ `T:budgets.drawingMaxAddedLatencyMs` and no main-thread task exceeds `drawingMaxLongTaskMs`.
- **NFR-003** [v1·done·M8] One scheduler ranks work: input and drawing, then visible rendering, then neighbor prefetch, then saving, then detection; lower-priority work is paused or cancelled when higher-priority work needs the CPU.
- **NFR-004** [v1·done·M8] A bitmap cache with a byte budget (`T:resources.cacheBudgetByDeviceMemoryGb`, default `cacheBudgetDefaultBytes`) evicts least recently used bitmaps first.
- **NFR-005** [v1·done·M8] The device pixel ratio used for rendering is capped at `T:resources.devicePixelRatioCap`.
- **NFR-006** [v1·done·M8] No canvas exceeds `T:resources.maxCanvasPixels`.
- **NFR-007** [v1·done·M9] Zoomed views (organization pages and slides) render only the visible tiles, each at most `T:resources.tileSizePx` wide and high.
- **NFR-008** [v1·done·M8] Stale render tasks are cancelled when the view changes.
- **NFR-009** [v1·changed·M8] Inactive tabs release their bitmaps and keep only lightweight document data. *(Changed in V2 → NFR-020, V2-M6.)*
- **NFR-010** [v1·done·M8] Under memory pressure the app degrades in this order: drop prefetch, lower render resolution, free inactive tabs' bitmaps; it never fails outright.
- **NFR-011** [v1·done·M10] Every OpenCV object is released in a `finally` block.
- **NFR-012** [v1·done·M10] OpenCV.js is loaded only inside the detection worker, lazily on first use, from the app's own assets (no CDN).
- **NFR-013** [v1·done·M15] There is no hard PDF size limit; a failed save shows the error icon and does not crash.
- **NFR-014** [v1·done·M1] The initial bundle stays within `T:budgets.initialBundleKbGzip` (Angular build budget).
- **NFR-015** [v1·todo·M16] After the OS kills the WebView, the next start restores tabs and positions; unsaved loss is limited to the autosave delay.
- **NFR-016** [v1·todo·M17] A reference PDF with 100+ pages (one scanned) runs within the budgets on a mid-range small tablet.
- **NFR-017** [v2·done·M1] No library, font or other resource is loaded from a third-party host at runtime.
- **NFR-018** [v2·done·M1] An E2E test on the production build fails when the app requests anything whose origin is not its own (except `data:` and `blob:`), in Chromium, Firefox and WebKit.
- **NFR-019** [v2·done·M1] Production builds are minified and contain no source maps.
- **NFR-020** [v2·todo·M6] When a file becomes inactive its rendered bitmaps are released at once, not only under memory pressure; a memory test with 30 real PDFs checks it.
- **NFR-021** [v2·todo·M14] After every zoom, tiles are re-rendered and placed correctly in all three modes.
- **NFR-022** [v2·todo·M14] Visible pages and tiles are never left blank after scrolling, zooming, page jumps or mode changes.
- **NFR-023** [v2·todo·M14] Rendering keeps visible-first priority, cancels stale requests and uses a bounded queue.
- **NFR-024** [v2·todo·M14] A watchdog periodically re-requests any empty visible area at the lowest priority, at most one request per tick.
- **NFR-025** [v2·todo·M2] Rendering, detection and display work on a working raster whose size depends only on the page size and the view (rebuilt only after a lost raster, NFR-028), never on the resolution of the PDF's images; source images larger than `T:pdf.sourceImageMaxBytes` are reduced by pdf.js, and source pixels are decoded for a region only when it is zoomed beyond the working resolution, one request at a time.
- **NFR-026** [v2·done·M2b] While a page is among the most recently rendered ones (`T:pdf.warmPagesByDeviceMemoryGb`), the renderer keeps pdf.js's parsed page content and decoded source images: regions of the same page rendered one after another decode the page's source images once, not once per region. The state of a page is released when it leaves that set, when its document is destroyed and when its tab becomes inactive (NFR-020).
- **NFR-027** [v2·done·M2b] Displays up to 4K (3840×2160 physical pixels, `devicePixelRatio` up to `T:resources.devicePixelRatioCap`) show slides at full device resolution: the slide canvas never exceeds `T:resources.maxCanvasPixels`, and prefetching a neighbor never evicts the current slide from the bitmap cache. Where the cache budget of the device cannot hold the current slide and its prefetched neighbors, prefetch is reduced (`prefetchNeighbors` becomes smaller) before the render resolution is lowered.
- **NFR-028** [v2·done·M3] A working raster that comes back transparent (the browser dropped the canvas, seen in WebKit on large scans) is never used: pdf.js paints every rendered page opaque, so a small copy of the finished raster is read back (`T:resources.rasterProbeSize`) and a transparent sample means lost. A lost raster is rebuilt up to `T:resources.rasterLostRetries` times (the oldest other working raster is freed first) and then fails with `out-of-memory`, so detection reports the page as failed instead of 0 systems. An opaque flat raster may be a really white page and is accepted as it is (counted for diagnosis). Rebuilds are not counted as renders of the page in NFR-025.

## ARC — Architecture rules

- **ARC-001** [v1·done·M1] The folders `core/`, `ports/`, `adapters/`, `state/`, `input/`, `features/`, `config/` exist; ESLint boundary rules allow only inward dependencies and CI fails on violations.
- **ARC-002** [v1·done·M1] `core/` imports nothing from Angular, the DOM or third-party libraries and is deterministic.
- **ARC-003** [v1·done·M1] The app uses standalone components, signals, OnPush, zoneless change detection and strict TypeScript, following the current official Angular style guide and `ng generate` naming.
- **ARC-004** [v1·done·M1] All numbers, colors, icon names and key bindings come from `src/config/tunables.ts`.
- **ARC-005** [v1·done·M4] Errors cross port boundaries as typed results; the UI shows icons, not messages.
- **ARC-006** [v1·done·M13] A single place in the input layer decides whether a pointer draws or navigates.
- **ARC-007** [v2·done·M1] V2 keeps the V1 layers, ports and import matrix; a change to them needs a decision entry in `docs/decisions.md` first.
- **ARC-008** [v2·done·M1] Every value in `src/config/tunables.ts` has a comment with unit and meaning; a check fails on a numeric value without one.
- **ARC-009** [v2·done·M3] Tunables and the feature configuration are bundled at build time; nothing of them is loaded at runtime.

## PIP — Pipelines and versioning

- **PIP-001** [v1·changed·M1] Pipeline `lint-test` runs on every push to every branch (not on tag pushes): lint, lint self-test, unit tests and the production build. E2E on three engines runs in the separate workflow `e2e` on every push, one job per Playwright project (nine in parallel), each building for itself; it is temporarily optional: `deploy-web` and `android` do not wait for it (DEC-100). No artifacts are used (free-account storage quota). *(Changed in V2 → PIP-012, V2-M1.)*
- **PIP-002** [v1·done·M1] Pipeline `deploy-web` builds and deploys to Firebase Hosting, triggered by `workflow_run` after a successful `lint-test` on any branch (each branch push deploys to the live channel).
- **PIP-003** [v1·done·M3] Pipeline `android` builds a signed APK and uploads it to Firebase App Distribution, triggered like PIP-002; the owners group gets every build, the Android tester group builds of `main` only.
- **PIP-004** [v1-optional·todo·M18] Pipeline `ios` runs an unsigned simulator build on a macOS runner, triggered like PIP-002.
- **PIP-005** [v1·changed·M2] The version string is `git describe --tags --always --long` (checkout with full history), injected at build time and shown in the app (UIX-015). *(Changed in V2 → PIP-018, V2-M1.)*
- **PIP-006** [v1·changed·M3] Android `versionName` is the version string and `versionCode` is the commit count. *(Changed in V2 → PIP-019, V2-M1.)*
- **PIP-007** [v1·done·M1] Pipelines 2–4 share a composite action that builds the web app.
- **PIP-008** [v1·done·M0] Signing keys and Firebase credentials exist only as GitHub secrets; their names are listed in `docs/milestones/V1-M00.md`.
- **PIP-009** [v1·done·M2] Milestone `V1-M<m>` is tagged `v0.<m>.0` and fixes `v0.<m>.<p>`; the release of v1 additionally tags the commit of the last included milestone `v1.0.0`; a tag deploys nothing by itself.
- **PIP-010** [v1-optional·todo·M18] Pipeline `ios` also builds a signed ad hoc IPA and uploads it to Firebase App Distribution (owners group on every run, iOS tester group on `main` only) when the Apple signing secrets exist; without them these steps are skipped and the pipeline stays green.
- **PIP-011** [v2·done·M1] Every workflow can be started manually (`workflow_dispatch`).
- **PIP-012** [v2·done·M1] `lint-test` (lint, unit tests, build) runs on every push; the `e2e` workflow runs on pull requests to `main`, on tags and manually, not on every push.
- **PIP-013** [v2·done·M1] A check in `lint-test` fails on unused exports or files.
- **PIP-014** [v2·done·M1] A check in `lint-test` fails on unused dependencies in `package.json`.
- **PIP-015** [v2·done·M1] A license check in `lint-test` fails when a production dependency has a license outside an allow-list; GPL and AGPL are never allowed.
- **PIP-016** [v2·done·M1] Coverage is reported per kind of test (unit, integration, E2E and emulator, real-PDF detection, performance) in the CI job summary; a kind without coverage numbers reports its test count.
- **PIP-017** [v2·done·M1] No coverage threshold fails a build.
- **PIP-018** [v2·done·M1] Users see only the version `vX.Y.Z` taken from the nearest tag; the full `git describe` string appears only in internal places.
- **PIP-019** [v2·done·M1] Android `versionName` is `X.Y.Z` (no `v`, no describe suffix).
- **PIP-020** [v2·done·M1] A build check fails when the web, Android and iOS versions differ; free and paid builds have the same version.
- **PIP-021** [v2·todo·M19] Store build numbers (Android `versionCode`, iOS build number) are the commit count, set by CI.

## TST — Testing

- **TST-001** [v1·done·M4] Every `core/` function has unit tests written before its implementation; test names contain the requirement ID.
- **TST-002** [v1·done·M17] A golden detection corpus (engraved and scanned PDFs with expected system counts per page) runs in CI; every reported problem PDF joins it.
- **TST-003** [v1·done·M17] A round-trip test annotates, saves, reopens and checks that strokes and embedded data survive and the PDF still loads.
- **TST-004** [v1·done·M1] Playwright is configured with Chromium, Firefox and WebKit projects and phone and tablet device profiles.
- **TST-005** [v1·done·M1] Code that exists only for Safari/WebKit changes only together with a Playwright WebKit test.
- **TST-006** [v1·done·M17] A manual device checklist covers pedals, full screen, wake lock, "open with", in-place save and performance on a real Android tablet.
- **TST-007** [v1·done·M17] A tester checklist for iOS Safari (open, scroll, draw, save a copy, presentation mode, pedal) is delivered with the hosted URL.
- **TST-008** [v1·done·M17] A performance test on the reference PDF fails the pipeline when a budget in `T:budgets` is exceeded.
- **TST-009** [v2·done·M1] Playwright projects cover desktop Chrome, Firefox and Safari, a small Android phone (about 360 × 640), a large Android phone, an Android tablet, iPhone and iPad.
- **TST-010** [v2·done·M2] The real-PDF corpus consists of a repository folder and a plain list of URLs; either may be empty. The owner provides nothing but the PDF files or their URLs.
- **TST-011** [v2·done·M2] URL-list PDFs are downloaded and cached by a script (run by tests and CI only); the script records each checksum on first download and verifies it afterwards; a failed download or a checksum mismatch skips the entry with a warning.
- **TST-012** [v2·dropped·M2] Every corpus PDF has a license note (source, license, date). Dropped: licenses are not tracked for the test corpus (owner decision).
- **TST-013** [v2·done·M2] An expectation file extending `e2e/corpus/expected.json` gives the number of systems per page for every corpus PDF.
- **TST-014** [v2·done·M2] One easy-to-use script (`npm run corpus`) does all corpus bookkeeping: it downloads the listed URLs, records checksums, and proposes expectation entries; it never overwrites an entry marked as reviewed unless called with `--force`.
- **TST-015** [v2·changed·M2] The corpus runs as detection regression test, except stress files (more than 100 pages), which are not run through detection; real PDFs replace the generated reference PDF in the performance tests: the largest file for the time to the first slide, the regular PDF with the most pages for slide changes, and the stress file for responsiveness while detection runs (scrolling, zooming, large jumps). *(Changed in V2 → TST-024, TST-025, V2-M3b.)*
- **TST-016** [v2·done·M2] Generated synthetic scores and the generated large reference PDF are removed; only the failure-case fixtures damaged, zero pages, blank page and encrypted stay.
- **TST-017** [v2·todo·M14] Seeded random stress tests (page jumps, scrolling, zoom sequences, mode switches, rendering during detection) assert that no visible tile stays blank; the seed is printed on failure and budgets are in `T:budgets`.
- **TST-018** [v2·todo·M17] The whole E2E suite runs on every Playwright project; a test that cannot run on an engine is skipped explicitly with a reason.
- **TST-019** [v2·todo·M17] An Android emulator job runs a smoke test (open, detect, draw, save, reopen) of the paid app on at least an Android tablet image, on release tags and manually; it never blocks ordinary pushes.
- **TST-020** [v2·todo·M17] Every persistence-related feature is tested in both configurations: free and web persist nothing, paid persists.
- **TST-021** [v2·todo·M17] A low-memory stress test opens 40 real PDFs one after another and switches among them with a reduced heap limit; no crash, no blank tile, memory returns to a bounded level.
- **TST-022** [v2·done·M2b] A report-only performance profile (`e2e/perf/render-profile.spec.ts`) runs the regular real PDF in annotation and presentation mode at 3840×2160 (devicePixelRatio 1), 2560×1440 (1.5) and 1920×1080 (2) and prints, per run: slide canvas size, source renders split into raster builds and direct region renders, time from key press to repaint (median, 95th percentile), JS heap and bitmap cache bytes against the budget. It asserts nothing about speed; the 4K budgets in `T:budgets` are set by the owner after reading the numbers.
- **TST-023** [v2·done·M3b] Every corpus entry in `e2e/corpus/expected.json` names the suites it belongs to (`detection`, `load` or both) and may carry tags and an `engines` list; a validator (`scripts/lib/corpus-schema.mjs`) rejects an unknown suite, profile or engine, a `detection` entry without counts, a `load`-only entry with counts and a narrowed `engines` list without a note. The detection profiles (named ways to run detection, today the V1 levels, later parameter sets) are listed in `e2e/corpus/profiles.json`.
- **TST-024** [v2·done·M3b] The detection suite runs each reviewed `detection` entry once per profile (the default profiles plus the entry's own) on each engine of its `engines` list and compares the systems per page with the owner's reviewed counts. What a profile or an engine gives differently is recorded as a `deviation` with the exact numbers, which the run asserts; a change of detection algorithm or settings is a new profile, not a change of the reviewed counts.
- **TST-025** [v2·done·M3b] The load suite runs every `load` entry on Chromium: open until the first slide, then detection of the whole file in parallel with slide stepping, large jumps, scrolling, zooming and a pen stroke. It asserts that the requested page is displayed and drawn after each action, that the budgets of `T:budgets` hold (slide change, longest main-thread task, stroke latency, heap, first slide), and that the bitmap cache stays within its budget, no canvas exceeds `T:resources.maxCanvasPixels` and no more than `T:resources.schedulerMaxPerClass` tasks of a class run at once. Under CPU throttling it asserts correctness and these invariants only. It does not check detection results.
- **TST-026** [v2·done·M3b] A breach of a load-suite assertion fails the `perf` job (no retries); every measured value is written as a row to the job summary (entry, scenario, value, limit with tolerance, result), without an artifact.
- **TST-027** [v2·done·M3b] Each end-to-end engine job has a time limit derived from the measured run time of its detection suite, and each detection run has its own timeout scaled by the page count; a run that does not finish fails its test with the engine and the file, not only the job.

## STY — Stylus support (v1-optional)

- **STY-001** [v1-optional·dropped·M19] The first pointer event with `pointerType` `pen` sets a persisted flag `stylusSeen`. *(Dropped in V2 → ANN-019, V2-M11.)*
- **STY-002** [v1-optional·changed·M19] With `stylusSeen`, the pen draws and fingers zoom, pan, tap and swipe but never draw; tap zones and swipes work with a tool active. *(Changed in V2 → ANN-018, V2-M11.)*
- **STY-003** [v1-optional·dropped·M19] A setting "allow finger drawing" in the pen popup (default `T:stylus.allowFingerDrawingDefault`) lets fingers draw even with `stylusSeen`. *(Dropped in V2 → ANN-019, V2-M11.)*
- **STY-004** [v1-optional·done·M19] Touches are ignored while the pen is in contact or hovering and for `T:stylus.palmRejectionGraceMs` afterwards.

## EDN — Editions and feature switches

- **EDN-001** [v2·done·M3] The free edition saves nothing: no autosave, no saving, no Send to and no export.
- **EDN-002** [v2·done·M3] In the free edition annotations, marks and organization changes work in memory and are lost when the file closes.
- **EDN-003** [v2·done·M3] Actions switched off by the edition stay visible and disabled.
- **EDN-004** [v2·done·M3] The web app has exactly the feature set of the free edition.
- **EDN-005** [v2·done·M3] The free edition persists no app state: no settings, zoom, recent files, session restore or per-file choices.
- **EDN-006** [v2·done·M3] The free feature set is defined per platform in two feature-configuration files in `src/config/` (`features.web.ts`, `features.native.ts`; the native file holds the free native set), separate from tunables; every feature has an on/off switch with a comment; the paid native build switches every switch of the native file on.
- **EDN-007** [v2·done·M3] Each build bundles only its own feature configuration; features read their switch through an injection token, never the files.
- **EDN-008** [v2·done·M3] Every feature stays in the code base, including persistence, saving, recent files and session restore; free and web only switch it off.
- **EDN-009** [v2·done·M3] Switches of web-only organizational features exist in `features.web.ts` only; the native file does not contain them.
- **EDN-010** [v2·done·M3] One code base builds a free and a paid app for Android and for iOS; the feature set is chosen at build time.
- **EDN-011** [v2·done·M3] Tests prove that in the free configuration every paid feature is unreachable: no save control is enabled and no file write call is made.
- **EDN-012** [v2·done·M3] Tests prove that the paid configuration enables every feature.
- **EDN-013** [v2·done·M3] A shared feature switch (every switch except the web-only ones of EDN-009) missing in either configuration file, or a web-only switch present in the native file, fails the build.
- **EDN-014** [v2·done·M3] The web build with its default configuration stores no cookies, localStorage, sessionStorage or IndexedDB data; a test on the production web build checks this in Chromium, Firefox and WebKit.
- **EDN-015** [v2·done·M3] The PWA service worker may cache the app's own files.
- **EDN-016** [v2·done·M3] The web app starts empty on every start: session restore, recent files and permission re-grant are off.

## MRK — Marks, labels and bookmarks

- **MRK-001** [v2·done·M4] Every mark is stored on one system and one side: the left side holds start marks, jump targets and bookmarks; the right side holds jump starts, stops and slide breaks.
- **MRK-002** [v2·done·M4] Several jumps may start on the same system side; there are no plausibility checks.
- **MRK-003** [v2·done·M4] Setting a slide break or a stop where one exists removes it (toggle).
- **MRK-004** [v2·done·M4] A system holds at most one stop.
- **MRK-005** [v2·done·M4] Stops and slide breaks cannot be set on the last system.
- **MRK-006** [v2·done·M4] A file has at most one start mark; setting a new one removes the previous one.
- **MRK-007** [v2·done·M4] A system side may hold several bookmarks.
- **MRK-008** [v2·done·M4] A new jump's pass number defaults to the number of existing jumps from the same start side plus one.
- **MRK-009** [v2·done·M4] Every mark has the automatic label `<file name>:<page>:<system on page>`; for a mark within the same file the file name is omitted (`<page>:<system on page>`).
- **MRK-010** [v2·done·M4] A jump's label is `<start label> -> <target label>`, followed by `×n` when its pass number n is greater than 1.
- **MRK-011** [v2·done·M4] Every mark may carry an optional user text, shown after the automatic label.
- **MRK-012** [v2·done·M4] A cross-file reference is stored in the source file and holds the target file name, page and system on page; the file name is the only file identity. A jump target may be such a reference; a bookmark sits on a system of its own file and may hold one as its target.
- **MRK-013** [v2·done·M4] Deleting a system deletes the marks stored on both its sides; marks on other systems stay.
- **MRK-014** [v2·done·M4] A page rerun keeps that page's marks only if the page's system count is unchanged; otherwise the marks of that page are deleted.
- **MRK-015** [v2·todo·M4] A cross-file reference whose target system no longer exists is kept and counts as unresolved; edits in the target file never modify the source file.
- **MRK-016** [v2·todo·M6] In slide mode an unresolved cross-file jump ends the presentation at that position.
- **MRK-017** [v2·todo·M6] Cross-file marks exist in every edition; in free and web they live only in the session.
- **MRK-018** [v2·todo·M10] Mark tools act on systems, not on bars.
- **MRK-019** [v2·todo·M10] The active areas of a system are its left and right ends, each a tunable ratio of the system width (start value 0.2).
- **MRK-020** [v2·todo·M10] The right end takes jump start, stop and slide break; the left end takes jump target, start mark and bookmark; a tap on the wrong end does nothing.
- **MRK-021** [v2·todo·M10] With the jump tool, the right end sets the jump start and the left end sets the jump target.
- **MRK-022** [v2·todo·M10] Choosing a jump start prompts for the target; choosing a jump target first prompts for the start.
- **MRK-023** [v2·todo·M10] After both ends of a jump are chosen, a stepper sets its pass number (integer ≥ 1), starting at the default of MRK-008.
- **MRK-024** [v2·todo·M10] While a jump is half-defined, the chosen system is highlighted at the tapped end and every other system as a candidate at the opposite end, with the active-area width.
- **MRK-025** [v2·todo·M10] The candidate opacity follows a Display setting with the abstract choices linear (default), exponential and constant; its parameters are tunables.
- **MRK-026** [v2·todo·M10] A half-defined jump is cancelled by a tap elsewhere, Escape, a tap on the chosen system, Android back or the cancel icon.
- **MRK-027** [v2·todo·M10] Marks are hidden in annotation mode unless the Display setting "Show marks while annotating" is on (default off).
- **MRK-028** [v2·todo·M10] Marks are never shown in slide mode.
- **MRK-029** [v2·todo·M10] Creating a mark never scrolls the view, except for the user-triggered file switch of a cross-file mark.
- **MRK-030** [v2·todo·M10] Labels have no length limit; a marker grows or wraps and never overlaps another marker or leaves the screen.
- **MRK-031** [v2·todo·M10] Labels are shown inside the colored marker in organization mode and in the marks list.
- **MRK-032** [v2·todo·M10] A selected mark offers a text field to edit its user text.
- **MRK-033** [v2·todo·M10] Bookmarks take their colors cyclically from their own palette in tunables; jumps keep `T:colors.jumpPalette`.
- **MRK-034** [v2·todo·M10] Start marks are green and stop marks red (tunables).
- **MRK-035** [v2·todo·M10] Several marks on one system sit side by side.
- **MRK-036** [v2·todo·M10] The stop marker is larger than the other markers and colored; the start marker has the same size and can carry a user text.
- **MRK-037** [v2·todo·M10] Targets of cross-file bookmarks and jumps can be chosen only in open files, by switching to the other file.
- **MRK-038** [v2·todo·M10] A half-defined cross-file mark survives the file switch.
- **MRK-039** [v2·todo·M10] Closing the source file or the other file cancels a half-defined cross-file mark.
- **MRK-040** [v2·todo·M10] The marks list exists in organization mode only and lists the marks in playing order; marks that are never reached follow at the end, dimmed.
- **MRK-041** [v2·todo·M10] The marks-list button is disabled when the file has no marks, counting cross-file marks that reference it.
- **MRK-042** [v2·todo·M10] Tapping a list item navigates to it and selects it; deleting from the list works as in V1 (swipe or trash icon).
- **MRK-043** [v2·todo·M10] Marks cannot be edited from the list, and the list has no filter.
- **MRK-044** [v2·todo·M10] With no organization tool active, a tap on a marker selects its mark.
- **MRK-045** [v2·todo·M10] A selected jump offers pass number, change target and delete.
- **MRK-047** [v2·todo·M10] A selected start mark, bookmark, stop or slide break offers delete.
- **MRK-046** [v2·todo·M10] In the marks list the start mark comes first.
- **MRK-048** [v2·todo·M10] In the marks list a bookmark is placed where the playing position first reaches its system side.
- **MRK-049** [v2·todo·M10] Bookmarks that are never reached are in the dimmed end group after the jumps and before breaks and stops.
- **MRK-050** [v2·todo·M10] A long press (`T:layout.longPressMs`) on a jump marker scrolls to the other end of the jump; if that end is in another open file, the app switches to that file.

## EXP — Export

- **EXP-001** [v2·todo·M15] "Send to" produces one PDF in which ink, text and stamps are flattened into standard page content (they need not stay editable).
- **EXP-002** [v2·todo·M15] The exported PDF carries the marks in its embedded metadata (current schema).
- **EXP-003** [v2·todo·M15] The exported PDF goes to the system share sheet where available, else it is saved as a local copy.
- **EXP-004** [v2·todo·M15] "Send to" works only in the paid native app; in free it is visible and disabled.
- **EXP-005** [v2·todo·M15] In desktop browsers "Send to" is visible and disabled and never downloads a file.
- **EXP-006** [v2·todo·M15] The app offers no printing.
- **EXP-007** [v2·todo·M15] Export never changes the original file, the working file or its autosave state.

## HNT — First-run hints

- **HNT-001** [v2·todo·M16] Eight first-run hints exist as tip bubbles next to the control or area they explain: open a file, detection progress, detected systems shown, creating marks of different kinds, change to annotation mode, change the aspect ratio, pen annotation, change to slide mode.
- **HNT-002** [v2·todo·M16] Each hint appears once, at the moment its step becomes relevant.
- **HNT-003** [v2·todo·M16] There are no hints for the detection tool or the refine tool.
- **HNT-004** [v2·todo·M16] A checkbox in the General settings group turns all hints off; "Reset all settings" turns them on again and shows them again.
- **HNT-005** [v2·todo·M16] In free and web each hint appears at most once per session; in paid the shown state persists.
- **HNT-006** [v2·todo·M16] Hint bubbles never block input and disappear on tap or after a timeout in tunables.
- **HNT-007** [v2·todo·M16] Hint bubbles stay inside the screen and never cover the control they explain.
- **HNT-008** [v2·todo·M16] All eight hint texts exist in all seven languages.

## STO — Store publishing

- **STO-001** [v2·todo·M19] Four store listings exist: free and paid on Google Play and on the App Store.
- **STO-002** [v2·todo·M19] The paid app is a one-time purchase; the price is set at release.
- **STO-003** [v2·todo·M19] The application IDs and display names of the four listings are final before the first publication.
- **STO-004** [v2·todo·M19] The owner holds the Google Play Console and Apple Developer accounts.
- **STO-005** [v2·todo·M19] Business registration, tax number and imprint for the paid app are completed by the owner before the first paid release.
- **STO-006** [v2·todo·M19] The store privacy declarations state that no data is collected.
- **STO-007** [v2·todo·M19] The store listings carry a proprietary license text (EULA).
- **STO-008** [v2·todo·M19] App icon and favicon are generated from one source image of at least 1024 × 1024 pixels.
- **STO-009** [v2·todo·M19] A build check verifies that all required icon sizes and formats exist with the right dimensions and alpha rules.
- **STO-010** [v2·todo·M19] Store texts (name, short description, full description, what's new) exist for the free and the paid listing in all seven languages, within the stores' length limits.
- **STO-011** [v2·todo·M19] Store documents exist: privacy policy, data-safety and privacy answers, support information, age rating and Apple review notes.
- **STO-012** [v2·todo·M19] A list of screenshot suggestions per store exists.
- **STO-013** [v2·todo·M19] A one-page flyer exists as PDF and JPG; there is no video.
