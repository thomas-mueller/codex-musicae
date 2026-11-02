# Requirements — CodexMusicae

Read only the IDs your milestone file lists (use `grep -n "DET-005" docs/requirements.md`). Do not read this whole file.

## Format

`- **TOPIC-nnn** [target·status·milestone] Statement. _P: platform note._`

- **ID:** never reused or renumbered. Removed items stay with status `dropped`.
- **target:** `v1` | `v1-optional` | `v2` | `backlog` (backlog items live in `docs/limitations.md` until promoted).
- **status:** `todo` | `done` | `changed` | `dropped`. Set `done` only when the tests for the ID pass.
- **milestone:** `M<n>` (see `docs/roadmap.md`). Every ID belongs to exactly one milestone.
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

---

## GEN — General

- **GEN-001** [v1·done·M1] The app title, PWA name and launcher name are `T:identity.appName`.
- **GEN-002** [v1·done·M3] The Android applicationId and Capacitor appId are `T:identity.appId`.
- **GEN-003** [v1-optional·todo·M18] The iOS bundle ID is `T:identity.appId`.
- **GEN-004** [v1·done·M0] The GitHub repository is private and has no license file; only built apps (web, Android, optionally iOS) are distributed.
- **GEN-005** [v1·done·M8] PDF content is processed on the device only; no network request carries PDF content or PDF-derived data.
- **GEN-006** [v1·done·M1] The app has no account, no backend beyond static hosting, no analytics and no crash reporting.
- **GEN-007** [v1·done·M7] The app has a single light theme; there is no dark mode.
- **GEN-008** [v1·done·M7] Every area not covered by PDF content (around the slide, filler outside the page, the empty state) uses `T:colors.canvasGrey`.
- **GEN-009** [v1·done·M7] Every control is an icon from the icon set; visible text is limited to numbers, the version string and error codes.
- **GEN-010** [v1·done·M7] Every icon-only control has an accessible label from the translation files.

## I18 — Localization

- **I18-001** [v1·done·M1] All user-visible strings come from translation files through the translation layer; a lint rule fails the build on text literals in templates.
- **I18-002** [v1·done·M1] A second language can be added by adding one translation file, without code changes. v1 ships English only.

## FIL — Files and tabs

- **FIL-001** [v1·done·M8] The open-file control opens the platform file picker for PDFs with multiple selection; each selected PDF opens in its own tab.
- **FIL-002** [v1·done·M8] Opening a PDF that is already open focuses its existing tab. Same file means: `isSameEntry` (web handles), same URI (Android), else equal name, size and last-modified time.
- **FIL-003** [v1·done·M8] Each tab shows the file name, a close icon and a status marker (unsaved dot, error icon, read-only lock icon, needs-re-open icon).
- **FIL-004** [v1·done·M8] In expanded layout the tabs are a tab bar; in compact layout one button shows the current tab name and opens the list of all tabs.
- **FIL-005** [v1·done·M8] Switching tabs keeps the global mode, tool and tool settings; per tab are position, zoom, aspect-ratio override, undo history and document data.
- **FIL-006** [v1·done·M15] Closing a tab saves it first; if saving fails the tab stays open and shows the error icon.
- **FIL-007** [v1·done·M7] With no tab open, all chrome stays visible, the PDF area shows only canvas grey, controls that need a document are disabled, open-file and recent files stay enabled.
- **FIL-008** [v1·done·M8] A recent-files list (max `T:resources.recentFilesMax`, newest first) opens from the open-file control; selecting an entry reopens it, or asks to re-pick the file if access is lost.
- **FIL-009** [v1·done·M8] An encrypted, damaged or zero-page PDF opens as a tab in error state (error icon, tooltip with reason); it never crashes the app.
- **FIL-010** [v1·done·M15] While a tab has pending changes it shows the unsaved dot; it disappears after a successful save.
- **FIL-011** [v1·todo·M16] At startup the app reopens the previous tabs, selects the last active tab and restores each tab's position.
- **FIL-012** [v1·todo·M16] After startup the mode is annotation mode, even if the app was closed in presentation mode.
- **FIL-013** [v1·todo·M16] A tab whose file access cannot be restored shows the needs-re-open state; one tap re-picks the file or re-grants permission.
- **FIL-014** [v1·todo·M16] The persisted position per tab is the playing-order system index of the first entry on the current slide plus the organization-mode page and scroll offset.
- **FIL-015** [v1·done·M8] The preferences store (`T:persistence.keyPrefix`) holds UI state and file references only, never PDF-derived data. _P: web stores file handles in IndexedDB, other values in localStorage; Android uses Capacitor Preferences._
- **FIL-016** [v1·done·M15] If a file cannot be written, its tab shows the read-only lock icon and offers "save a copy"; ink, jumps and breaks stay editable in memory.
- **FIL-017** [v1·todo·M15] "Save a copy" writes the modified PDF to a new file. _P: web download or save picker; Android document-create intent._
- **FIL-018** [v1·todo·M16] The Android app is offered for PDF `VIEW` intents ("Open with…") and opens the file in a tab, requesting write access.
- **FIL-019** [v1·done·M16] The PWA manifest registers a PDF file handler. _P: effective only in desktop Chromium._

## SAV — Saving and embedded data

- **SAV-001** [v1·done·M15] App data is embedded as one PDF file attachment named `T:saving.metadataFileName` in the `/EmbeddedFiles` name tree; the PDF stays valid and other viewers ignore it.
- **SAV-002** [v1·done·M15] The embedded JSON has an integer `schemaVersion` (`T:saving.schemaVersion`) and is validated by a schema on read.
- **SAV-003** [v1·done·M15] Older schema versions are upgraded on read by migration functions; a newer unknown version is ignored and never overwritten.
- **SAV-004** [v1·done·M15] The JSON contains: `schemaVersion`, `appVersion`, `pageCount`, detection level, system rectangles per page, jumps, breaks, stops, and optional aspect-ratio overrides per orientation.
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

## DET — Detection

- **DET-001** [v1·done·M10] When a PDF has no valid embedded data, detection runs automatically for all pages in page order in the background.
- **DET-002** [v1·done·M10] Detection runs in one dedicated web worker, one page at a time, and never blocks the UI thread.
- **DET-003** [v1·done·M10] A page is rendered to a bitmap at the level's `renderScale`; if width×height exceeds `T:resources.maxCanvasPixels` the scale is reduced to fit.
- **DET-004** [v1·done·M10] The bitmap is converted to gray and binarized with the adaptive mean threshold (`THRESH_BINARY_INV`, ink = foreground; block size and constant per level, `T:detection.levels`); the bounding rectangle and the pixel area of every 4-connected component are collected. The background component (label 0) is not collected.
- **DET-005** [v1·done·M5] Selection step 0: without components there are no systems; the pixel areas of all components form the list the threshold is computed from. The function does not modify its input.
- **DET-006** [v1·done·M5] Selection step 1: sort the areas descending and find the first largest gap between consecutive areas (a later equal gap does not replace it); the threshold is the smaller area after that gap, and 0 with a single component. A component qualifies by area if its area is strictly greater than the threshold.
- **DET-007** [v1·done·M5] Selection step 2: a component narrower than `minSystemWidthRatio` × bitmap width is never a system, whatever its area; a width exactly at the limit stays.
- **DET-008** [v1·done·M5] Selection step 3: a component at least `fullWidthSystemRatio` × bitmap width wide is a system whatever its area; otherwise it must qualify by area (DET-006).
- **DET-009** [v1·done·M5] The result is sorted top to bottom (ties left to right); boxes are normalized by the bitmap size and converted to page display space.
- **DET-010** [v1·done·M5] The padding of a page is the median gap between consecutive systems on that page; a page with fewer than two systems uses the median over all pages; if no gap exists, `T:detection.fallbackPaddingPageHeightRatio` × page height.
- **DET-011** [v1·done·M5] A system's padded area is its box expanded by the padding on all four sides, clamped to the page bounds.
- **DET-012** [v1·done·M10] Pages without systems take no part in junctions, slides or the playing order; organization mode shows them as plain PDF pages.
- **DET-013** [v1·done·M10] Three levels `fast`, `standard`, `fine` each define `minSystemWidthRatio`, `fullWidthSystemRatio`, `renderScale`, `adaptiveBlockSize` and `adaptiveC` (`T:detection.levels`); the default is `T:detection.defaultLevel`. `renderScale` is bitmap pixels per PDF point, written as dpi / 72: `fast` 100 dpi, `standard` 150 dpi, `fine` 200 dpi (ASM-09).
- **DET-014** [v1·done·M11] Organization mode offers a level selector (three icon steps); choosing a level asks for confirmation and then re-runs detection.
- **DET-015** [v1·done·M11] During a re-run the previous results stay active; at completion they are swapped in, and jumps, breaks and stops are kept only if the total system count is unchanged, else cleared.
- **DET-016** [v1·done·M10] Organization mode shows detection progress (processing icon, processed/total pages); slide modes show the slide count as "n+" until detection is complete.
- **DET-017** [v1·done·M10] Detection pauses while the user interacts (resumes after `T:detection.idleBeforeResumeMs` without input), while the app is hidden, and under battery saver where detectable.
- **DET-018** [v1·done·M10] If a page fails (error or out of memory), it is retried once at `renderScale` × `T:detection.retryScaleFactor`; if it fails again the page is marked not detected and processing continues.
- **DET-019** [v1·done·M10] Slides and organization bars are usable for every page whose prefix of earlier pages is finished while later pages are still processing.
- **DET-020** [v1·done·M10] Bitmaps are released after each page; only rectangles are retained.
- **DET-021** [v1·done·M10] Navigating to an unfinished page in organization mode makes it the next page processed; its bars are drawn provisional (`T:colors.orgBar.provisionalOpacity`, no numbers, not selectable) until all earlier pages are finished.
- **DET-022** [v1·done·M10] Detection results are cached in runtime memory only.
- **DET-023** [v1·done·M15] If valid embedded detection data exists, detection is skipped.
- **DET-024** [v1·done·M5] Page width, padding and thresholds are computed per page; documents with mixed page sizes are supported.

## PLY — Junctions and playing order (pure logic)

- **PLY-001** [v1·done·M5] For N systems the junctions are 0..N as defined in the glossary; each junction maps to its bars (one, or two at a page change).
- **PLY-002** [v1·done·M6] The playing order is generated by this replay: set position = 0 and all arrival counts = 0; repeat: increment the arrival count at the position; if a jump exists with origin = position and pass = arrival count, set position = its target and repeat; otherwise, if position = N stop; otherwise append system position+1 to the order and set position = position+1.
- **PLY-003** [v1·done·M6] Pass n of a jump means the n-th arrival at its origin junction, counting the start at junction 0, forward steps and jump arrivals.
- **PLY-004** [v1·done·M6] A jump arrival counts as an arrival at its target, and jumps at the target for that pass fire immediately (chaining).
- **PLY-005** [v1·done·M6] Every jump fires at most once, so generation is finite; a safety cap `T:playingOrder.maxLength` truncates the order and sets a flag.
- **PLY-006** [v1·done·M6] When several jumps share origin and pass, the earliest created wins.
- **PLY-007** [v1·done·M6] A jump has an integer pass ≥ 1; its origin and its target may be any junction 0..N, and the target differs from the origin. A jump from junction N fires when the end is reached on that pass (D.C. at the end of a piece).
- **PLY-008** [v1·done·M6] Stops: the order is generated ignoring stops, then cut after the last arrival at a stop junction; with several stops the cut giving the shortest order wins; a jump firing at that last arrival is discarded; a stop junction never reached has no effect.
- **PLY-009** [v1·done·M6] A stop may be set at any junction 1..N-1; at most one stop per junction.
- **PLY-010** [v1·done·M6] The numbers of a system are the 1-based positions at which it occurs in the playing order; a system never played has none.
- **PLY-011** [v1·done·M6] A break at junction k forces a slide boundary between two consecutive entries whenever the playing position visited k between them (straight step, jump origin, jump target or chained jump), on every pass.
- **PLY-012** [v1·done·M6] With no jumps, breaks or stops, the playing order is systems 1..N in print order.
- **PLY-013** [v1·done·M6] A break may be set at any junction 1..N-1.

## ORG — Organization mode

- **ORG-001** [v1·done·M9] Organization mode shows the original PDF as a normal continuous vertical-scroll viewer with small gaps between pages on canvas grey.
- **ORG-002** [v1·done·M9] Only visible pages plus `T:resources.orgRenderPagesAround` pages on each side are rendered.
- **ORG-003** [v1·done·M9] Zoom: default on open is fit-page; the minimum is fit-page; the maximum is `T:zoom.max` × the fit-width scale; the reset button returns to fit-page; content smaller than the viewport is centered; zoom buttons step by `T:zoom.buttonStep`.
- **ORG-004** [v1·done·M9] A "page x of n" indicator shows the page covering the viewport center and updates while scrolling; n counts all pages.
- **ORG-005** [v1·done·M9] Previous/next page buttons and a page slider scroll to a page.
- **ORG-006** [v1·done·M9] Horizontal swipes do not change pages; zoom stays unchanged when the page changes.
- **ORG-007** [v1·done·M9] Drawing is not available in organization mode.
- **ORG-008** [v1·done·M10] Every junction is drawn as a translucent bar over the whitespace gap, full page width: between two systems on a page; for junction 0 from the page top to the top of system 1; for junction N from the bottom of system N to the page bottom; at a page change as two bars (bottom of page p, top of page p+1).
- **ORG-009** [v1·done·M10] Pages without systems have no bars.
- **ORG-010** [v1·done·M10] Bars use `T:colors.orgBar.tint` at `opacity`; a selected junction uses `selectedOpacity`, on both bars of a page change.
- **ORG-011** [v1·changed·M11] Each bar shows one compact row with the stop symbol and the break scissors line. The playing-order numbers are not on the bars but on the music systems (ORG-012); jump markers sit on the systems too (ORG-018). There is no numbering toggle. *(Changed after review: the numbers and jump badges moved from the bars to the systems.)*
- **ORG-012** [v1·changed·M11] Every music system shows its playing-order numbers (PLY-010), ascending and comma separated ("3, 9"), as a label at the height of the system and horizontally centered on the page. The digits cover `T:layout.systemLabelHeightRatio` of the system height, in the light weight `T:layout.systemLabelFontWeight`, with the color and transparency of the bars (`T:colors.orgBar`). A system that is never played has no label. The bars show no numbers. System numbers in the original PDF order are not shown anywhere. *(Changed after review: formerly the numbers of the system above each bar.)*
- **ORG-013** [v1·done·M11] Tapping a bar selects its junction; tapping empty space, Esc or back deselects. Taps in organization mode never navigate.
- **ORG-014** [v1·done·M11] A selected junction shows a chip with icons: jump, slide break, stop, delete (delete only if the junction holds an item).
- **ORG-015** [v1·done·M11] Jump creation: select the origin, tap the jump icon, all other bars become tappable targets with a hint bar and a cancel icon; page navigation and zoom stay active; tapping a bar creates the jump; Esc or back cancels.
- **ORG-016** [v1·changed·M11] After creation a stepper opens to set the pass number (integer ≥ 1). A new jump starts at the number of the existing jumps with the same origin plus one (first jump of a bar 1, second 2, …). *(Changed after review: the default was always 1.)*
- **ORG-017** [v1·done·M11] Several jumps may sit on one junction; two jumps with the same origin and pass are allowed (PLY-006). There are no plausibility checks.
- **ORG-018** [v1·changed·M11] Jump markers sit on the music systems. The start is at the right edge of the source system (system `origin`), vertically centered, with the jump icon rotated by `T:layout.markerRotationDeg` (the split points toward the end of the PDF); the end is at the left edge of the system after the target junction, vertically centered, with a merge icon (arrows coming from the beginning of the PDF). Both carry the label "<previous> → <next> ×<pass>": the playing-order numbers of the system played just before the jump and the one played right after it (the numbers shown on the systems, ORG-012); a number that does not exist (start or end of the playing order) or a jump that is never reached shows `T:layout.unknownNumber`. Both ends have one color from `T:colors.jumpPalette`; several markers on a system stack from the edge. At junction 0 (no source system) the start and at junction N (no next system) the end sit on the bar of that junction. *(Changed after review: formerly badges on the bars with page·bar labels, then print numbers.)*
- **ORG-019** [v1·changed·M11] A long press (`T:layout.longPressMs`) on a jump marker scrolls to the other end of the jump.
- **ORG-020** [v1·changed·M11] Tapping a jump marker selects the jump; the chip then offers pass, change target and delete.
- **ORG-021** [v1·changed·M11] A marks-list button opens the list of jumps, slide breaks and stops in the order of the final playing order: an item is placed where the playing position first meets it (a jump where it fires, a stop where it ends the order). Items that are never reached follow at the end, dimmed: jumps in creation order, then breaks, then stops. Labels use playing-order numbers: jump "<previous> → <next> ×<pass>" with its color, slide break scissors icon and "<previous> | <next>", stop the stop icon and "<previous>". Compact layouts show a sheet; expanded layouts show a panel beside the button on the side of the tool strip, which never covers the viewer's scroll bar. Tapping an entry navigates to it and selects it; a swipe to the left or a trash icon deletes it. *(Changed after review.)*
- **ORG-022** [v1·done·M11] The break icon toggles a slide break on the selected junction; a break shows as a solid line in `T:colors.breakLine` with a scissors icon at the left edge.
- **ORG-023** [v1·done·M11] The stop icon toggles a stop on the selected junction; it shows the stop icon on the bar.
- **ORG-024** [v1·done·M11] Deleting a jump, break or stop is immediate and has no undo.

## SLD — Slide composition

- **SLD-001** [v1·done·M6] A slide's shape is the stored aspect ratio r = width / height.
- **SLD-002** [v1·done·M6] The reference width W_ref is the maximum padded-area width over all systems; every slide is W_ref wide in PDF units and W_ref / r high.
- **SLD-003** [v1·done·M6] Slides are filled greedily in playing order: add the next entry while the stack height stays ≤ slide height; a forced break (PLY-011) ends the slide.
- **SLD-004** [v1·done·M6] Consecutive entries that are adjacent in print order on the same page merge into one region whose height runs from the top of the first padded area to the bottom of the last, keeping the PDF content between them.
- **SLD-005** [v1·done·M6] Entries that are not adjacent in print order, or on different pages, form separate regions stacked directly without a gap.
- **SLD-006** [v1·done·M6] If the first region of a slide is taller than the slide height, that slide holds only that entry and is enlarged to the region's height (and height × r wide); other slides keep their scale.
- **SLD-007** [v1·done·M12] The stack is centered vertically; leftover vertical space is split equally above and below.
- **SLD-008** [v1·done·M12] Leftover space (above, below, left, right) shows real PDF content of the neighboring page area, centered on each region; anything outside the page shows canvas grey.
- **SLD-009** [v1·done·M12] Filler that overlaps the padded area of a system not on this slide is covered, over the full slide width and the vertical extent of that area, by `T:colors.canvasGrey` at `T:colors.overlayOpacity`.
- **SLD-010** [v1·done·M12] The slide is fitted (contain) into the available area; remaining area shows canvas grey. Annotation and presentation mode use the same stored aspect ratio.
- **SLD-011** [v1·done·M12] The display scale is the same on all slides except for slides enlarged by SLD-006.
- **SLD-012** [v1·done·M12] After any change that recomputes slides (ratio, detection, jumps, breaks, stops), the current slide is the one containing the first entry of the previously shown slide.
- **SLD-013** [v1·done·M5] Aspect-ratio steps: range `T:aspectRatio.min` to `max`; "show more" moves to the next lower multiple of `T:aspectRatio.step` strictly below the current value, "show less" to the next higher multiple strictly above (1.78 → 1.7 / 1.8); results are clamped.
- **SLD-014** [v1·done·M12] The global default ratio is stored per orientation; its first value is the presentation-mode viewport ratio captured at the first presentation entry in that orientation, before that the device screen ratio; rounded to `T:aspectRatio.roundDecimals` and clamped.
- **SLD-015** [v1·done·M12] Changing the ratio with the buttons creates or updates a per-PDF override for the current orientation, stored in the embedded data; on read-only files it exists in memory only.
- **SLD-016** [v1·done·M12] Annotation mode shows "slide x of n" with previous/next buttons and a slider; presentation mode shows no indicator.
- **SLD-017** [v1·done·M12] "Show more" and "show less" buttons are in the bottom bar (expanded) or the overflow menu (compact), in annotation mode.
- **SLD-018** [v1·done·M12] When zoomed in, the visible part of the slide is re-rendered at higher resolution after the gesture settles; the old bitmap is stretched meanwhile.

## ANN — Annotation

- **ANN-001** [v1·done·M14] Tools are pen, highlighter, eraser. The active tool's button has the toggled look (UIX-011).
- **ANN-002** [v1·done·M14] Tapping an inactive tool activates it; tapping the active tool deactivates it; a long press on the pen or highlighter button opens the color/width popup.
- **ANN-003** [v1·done·M14] Each tool remembers its last color and width index in the preferences store; defaults `T:annotation.defaultPen` and `defaultHighlighter`.
- **ANN-004** [v1·done·M14] Pen and highlighter each offer 6 color presets and 3 widths (`T:colors.penPresets`, `highlighterPresets`, `T:annotation.penWidthsPt`, `highlighterWidthsPt`); the highlighter uses opacity `T:annotation.highlighterOpacity` with multiply blending.
- **ANN-005** [v1·done·M15] The eraser removes whole ink annotations whose path lies within `T:annotation.eraserHitRadiusPx` of the pointer, including ink made by other apps; it has no width setting.
- **ANN-006** [v1·done·M14] Undo and redo cover added and erased strokes per document, up to `T:annotation.undoDepth` steps, and are cleared when the document closes.
- **ANN-007** [v1·done·M14] Drawing works only in annotation mode; entering presentation or organization mode deactivates the tool, and returning does not restore it.
- **ANN-008** [v1·done·M14] While a tool is active, one pointer draws, two pointers zoom and pan; tap zones and swipes are off; pedals, buttons, slider and wheel still navigate.
- **ANN-009** [v1·done·M14] A stroke belongs to the page of the region where it started and is stored in that page's coordinates, even where it continues over other regions or beyond the page edge.
- **ANN-010** [v1·done·M14] A stroke started on filler belongs to the page of the filler content; a stroke started on canvas grey is ignored.
- **ANN-011** [v1·done·M14] The live stroke is drawn on its own canvas layer, only new segments once per animation frame using coalesced pointer events; no per-point change detection; a finished stroke is simplified (`T:annotation.simplifyEpsilonPt`) and committed once.
- **ANN-012** [v1·done·M14] A stroke on a region shown several times in a slide appears on all occurrences.
- **ANN-013** [v1·done·M14] Navigation commands that arrive while a stroke is in progress are applied after the stroke ends.

## NAV — Navigation and input

- **NAV-001** [v1·done·M13] All inputs (keys, wheel, taps, swipes, pinch) are translated into semantic commands by one input layer driven by `T:keymap`; components react to commands only.
- **NAV-002** [v1·done·M13] Keys (`T:keymap`): next = PageDown, ArrowRight, ArrowDown, Space; previous = PageUp, ArrowLeft, ArrowUp, Shift+Space; first = Home; last = End. Keys with Ctrl, Alt or Meta are ignored.
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

## UIX — Layout and modes

- **UIX-001** [v1·done·M7] The modes are organization, annotation and presentation; the current mode is global state.
- **UIX-002** [v1·done·M7] A segmented three-icon control switches modes, in the same place in both layouts; the active mode is filled, the others outlined; it is hidden in presentation mode.
- **UIX-003** [v1·done·M7] The layout is compact if viewport width < `T:layout.compactMaxWidthPx` or height < `compactMaxHeightPx`, else expanded.
- **UIX-004** [v1·done·M7] Compact annotation layout: top bar with tab switcher, open-file, mode switch, undo, redo; bottom bar with previous, "slide x of n", next, zoom −, zoom +, zoom reset; one floating button expands to pen, highlighter, eraser; aspect-ratio buttons and the version info sit in the overflow menu.
- **UIX-005** [v1·done·M7] Expanded annotation layout: tab bar on top; vertical tool strip on `T:layout.toolStripSide` with pen, highlighter, eraser, undo, redo; popup next to it; the same bottom bar plus the aspect-ratio buttons.
- **UIX-006** [v1·done·M7] Organization layout uses the same frame; the tool strip is replaced by level selector, marks-list button and overflow; the bottom bar shows "page x of n", previous, next and zoom buttons. In compact layout the organization controls sit behind one overflow button that opens a sheet.
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
- **PLT-011** [v1·todo·M17] On every push the E2E suite runs on Chromium, Firefox and WebKit, including Android and iPad/iPhone device profiles.
- **PLT-012** [v1-optional·todo·M18] The `ios` Capacitor shell is committed; deployment target iOS 16.4; Info.plist declares PDF as a supported document type with open-in-place.
- **PLT-013** [v1-optional·todo·M18] iOS adapters provide: status bar and home indicator hidden in presentation, keep-awake, document picker with write access, "open with" via the URL-open event, safe-area insets.
- **PLT-014** [v1-optional·todo·M18] All iOS code is marked `// UNVERIFIED(ios)` until a tester has run it on a device.

## NFR — Non-functional

- **NFR-001** [v1·todo·M17] A slide change completes in ≤ `T:budgets.slideChangeP95Ms` (95th percentile) with neighbors prefetched.
- **NFR-002** [v1·todo·M17] While drawing, added latency stays ≤ `T:budgets.drawingMaxAddedLatencyMs` and no main-thread task exceeds `drawingMaxLongTaskMs`.
- **NFR-003** [v1·done·M8] One scheduler ranks work: input and drawing, then visible rendering, then neighbor prefetch, then saving, then detection; lower-priority work is paused or cancelled when higher-priority work needs the CPU.
- **NFR-004** [v1·done·M8] A bitmap cache with a byte budget (`T:resources.cacheBudgetByDeviceMemoryGb`, default `cacheBudgetDefaultBytes`) evicts least recently used bitmaps first.
- **NFR-005** [v1·done·M8] The device pixel ratio used for rendering is capped at `T:resources.devicePixelRatioCap`.
- **NFR-006** [v1·done·M8] No canvas exceeds `T:resources.maxCanvasPixels`.
- **NFR-007** [v1·done·M9] Zoomed views (organization pages and slides) render only the visible tiles, each at most `T:resources.tileSizePx` wide and high.
- **NFR-008** [v1·done·M8] Stale render tasks are cancelled when the view changes.
- **NFR-009** [v1·done·M8] Inactive tabs release their bitmaps and keep only lightweight document data.
- **NFR-010** [v1·done·M8] Under memory pressure the app degrades in this order: drop prefetch, lower render resolution, free inactive tabs' bitmaps; it never fails outright.
- **NFR-011** [v1·done·M10] Every OpenCV object is released in a `finally` block.
- **NFR-012** [v1·done·M10] OpenCV.js is loaded only inside the detection worker, lazily on first use, from the app's own assets (no CDN).
- **NFR-013** [v1·done·M15] There is no hard PDF size limit; a failed save shows the error icon and does not crash.
- **NFR-014** [v1·done·M1] The initial bundle stays within `T:budgets.initialBundleKbGzip` (Angular build budget).
- **NFR-015** [v1·todo·M16] After the OS kills the WebView, the next start restores tabs and positions; unsaved loss is limited to the autosave delay.
- **NFR-016** [v1·todo·M17] A reference PDF with 100+ pages (one scanned) runs within the budgets on a mid-range small tablet.

## ARC — Architecture rules

- **ARC-001** [v1·done·M1] The folders `core/`, `ports/`, `adapters/`, `state/`, `input/`, `features/`, `config/` exist; ESLint boundary rules allow only inward dependencies and CI fails on violations.
- **ARC-002** [v1·done·M1] `core/` imports nothing from Angular, the DOM or third-party libraries and is deterministic.
- **ARC-003** [v1·done·M1] The app uses standalone components, signals, OnPush, zoneless change detection and strict TypeScript, following the current official Angular style guide and `ng generate` naming.
- **ARC-004** [v1·done·M1] All numbers, colors, icon names and key bindings come from `src/config/tunables.ts`.
- **ARC-005** [v1·done·M4] Errors cross port boundaries as typed results; the UI shows icons, not messages.
- **ARC-006** [v1·done·M13] A single place in the input layer decides whether a pointer draws or navigates.

## PIP — Pipelines and versioning

- **PIP-001** [v1·changed·M1] Pipeline `lint-test` runs on every push to every branch (not on tag pushes): lint, lint self-test, unit tests and the production build. E2E on three engines runs in the separate workflow `e2e` on every push, one job per Playwright project (nine in parallel), each building for itself; it is temporarily optional: `deploy-web` and `android` do not wait for it (DEC-100). No artifacts are used (free-account storage quota).
- **PIP-002** [v1·done·M1] Pipeline `deploy-web` builds and deploys to Firebase Hosting, triggered by `workflow_run` after a successful `lint-test` on any branch (each branch push deploys to the live channel).
- **PIP-003** [v1·done·M3] Pipeline `android` builds a signed APK and uploads it to Firebase App Distribution, triggered like PIP-002.
- **PIP-004** [v1-optional·todo·M18] Pipeline `ios-compile` runs an unsigned simulator build on a macOS runner, triggered like PIP-002.
- **PIP-005** [v1·done·M2] The version string is `git describe --tags --always --long` (checkout with full history), injected at build time and shown in the app (UIX-015).
- **PIP-006** [v1·done·M3] Android `versionName` is the version string and `versionCode` is the commit count.
- **PIP-007** [v1·done·M1] Pipelines 2–4 share a composite action that builds the web app.
- **PIP-008** [v1·done·M0] Signing keys and Firebase credentials exist only as GitHub secrets; their names are listed in `docs/milestones/V1-M00.md`.
- **PIP-009** [v1·done·M2] Milestone `V1-M<m>` is tagged `v0.<m>.0` and fixes `v0.<m>.<p>`; the release of v1 additionally tags the commit of the last included milestone `v1.0.0`; a tag deploys nothing by itself.

## TST — Testing

- **TST-001** [v1·done·M4] Every `core/` function has unit tests written before its implementation; test names contain the requirement ID.
- **TST-002** [v1·todo·M17] A golden detection corpus (engraved and scanned PDFs with expected system counts per page) runs in CI; every reported problem PDF joins it.
- **TST-003** [v1·todo·M17] A round-trip test annotates, saves, reopens and checks that strokes and embedded data survive and the PDF still loads.
- **TST-004** [v1·done·M1] Playwright is configured with Chromium, Firefox and WebKit projects and phone and tablet device profiles.
- **TST-005** [v1·done·M1] Code that exists only for Safari/WebKit changes only together with a Playwright WebKit test.
- **TST-006** [v1·todo·M17] A manual device checklist covers pedals, full screen, wake lock, "open with", in-place save and performance on a real Android tablet.
- **TST-007** [v1·todo·M17] A tester checklist for iOS Safari (open, scroll, draw, save a copy, presentation mode, pedal) is delivered with the hosted URL.
- **TST-008** [v1·todo·M17] A performance test on the reference PDF fails the pipeline when a budget in `T:budgets` is exceeded.

## STY — Stylus support (v1-optional)

- **STY-001** [v1-optional·todo·M19] The first pointer event with `pointerType` `pen` sets a persisted flag `stylusSeen`.
- **STY-002** [v1-optional·todo·M19] With `stylusSeen`, the pen draws and fingers zoom, pan, tap and swipe but never draw; tap zones and swipes work with a tool active.
- **STY-003** [v1-optional·todo·M19] A setting "allow finger drawing" in the pen popup (default `T:stylus.allowFingerDrawingDefault`) lets fingers draw even with `stylusSeen`.
- **STY-004** [v1-optional·todo·M19] Touches are ignored while the pen is in contact or hovering and for `T:stylus.palmRejectionGraceMs` afterwards.
