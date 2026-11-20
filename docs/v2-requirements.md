# App V2: Consolidated Requirements (status: interview in progress)

## 0. How to use this document
- Requirement IDs (R-xxx) carry the latest agreed wording. Idea numbers (#n) and backlog IDs (BKL-xxx) are kept for traceability.
- Answer categories used in the interview: (1) details now, (2) queue for later, (3) postpone until V1 can be checked, (4) clarify interactively during implementation.
- "Tunables" means the bundled tunables file (see R-12d). "V1 check" means the review of the V1 app/code (category 3).
- Process (#45): the public "grillme" skill was not available. The interview was run manually, one question at a time.

## 1. General rules
- **R-UX1:** User-facing settings are abstract and non-technical. Algorithm parameters live in tunables. Explicit exception: the detection popup (R-19c).
- **R-6e:** Wherever a long click is specified, the desktop equivalent is whatever mechanism V1 uses (V1 check). No special right-click rule.
- **R-6d:** One global "Reset all settings" in global settings resets all user settings (palette colors, thicknesses, language, highlight mode, marks switch, dead time, suppressed warnings, per-file choices). It never touches file content (marks, annotations). Confirmation precedes it (assumed).
- **R-14b:** No significant changes to V1 code, no architecture changes unless well justified and explained first. Clean, minimal, readable code, no leftovers, use existing libraries.
- **R-14c:** Automated checks (unused code/dependencies, lint, license check) run in the fast CI workflow.
- **R-14a:** V1's dummy-data mechanism is removed and replaced by real PDFs.
- **R-12c:** Tunables file is self-explanatory with comments (units, meaning), defaults visible.
- **R-12d:** Tunables and feature configuration are bundled at build time. If V1 loads them from an editable location, change it without asking.

## 2. Editions, monetization, legal
- **R-22a:** Free mode is strictly read-only: no save, no Send to, no export, no persistence of any kind. In-session changes (annotations, marks, organization) work but stay temporary.
- **R-22b/c/d:** Blocked actions are visible but disabled (shows what paid offers). Web app behaves exactly like the free version. Free version persists no app state (settings, zoom, recent files, per-file choices).
- **R-22e:** Free feature set is configured per platform in two separate feature-configuration files (web, native). The paid native build enables all. Separate from general tunables. Each build bundles only its own file. Each feature has an on/off switch with a comment.
- **R-22l:** Web-only organizational features (V3: imprint, documentation, manual, advertisements) are controlled by the web file only.
- **R-22g:** Free and paid are separate apps per store (4 listings). One codebase, feature set selected at build time. Web = free.
- **R-22h:** Paid is a one-time purchase. Price decided at release (suggestion about 4.99 EUR).
- **R-22i:** Distinct app IDs for free and paid, fixed before first publish (decide during implementation).
- **R-22j/k:** Tests: free build disables every paid feature and contains no file-writing path, paid enables all, each configuration is tested separately, a feature without a switch in every configuration fails the build.
- **R-32a:** You own the store accounts. I guide setup. Paid-app tax and banking steps are done by you (Germany: business registration, tax number, imprint; consult a Steuerberater). Add a plan step "business and tax preparation" before the first paid release.
- **R-8a:** V2 sends no data to any server (no crash reporting/analytics, BKL-020 not in V2).
- **R-8b:** Web app must store no cookies/local storage/IndexedDB. Verify in V1 check and add an automated test.
- **R-8c:** Native apps store PDFs and configuration locally only. Store privacy declarations state "no data collected". Legal assessment is yours or a lawyer's.
- **R-8d:** Verify V1 loads no third-party libraries, fonts or CDN resources. Add an automated test failing on requests to external hosts.
- **#42 Legal protection:** Closed-source license (EULA/proprietary terms), technical protection: no source maps in production builds. **#48:** Minify production builds. **#49:** Automated dependency license check for closed-source commercial compatibility (no GPL/AGPL). (Not yet discussed in detail.)

## 3. Files and top bar
- **R-1a:** No Save button. Autosave as in V1 (triggers: V1 check). In free/web, autosave is off.
- **R-1b:** Open is integrated with the file title. No Save button.
- **R-1c:** File entry shows name, modified marker, "x" (in that order).
- **R-1d:** Modified marker shows unsaved changes. In free/web it is the only indicator.
- **R-1e:** Click on current file entry opens the list of all open files. Replaces V1 tabs.
- **R-1f:** Previous/next file buttons left and right of the entry, no labels. Disabled at the ends (assumed).
- **R-1g:** "+" button right of them opens a new file, replaces V1 Open button.
- **R-1h:** Entry uses almost the full top-bar width. Drop-down list also full width. Ellipsis only as fallback.
- **R-1i:** No reordering in V2. Order is opening order.
- **R-1j:** Opening via file picker as in V1. New: accept PDFs from the system share sheet / "Open with" on Android and iOS (not web).
- **R-1k/l/m/n:** No file-count limit, no eviction logic. Inactive files release rendered data. Referenced files look like other files. Stress test with many real PDFs on an emulated low-memory device.
- **R-54a/d:** Overwrite confirmation at the first autosave of a file per session, once per file per session. Whether autosave waits for the answer: V1 check (safe default: no overwrite before the answer).
- **R-54b:** Dialog offers "Overwrite", "Save as new file" (new location becomes the input file), "Cancel".
- **R-54c:** Option to disable for this file or for all files, persists across sessions.
- **R-54e/f:** iOS autosave/reopen must be verified (Files app, iCloud Drive, other providers). Unwritable file: warn once per file per session, offer "Save as new file", modified marker stays. Shared-in copies are treated as read-only if no write access.
- **R-54h/i/j/k:** Per-file choice uses V1's file identification (name/path based, one single mechanism everywhere), stored in local settings, cleared by Reset. Open conflict: see section 11.
- **R-21a:** "Send to" produces one PDF with annotations flattened as standard PDF content and marks in the file metadata.
- **R-21b/c/e:** Sent via system share sheet where available or saved as a local copy. Paid native only. Desktop browsers behave like free (visible, disabled, no download).
- **R-21d/f/g:** No printing at all. Exported annotations need not stay editable. Original PDF is never changed. Working file (editable data via autosave) and exported flattened copy are distinct.
- **R-30f/g/h:** Opening a file with cross-file marks tries to open referenced files too. On failure: warning, metadata untouched. In slide mode, an unresolved jump stops the presentation at that position.
- **R-30i:** Closing a referenced file keeps marks and shows an immediate warning with "Don't show again" (persisted, cleared by Reset).
- **R-30j:** Already open file stays current. Referenced files open in the background.
- **R-30k:** Opening a file whose content matches an open file reuses and switches to the open one.

## 4. Marks, jumps, bookmarks
- **R-19b/R-19f/R-28n:** Organization mode has tools: detection, refine, delete, bookmarks, start, stop, jumps. No tool active by default. Pressing the active tool again deactivates it. Only one active at a time. Choosing another tool cancels a half-defined mark.
- **R-28a-c/o:** Actions trigger on systems, not bars. Active areas are the left and right ends of a system, width from tunables (start value 20%, tuned in implementation). Right end: jump start, stop mark. Left end: jump target, start mark, bookmark. With the jump tool, right end sets the start, left end sets the target. Wrong end does nothing.
- **R-28d:** Choosing jump start prompts for the target and vice versa (as V1).
- **R-28e/f:** Every mark can have a user text label. Every mark is automatically labeled with the original PDF page number. Jumps show "start page -> target page". Both shown together.
- **R-30a/e:** Cross-file marks label "filename:page" (jumps "fileA:5 -> fileB:2"). Same-file marks show page only.
- **R-28g/h/i:** Chosen system gets a highlight at the clicked end, candidates (both directions, all systems) at the opposite end, same width setting. Candidate opacity modes chosen by the user with abstract labels: linear (default), exponential, constant. N, H, floor in tunables.
- **R-28j:** Cancel half-defined jump by tapping elsewhere, Escape, tapping the chosen system again, Android back.
- **R-28k:** Conflicts (clicking a system that already has a mark) as in V1 (V1 check).
- **R-28l:** Labels inside the colored marker, shown in organization mode and marks list.
- **R-28m:** Marks hidden in annotation mode by default, optional global setting "Show marks while annotating". Never shown in slide mode.
- **R-28p/q:** Creating marks never scrolls the view on its own (except user-triggered file switch for cross-file). Tests compare scroll position.
- **R-28r:** No label length limit. Marker grows or wraps, never overlaps or leaves the screen.
- **R-29a-f:** Bookmarks have their own color set in tunables, cycling assignment as V1 jumps. Start marks fixed green, stop marks fixed red (tunables). Multiple marks on one system sit side by side.
- **#50/R-59a:** Stop marker larger and colored. **#59:** Start marker similar, labelable.
- **R-30b/c/d:** Cross-file bookmarks and jumps. Targets only from open files, picked by switching to the other file. Pending state survives the file switch. Closing the source or other file cancels it.
- **R-40a/b/c:** Marks list button grayed out when no marks (including cross-file ones referencing the file). Tapping an entry scrolls in the current mode (slide-mode behavior: V1 check). Reading order. Delete from list exists in V1. No editing from list, no filter.

## 5. Detection and refinement
- **R-18a/b:** Auto-detection on loading a new file. Metadata with systems skips detection.
- **R-18c:** Short click on the detection tool offers: rerun all pages, current page, cancel. No extra confirmation for refinements (undo covers it).
- **R-18e (requirement):** Detection continues when the app is not in focus. Mechanism per platform decided in V1 check/prototype (web worker, Android foreground service, iOS limited). Resumes cleanly. Report platform limits to the owner.
- **R-18f:** No cancel of a running detection. Short click on the tool during a run is ignored.
- **R-18g:** Behavior during detection as V1.
- **R-19a/c:** V1's three manual detection buttons removed. Long click on the detection tool opens a popup: min/max system width (units of page width), min/max system height (units of page height), resolution in DPI. Technical on purpose. Defaults from V1 internal values.
- **R-19d/i/j:** Global settings checkboxes: highlight systems (filled transparent area with soft fading edges, replaces outline), highlight vertical-space bars (V1), number systems. When fill is on, numbers get a cut-out or contrasting color.
- **R-19g:** Bars are no longer clickable.
- **R-36a-d:** Refine tool = rectangle tool, resizable via corners/edges. Long click popup with one boolean: (a) save rectangle as new system box at the right position in the list, or (b) hint mode: largest combined bounding box of detected boxes inside. **R-36h:** If hint mode finds nothing, the drawn rectangle is accepted, no message. Delete tool deletes any system with a click. Move/split via delete plus redraw.
- **R-36i:** Refinement only works on pages whose detection has finished.
- **R-55a:** Undo/redo covers all tools in both modes, separate history per mode. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z work in annotation and organization mode.
- **R-10a-h:** System number weight depends on the aspect ratio of the system's own box (wide and flat bolder, mapping in tunables). Size as V1 (height in units of system height), reduced when it doesn't fit the width. Tiny safety floor in tunables.
- **R-37a/b/c:** Organization mode uses annotation mode's progress indicator: x/n page counter at the right end of the horizontal scroll bar, n = processed pages with trailing "+" during detection. V1's separate left counter is removed.

## 6. Annotation tools
- **R-20a:** Tools: pen, highlighter, eraser (V1) plus text, music stamps, mover. **#56:** hand drawing button removed (drawing/scrolling switch as V1, R-56a/b, verify that stylus mode covers it).
- **R-20i:** Pen, text and stamp share one color. Palette and color chooser exist only in the pen popup. Highlighter has its own color.
- **R-6a/b/c:** Long click on a tool opens palette plus stroke width settings (V1). New: long click on a palette color opens a color chooser. Defaults and long-click duration in tunables.
- **R-7a-g:** Thickness is one value per tool with thinner/thicker buttons (replace the 3 presets). Step/min/max in tunables, buttons disabled at limits, per-tool memory. Preview next to the buttons. Pointer cursor: circle at actual stroke size in tool color with contrasting ring, crosshair only for very thin strokes, plain circle for thick ones, scales with zoom. Touch: temporary preview after each change.
- **R-20b-c:** Stamp tool draws on each click, size via smaller/larger like thickness.
- **R-20p:** Stamp popup shows n (default 8, tunables) most recently used stamps in a 3x3 grid, the ninth cell is three dots opening a scrollable submenu with all symbols. Free/web always starts with the tunables set. Tool button shows the selected symbol. Cursor shows a stamp preview. No stamp group text needs translation.
- **Symbol source (flat list):** dynamics, accidentals, fingering, strings/bowing, winds/breaths, articulation, rehearsal/navigation (letters, numbers, segno, coda, D.C., D.S., fine), warnings (glasses, check, arrows, circle, asterisk). Initial 8 finalized in implementation.
- **R-20j:** Text tool with default size and smaller/larger. Writing cursor on click, cursor also serves as preview.
- **R-20m/n:** Multiline text, confirmed by tapping elsewhere, editable by clicking it with the text tool active. Empty text creates nothing (assumed).
- **R-20g/h:** Mover tool moves any annotation in x/y, selects like the eraser. No resize after drawing.
- **R-52a/b/c:** Only the highlighter gets less transparent/darker, fixed value in tunables, tested on real PDFs (value chosen in V1 check).
- **R-53a/b:** After changing tool, color, thickness or closing a popup, drawing works immediately. A tap that closes a popup never draws. Drawing only on the drawable PDF area.

## 7. Slide construction, zoom, rendering
- **R-4b/c:** Annotation mode bottom bar (right side): aspect ratio increase/decrease (steps as V1), start value = device full screen ratio in current orientation. The PDF area is the largest area for that ratio, remaining strips dark gray (tunables). On change, briefly show highlighted rectangle and value.
- **R-60a-e:** Page-break control: off (V1 packing), auto (V1 packing plus slide break after each page, optimal distribution), 1 to 4 slides per page (systems split by equal total height, whole systems only). For 1 to 4, aspect ratio setting is ignored, full device screen used, aspect buttons disabled. Fixed breaks and break hints are ignored in 1 to 4. User setting, per app.
- **R-23a-f:** Left/right free areas are filled with the real PDF content beside the systems, undimmed (new vs V1). Vertical dimming unchanged. Applies in annotation and slide mode and in 1 to 4 modes. Gray only where the page has no content. Slide mode is full screen without any controls. **#24 padding reduction: dropped.**
- **R-39b/c, R-26a:** Organization mode bottom bar keeps page indicator and navigation, with standard PDF-viewer zoom (in/out, fit page, fit width, 100%, other percentages), restored on reload.
- **R-26b/c/d:** Annotation mode zoom by gestures with the zoom center following the gesture (V1 keeps view center). Slide mode: no zoom. Other zoom controls as V1.
- **R-27a/b:** Correct tile reloading/placement after zoom, performant (placeholder scaling, render when settled, cancel stale requests).
- **R-58a-e (#51 merged):** Pages/tiles are never left blank. Visible-first render priority, cancellation, bounded queue, watchdog re-requests empty visible areas. Stress tests with seeded random rapid jumps/scrolls, zoom sequences, rendering during detection, performance budgets in tunables.
- **R-17a-d:** Dead time in slide mode, one value for all triggers, global setting shown in seconds (default 0.5 s, min/max/step in tunables). Ignored triggers are dropped, not queued. No dead time outside slide mode.
- **R-38a/b:** Remove only the browser's right-hand page scroll bar on desktop. PDF-area scroll bars stay.
- **R-57a/b (#57):** Automatic full screen when entering slide mode on desktop browsers works well in V1 and stays unchanged. Verify in the V1 check, including leaving slide mode and Escape. No new tests.

## 8. Settings, languages, branding, distribution
- **R-12a/b:** Settings is its own mode, rightmost top-bar button (three lines). Grouped (e.g. General, Display, Slide mode, Files). Pedal key remapping not in V2.
- **R-47b/g/i:** Languages: English, German (mandatory), Spanish, French, Italian, Portuguese (Brazil), Dutch. Follow system, changeable in settings, fallback English. I provide translations, German reviewed by you, native-speaker check before release discussed later. Automated test: every key exists in all languages, no cut-off text.
- **R-46a-d:** Tooltips on all devices, triggered as in V1. Always inside the screen, multiline allowed (max width in tunables). Tested at all edges.
- **R-5a-d:** Icons are chosen by you during implementation. I explain where they live. Icons in one place, replacements go through normal tests, each button keeps an accessible label.
- **R-2a/b:** One image for app icon and favicon (V1 favicon reused, check resolution, Apple needs 1024x1024 without transparency). Build check for all sizes.
- **R-34a-d:** Store texts in all seven languages, store documentation (privacy policy, privacy/data-safety answers, support info, age rating, Apple review notes), screenshot suggestions. Branding discussed later. Prepared at the end, early milestone for texts/docs.
- **R-35a:** Simple flyer as PDF and JPG, produced at the end. No video.
- **R-16a-f:** Users see only vX.Y.Z. Detailed build info only in internal places. Free and paid share the version. One single source. Store build numbers auto-increment from CI. Build check enforces consistency.
- **R-19m-t (first-run hints, BKL-019):** Tip bubbles only (no intro screen), each next to the control or area it explains, replacing a handbook. Shown once, at the moment the step becomes relevant, following the typical workflow: (1) open a file in organization mode, (2) detection progress, (3) detected systems shown, (4) creating marks of different kinds, (5) change to annotation mode, (6) change aspect ratio, (7) pen annotation, (8) change to slide mode. No hints for the detection tool or refine tool. Global-settings checkbox (General group, assumed) turns all hints off. "Reset all settings" turns hints back on. Free/web: at most once per session (nothing persists). Bubbles never block input, disappear on tap or after a tunables timeout, stay inside the screen and never cover the control they explain. All eight texts exist in all seven languages. Tests: appear at trigger, once only, suppressed by switch, shown again after reset.

## 9. Testing, CI
- **R-11a/b:** Emulated devices: small and large Android phone, Android tablet, iPhone, iPad, desktop Chrome/Firefox/Safari. Check what V1 already has. Long-running tests don't block the pipeline. No device farms in V2.
- **R-13a-g:** Real-PDF collection: repository folder plus URL list (downloaded and cached, checksum verified, failures skipped with warning), either may be empty. You ensure copyright-free PDFs, license note per PDF. Expectation file per PDF maps page to number of detected systems. Helper script generates it (never overwrites edited files without a flag). Used as detection regression tests and performance tests.
- **R-15a/b:** Coverage reported per kind of test (unit, integration, e2e/emulator, real-PDF detection, performance). No failing threshold at first.
- **R-44a:** Fast unit tests on every push. Emulator and e2e tests (V1 e2e moved) before merges/releases. All workflows manually triggerable.

## 10. Parked for V3 / later
- #31 content copy between files (scope R-31a to c recorded: only content made in this app, only for identical/very similar PDFs).
- #9 PDF from URL, Internet search, AI search.
- #41 native desktop apps (Windows, Linux, macOS).
- BKL-003 setlists. BKL-011 per-pass slide breaks. BKL-014 good-place-to-turn markers.
- BKL-002 stylus pressure sensitivity, BKL-004 ML-based detection, BKL-005 deskew and noise handling, BKL-018 page rotation, BKL-024 password-protected PDFs, BKL-015 external file change detection.
- Dark mode, Japanese, Simplified Chinese. Crash reporting/analytics (BKL-020). Device farms (BKL-022). Pedal key remapping (BKL-009). File reordering in list. Web organizational features (imprint, manual, ads).

## 11. Open conflicts and questions
1. **File identity:** Cross-file marks, duplicate detection and per-file choices were designed around fingerprints, but V1 uses names/paths. Decide after V1 check: keep name/path (renamed files must be re-opened) or add fingerprints. Duplicate detection needs content comparison either way.
2. Default values to choose: stamp initial 8, active-area width, highlight colors/fade, tooltip max width, dead-time limits.
3. Native-speaker review plan for the six non-German languages.
4. Price and Impressum/tax details at release.

## 12. V1 check list (category 3)
Tunables file structure and location (bundled?), long-click mechanism on desktop, autosave triggers and dialog behavior, mark conflicts, jump color assignment, drawing vs scrolling switch and stylus coverage, marks list per mode (slide mode), tooltip triggers, translation support, local storage use, external requests, file identity (name/path), cross-file file finding, aspect-ratio steps, closing unsaved files in free version, elements V1 shows in a system, detection internal defaults and behavior while detecting and unfocused, rendering/tile root causes, iOS file access and PDF handler declaration, share-in support, version creation and display, existing e2e/emulator tests, memory release of inactive files, V1 favicon resolution, highlighter current opacity.

## 13. Ideas not yet discussed
#43 competitor research, #42/#48/#49 details, #55 mac shortcuts detail, BKL-008 metadata backup and library, BKL-013 split a system mid-line, BKL-021 PR preview deployments, BKL-023 drawing in organization mode and annotating unplayed systems (question open: either part in V2, V3 or dropped).
