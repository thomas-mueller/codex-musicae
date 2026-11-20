# App V2: Final Requirements

Status: agreed 2026-11-20 after the V1 check and the point-by-point review of the interview draft (committed as `107660e`, `git show 107660e:docs/v2-requirements.md`). This file is the input for writing V2 milestones.

## 0. How to read this document
- Requirement IDs (R-xxx) carry the final wording. Idea numbers (#n) and backlog IDs (BKL-xxx) are kept for traceability. `D-n` marks a decision taken in the review (section 11).
- "Tunables" = the bundled tunables file (R-12d). Feature switches live in the feature-configuration files (R-22e).
- Lines starting with "_V1:_" state V1 facts with V1 IDs (`docs/requirements.md`, `docs/decisions.md`, `docs/limitations.md`) or file paths, only where needed to understand the change.
- Items marked **(impl)** are settled during implementation (category 4).- Constraint on all work: no significant changes to V1 code or architecture unless justified and explained first (R-14b).

## 1. General rules
- **R-UX1:** User-facing settings are abstract and non-technical. Algorithm parameters live in tunables. Exception: the detection popup (R-19c).
- **R-6e:** Wherever a long click is specified, the desktop equivalent is holding the mouse button for the long-press time. No special right-click rule. _V1: `LongPressDirective`, `T:layout.longPressMs` = 500 ms; right-click only on the open-file control._
- **R-6d:** One global "Reset all settings" in global settings (after confirmation) resets all user settings: palette colors, thicknesses, language, highlight mode, marks switch, dead time, suppressed warnings, per-file choices (R-54h), first-run hints. It never touches file content (marks, annotations). The stylus flag no longer exists (D-17).
- **R-14b:** No significant changes to V1 code, no architecture changes unless well justified and explained first. Clean, minimal, readable code, no leftovers, use existing libraries.
- **R-14c:** Automated checks (unused code/dependencies, lint, license check) run in the fast CI workflow. _V1 has lint, template, static-compliance, iOS-config, agent-copy and traceability checks; no unused-code, unused-dependency or license check._
- **R-14a:** V1's generated synthetic PDFs are replaced by real PDFs (R-13). Only synthetic fixtures for failure cases real PDFs cannot cover stay: damaged, zero pages, blank page, encrypted (D-22). The generated 120-page reference and synthetic scores are replaced by real PDFs. _V1 scripts: `make-test-pdfs.mjs`, `make-corpus.mjs`, `make-large-pdf.mjs`._
- **R-12c:** The tunables file is self-explanatory: every value has a comment with unit and meaning, defaults visible. Small work item.
- **R-12d:** Tunables and feature configuration are bundled at build time (as V1, no change).

## 2. Editions, monetization, legal
- **R-22a:** Free mode is strictly read-only: no save, no Send to, no export, no persistence of any kind. In-session changes (annotations, marks, organization) work but stay temporary.
- **R-22b/c/d:** Blocked actions are visible but disabled. The web app behaves exactly like the free version. The free version persists no app state (settings, zoom, recent files, per-file choices).
- **R-22e:** Free feature set is configured per platform in two separate feature-configuration files (web, native). The paid native build enables all. Separate from tunables. Each build bundles only its own file. Each feature has an on/off switch with a comment. **All features must stay technically possible in the code** (persistence, saving, recent files, restore, ...); free/web only switches them off (D-7).
- **R-22l:** Web-only organizational features (V3: imprint, documentation, manual, advertisements) are controlled by the web file only.
- **R-22g:** Free and paid are separate apps per store (4 listings). One codebase, feature set selected at build time. Web = free.
- **R-22h:** Paid is a one-time purchase. Price decided at release (suggestion about 4.99 EUR).
- **R-22i:** Distinct app IDs for free and paid, fixed before first publish (decide during implementation). _V1: one ID `app.web.codexmusicae`._
- **R-22j/k:** Tests: the free build switches off every paid feature, and tests prove it unreachable (no save UI, no file write is ever made; D-32); the paid build enables all; each configuration is tested separately; a feature without a switch in every configuration fails the build.
- **R-32a:** The owner holds the store accounts; setup is guided. Tax and banking steps for paid apps are the owner's (Germany: business registration, tax number, imprint; consult a Steuerberater). The plan gets a step "business and tax preparation" before the first paid release.
- **R-8a:** V2 sends no data to any server (no crash reporting/analytics, BKL-020 not in V2).
- **R-8b:** The web build with its default (free) feature configuration stores no cookies, localStorage, sessionStorage or IndexedDB. An automated test checks this on the web build (D-7). The persistence code stays in the code base for the paid native configuration. The PWA service-worker cache for the app's own files is allowed (D-9). Consequence: the web app starts empty every time; session restore, recent files and permission re-grant are off there. _V1 web used `localStorage` (`cm.v1.*`) and IndexedDB (`cm-files`); they are switched off by configuration, not deleted._
- **R-8c:** Native apps store PDFs and configuration locally only. Store privacy declarations state "no data collected". Legal assessment is the owner's or a lawyer's.
- **R-8d:** No third-party libraries, fonts or CDN resources at runtime. New automated test fails on requests to external hosts (V1 only checks the index template).
- **#42 Legal protection:** closed-source license (proprietary terms, store-facing EULA text to be written). No source maps in production builds (V1: already so). **#48:** minified production builds (V1: already so). **#49:** automated dependency-license check, no GPL/AGPL (new, part of R-14c).

## 3. Files and top bar
- **R-1a:** No Save button. Autosave as in V1. In free/web autosave is off. _V1 triggers: 3 s idle (`T:saving.autosaveIdleMs`), tab switch, close, app hidden/paused; never during a stroke; retry on failure. Web writes in place only in Chromium; Safari/Firefox only "save a copy"._
- **R-1b:** Open is integrated with the file title. No Save button.
- **R-1c:** The file entry shows name, status marker, "x" (in that order). The marker also shows the V1 states error, read-only lock and needs-re-open (assumed: same position as the modified marker).
- **R-1d:** The modified marker shows unsaved changes. In free/web it is the only indicator.
- **R-1e:** A click on the current file entry opens the list of all open files (replaces V1 tabs; the compact V1 behavior everywhere).
- **R-1f:** Previous/next file buttons left and right of the entry, no labels, disabled at the ends.
- **R-1g:** A "+" button right of them opens a new file (replaces the V1 Open button). A long press on "+" opens the recent-files list (kept from V1, D-20). In free/web, recent files are switched off (R-22d).
- **R-1h:** The entry uses almost the full top-bar width; the drop-down list also full width. Ellipsis only as fallback.
- **R-1i:** No reordering in V2. Order is opening order.
- **R-1j:** Opening through the file picker as in V1. New: accept PDFs from the system share sheet / "Open with" on Android (add a `SEND` filter, V1 has only `VIEW`) and iOS (not web).
- **R-1k/l/m/n:** No file-count limit, no eviction logic. Inactive files release their rendered data when switched away (change from V1, which keeps bitmaps in the LRU cache). Referenced files look like other files. Stress test with many real PDFs on an emulated low-memory device.
- **R-54a/d:** Overwrite confirmation at the first autosave of a file per session, once per file per session. Autosave does not overwrite before the answer; changes stay in memory and the modified marker stays. This also applies to the save after detection finishes (SAV-012 stays): the dialog appears at that point (D-5).
- **R-54b:** The dialog offers "Overwrite", "Save as new file" (the new location becomes the file of that entry), "Cancel".
- **R-54c:** Option to disable the dialog for this file or for all files, persists across sessions.
- **R-54e/f:** iOS autosave/reopen must be verified (Files app, iCloud Drive, other providers). An unwritable file: warning once per file per session, offer "Save as new file", modified marker stays. Shared-in copies without write access are read-only. _All V1 iOS code is `UNVERIFIED(ios)`._
- **R-54h/i/j/k:** Per-file choices (R-54c) use one single identification mechanism everywhere, stored in local settings, cleared by Reset: **the file name** (D-1).
- **R-21a:** "Send to" produces one PDF with annotations flattened as standard PDF content and marks in the file metadata.
- **R-21b/c/e:** Sent through the system share sheet where available or saved as a local copy. Paid native only. Desktop browsers behave like free (visible, disabled, no download).
- **R-21d/f/g:** No printing. Exported annotations need not stay editable. The original PDF is never changed by export. Working file (editable data via autosave) and exported flattened copy are distinct.
- **File identity (D-1):** V1 rule kept: "same file" means same entry (`isSameEntry` on web, same URI on Android), else equal name, size and last-modified time. Cross-file marks reference the other file by **file name only**. Renaming a referenced file breaks the reference (accepted). No content fingerprint, no path.
- **R-30f/g/h:** Opening a file with cross-file marks tries to open the referenced files too. Where the app cannot (no persisted file access, e.g. web or never-opened files), a warning appears, metadata untouched, and the user opens the file manually. In slide mode an unresolved jump stops the presentation at that position. Cross-file marks exist in all editions; in free/web they are session-only (D-8).
- **R-30i:** Closing a referenced file keeps the marks and shows an immediate warning with "Don't show again" (persisted, cleared by Reset).
- **R-30j:** An already open file stays current; referenced files open in the background.
- **R-30k:** Opening a file that matches an open file by the identity rule above switches to the open one.
- **Closing files (D-6):** a paid file saves before closing (V1: on failure it stays open with the error icon). A modified file in free/web asks for confirmation on every close; confirming drops the changes. A read-only file without changes closes without asking.

## 4. Marks, jumps, bookmarks
_V1 stored marks on "junctions" (the gaps between consecutive systems: jump origin and target, slide break, stop). **V2 marks belong to systems (D-31):** every mark is stored on one system and one side of it. Left side (start of the system): start mark, jump target, bookmark. Right side (end of the system): jump start, stop, slide break. The playing-order logic (`core/`) is unchanged and derives V1's gap positions from the system sides (right side of system k = gap k, left side of system k = gap k−1). Storage change: new data (marks per system, start marks, bookmarks, user text, cross-file references) needs a new `schemaVersion` with a migration from the V1 junction form (origin gap k → right side of system k; target gap k → left side of system k+1; break and stop gap k → right side of system k); existing files must keep opening. A jump may start on the right side of the last system (D.C. at the end) and target the left side of the first system._
- **R-19b/f, R-28n:** Organization mode tools: detection, refine, delete, bookmarks, start, stop, jumps, **slide break** (D-11). No tool active by default. Pressing the active tool again deactivates it. Only one tool at a time. Choosing another tool cancels a half-defined mark.
- **R-28a-c/o:** Actions trigger on systems, not on bars. Active areas are the left and right ends of a system, width from tunables (start value 20 %, tuned in implementation). Right end: jump start, stop, slide break. Left end: jump target, start mark, bookmark. With the jump tool the right end sets the start, the left end the target. The wrong end does nothing.
- **R-28d:** Choosing the jump start prompts for the target and vice versa (target first is new).
- **Pass number (D-10):** kept as in V1: default = number of existing jumps from the same start + 1, a stepper after choosing the target, shown in the label as "×n" when above 1.
- **R-28e/f/l, labels (D-12):** every mark has an automatic label **`<filename>:<page>:<system on page>`**; for marks in the same file the filename is omitted (`page:system`). Jumps show `start -> target` with `×n` for pass numbers above 1. Every mark may carry an optional user text, shown after the automatic part. Labels are shown inside the colored marker in organization mode and in the marks list. _V1's playing-order labels ("4 → 5 ×2") are replaced._
- **R-30a/e:** Cross-file labels carry the filename; same-file labels do not.
- **R-28g/h/i:** The chosen system gets a highlight at the clicked end, candidates (both directions, all systems) at the opposite end, same width setting. Candidate opacity modes chosen by the user with abstract labels: linear (default), exponential, constant. N, H, floor in tunables.
- **R-28j:** A half-defined jump is cancelled by tapping elsewhere, Escape, tapping the chosen system again, Android back (and the V1 cancel icon).
- **R-28k:** No conflict checks, as V1: several jumps may start on the same system side (earliest created wins); slide break and stop toggle; at most one stop per system; stop and slide break not on the last system. **At most one start mark per file; the last one set wins.** Several bookmarks per system are allowed side by side (R-29).
- **R-28m:** Marks are hidden in annotation mode by default; optional global setting "Show marks while annotating". Never shown in slide mode.
- **R-28p/q:** Creating marks never scrolls the view on its own (except a user-triggered file switch for cross-file marks). Tests compare scroll position.
- **R-28r:** No label length limit. The marker grows or wraps, never overlaps or leaves the screen.
- **R-29a-f:** Bookmarks have their own color set in tunables, assigned cyclically as V1 jumps. Start marks fixed green, stop marks fixed red (tunables). Several marks on one system sit side by side.
- **#50/R-59a, #59:** The stop marker is larger and colored; the start marker is similar and labelable.
- **Start mark (D-13):** the playing order starts at the start mark; systems before it are not played. This changes PLY-002. No start mark = start at the left side of the first system (V1).
- **R-30b/c/d:** Cross-file bookmarks and jumps: targets only from open files, picked by switching to the other file. The pending state survives the file switch. Closing the source or the other file cancels it.
- **R-40a/b/c (D-14):** Marks list as in V1: **organization mode only, in playing order** (unreached items dimmed at the end). The button is grayed out when no marks exist (including cross-file marks referencing the file). A tap navigates and selects; deleting from the list as V1. No editing from the list, no filter.
- **Marks vs. system edits (D-24):** deleting a system (delete tool, redrawing a box) deletes the marks stored on that system (both sides). Marks on neighboring systems stay. A cross-file reference whose target system no longer exists counts as unresolved (R-30g warning, slide mode stops there); the source file is never modified by edits in the other file. A page rerun (R-18c) keeps the marks of that page only if its system count is unchanged; otherwise the marks of that page are deleted. Covered by undo (R-55a).

## 5. Detection and refinement
- **R-18a/b:** Auto-detection when loading a new file; embedded systems skip detection. A page-count mismatch discards the data and reruns detection (V1).
- **R-18c:** A short click on the detection tool offers: rerun all pages, current page, cancel. No extra confirmation for refinements (undo covers it). Rerun of a single page is new. Mark handling: D-24.
- **R-18e:** Detection continues while the app is not in focus on web (`pauseWhenHidden` = false; browsers may throttle). On Android and iOS it pauses in the background and resumes on return (as V1); recorded as a platform limit in `docs/limitations.md` (D-16).
- **R-18f:** No cancel of a running detection; a short click on the tool during a run is ignored.
- **R-18g:** Behavior during detection as V1: pages in order in a worker; a page navigated to is processed next; slides, bars and marks usable for the finished prefix; scrolling, zoom, mode switches and drawing possible; detection yields to input.
- **R-19a/c (D-15):** V1's three level buttons are removed. A long click on the detection tool opens a popup: minimum and maximum system width (units of page width), minimum and maximum system height (units of page height), resolution in DPI. Technical on purpose. Defaults come from the V1 internal values. **Maximum width and the height filters do not exist in V1 and are new engine work**; their defaults are determined with the real-PDF corpus (R-13). The V1 full-width threshold stays a tunable.
- **R-19d/i/j:** Global settings checkboxes: highlight systems (filled transparent area with soft fading edges), highlight vertical-space bars (V1), number systems. When the fill is on, numbers get a cut-out or contrasting color. "Number systems" draws the **system number on its page** (the same number as in the labels, D-12); V1 playing-order numbers are dropped.
- **R-19g:** Bars are no longer clickable; they are display only.
- **R-36a-d:** The refine tool is a rectangle tool, resizable via corners/edges. A long click opens a popup with one boolean: (a) save the rectangle as a new system box at the right position in the list, or (b) hint mode: the largest combined bounding box of detected boxes inside. **R-36h:** if hint mode finds nothing, the drawn rectangle is accepted without a message. The delete tool deletes any system with a click. Move/split via delete plus redraw. The engine must keep component boxes per page in memory or rerun the page. Marks: D-24.
- **R-36i:** Refinement only works on pages whose detection has finished.
- **R-55a:** Undo/redo covers all tools (including marks and refinements) in both modes, separate history per mode. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z work in annotation and organization mode. _V1: strokes only, annotation mode, depth 200._
- **R-10a-h:** The system number's weight depends on the aspect ratio of the system's own box (wide and flat bolder, mapping in tunables). Size as V1, reduced when it does not fit the width. A tiny safety floor in tunables.
- **R-37a/b/c:** Organization mode uses annotation mode's progress indicator: x/n page counter at the right end of the horizontal scroll bar, n = processed pages with trailing "+" during detection. V1's separate left counter is removed.

## 6. Annotation tools
- **R-20a:** Tools: pen, highlighter, eraser (V1) plus text, music stamps, mover.
- **Pen and finger (D-17, #56):** the hand-drawing button and the finger-drawing toggle are removed. While a drawing tool is active, **pen and finger both always draw**; two fingers zoom and pan; palm rejection while the pen is near stays (V1 rule). With no tool active, one finger pans (when zoomed) or swipes between slides, and tap zones work. The V1 stylus flag `stylusSeen` is no longer used.
- **R-20i:** Pen, text and stamp share one color. Palette and color chooser exist only in the pen popup. The highlighter has its own color.
- **R-6a/b/c:** A long click on a tool opens palette plus stroke-width settings (V1). New: a long click on a palette color opens a color chooser. Defaults and long-click duration in tunables.
- **R-7a-g:** Thickness is one value per tool with thinner/thicker buttons (replace the three presets). Step/min/max in tunables, buttons disabled at the limits, memory per tool. A preview next to the buttons. Pointer cursor: a circle at the actual stroke size in tool color with a contrasting ring, crosshair only for very thin strokes, a plain circle for thick ones, scales with zoom. Touch: a temporary preview after each change.
- **R-20b-c:** The stamp tool draws on each click; size via smaller/larger like thickness.
- **R-20p:** The stamp popup shows the n (default 8, tunables) most recently used stamps in a 3×3 grid; the ninth cell is three dots opening a scrollable submenu with all symbols. Free/web always starts with the tunables set. The tool button shows the selected symbol. The cursor shows a stamp preview. Stamp group names need no translation.
- **Symbol source (D-21):** a music font, **Bravura (SIL OFL)**, rendered as glyphs/SVG; a new dependency recorded in `docs/decisions.md` with its license. Flat list: dynamics, accidentals, fingering, strings/bowing, winds/breaths, articulation, rehearsal/navigation (letters, numbers, segno, coda, D.C., D.S., fine), warnings (glasses, check, arrows, circle, asterisk). The initial 8 are finalized in implementation.
- **R-20j:** Text tool with default size and smaller/larger. A writing cursor on click, which also serves as the preview.
- **R-20m/n:** Multiline text, confirmed by tapping elsewhere, editable by clicking it with the text tool active. Empty text creates nothing.
- **R-20g/h:** The mover tool moves any annotation in x/y, selects like the eraser. No resize after drawing.
- **Storage of text and stamps (impl):** V1 writes only `/Ink` annotations. Text and stamps need a form that other viewers display and the app can read back and edit (assumed: standard PDF annotations with appearance streams).
- **R-52a/b/c:** Only the highlighter becomes less transparent/darker; a fixed value in tunables, tested on real PDFs (V1: 0.35 multiply).
- **R-53a/b:** After changing tool, color, thickness or closing a popup, drawing works immediately. A tap that closes a popup never draws. Drawing only on the drawable PDF area.
- **R-61 (D-27):** Annotations (ink, text, stamps) made in annotation mode are also displayed in organization mode, read-only (V1 does not show them there). No drawing in organization mode; unplayed systems and pages without systems stay unannotatable (LIM-016 remains an accepted limit, BKL-023 dropped). Assumed: always shown, no setting.

## 7. Slide construction, zoom, rendering
- **R-4b/c (D-18):** Annotation mode bottom bar (right side): aspect ratio increase/decrease with V1 steps (0.5–2.0, next multiple of 0.1). The start value is the device full-screen ratio in the current orientation. The PDF area is the largest area for that ratio; the remaining strips are dark gray (tunables). On change, a highlighted rectangle and the value are shown briefly. **The V1 per-PDF override per orientation (SLD-015) is kept.**
- **R-60a-e:** Page-break control: off (V1 packing), auto (V1 packing plus a slide break after each page, optimal distribution), 1 to 4 slides per page (systems split by equal total height, whole systems only). For 1 to 4 the aspect-ratio setting is ignored, the full device screen is used, the aspect buttons are disabled. Fixed breaks (slide breaks) and break hints are ignored in 1 to 4. **This page-break mode is one user setting for the whole app** (not per PDF).
- **R-23a-f:** Left and right free areas are filled with the real PDF content beside the systems, undimmed. Vertical dimming (above and below) unchanged. Applies in annotation and slide mode and in 1 to 4 modes. Gray only where the page has no content. Slide mode is full screen without controls. **#24 padding reduction: dropped.**
- **R-39b/c, R-26a:** Organization mode bottom bar keeps page indicator and navigation, with standard PDF-viewer zoom (in/out, fit page, fit width, 100 %, other percentages), restored on reload (native paid only, R-22d).
- **R-26b/c/d:** Annotation mode zoom by gestures with the zoom center following the gesture (apply the midpoint movement as pan during the pinch; fix content shifting at low zoom). Slide mode: no zoom. Other zoom controls as V1.
- **R-27a/b:** Correct tile reloading and placement after zoom, performant. A bug hunt, not new design.
- **R-58a-e (#51 merged):** Pages/tiles are never left blank. Visible-first render priority, cancellation, a bounded queue, a watchdog re-requesting empty visible areas. First candidate: the `tileRetryMax` give-up in organization tiles. Stress tests with seeded random rapid jumps/scrolls, zoom sequences, rendering during detection; performance budgets in tunables.
- **R-17a-d:** Dead time in slide mode, one value for all triggers, a global setting shown in seconds (default 0.5 s, min/max/step in tunables). Ignored triggers are dropped, not queued. No dead time outside slide mode. V1's auto-repeat and wheel locks stay.
- **R-38a/b (D-19):** Remove only a browser-level right-hand page scroll bar on desktop; PDF-area scroll bars stay. V1's code has none (`overflow: hidden`); treated as a **bug to reproduce** (browser/mode noted by the owner) before any change.
- **R-57a/b (#57):** Automatic full screen when entering slide mode on desktop browsers stays unchanged. No new tests.

## 8. Settings, languages, branding, distribution
- **R-12a/b:** Settings is its own mode, the rightmost top-bar button (three lines). Grouped (e.g. General, Display, Slide mode, Files). Pedal key remapping not in V2.
- **R-47b/g/i:** Languages: English, German (mandatory), Spanish, French, Italian, Portuguese (Brazil), Dutch. Follow the system, changeable in settings, fallback English. The owner provides translations, German reviewed by the owner; a native-speaker check is planned before release (D-3). Automated test: every key exists in all languages, no cut-off text.
- **R-46a-d:** Tooltips on all devices, triggered as in V1 (hover 600 ms, touch long press 500 ms). Always inside the screen (edge clamp is new), multiline allowed (max width in tunables). Tested at all edges.
- **R-5a-d:** Icons are chosen during implementation. Icons live in one place (`T:icons` plus the generated sprite); replacements go through normal tests; each button keeps an accessible label.
- **R-2a/b:** One image for app icon and favicon. A source of at least 1024 × 1024 (redrawn or vector) is needed; all sizes are generated from it. Build check for all sizes.
- **R-34a-d:** Store texts in all seven languages, store documentation (privacy policy, privacy/data-safety answers, support info, age rating, Apple review notes), screenshot suggestions. Branding discussed later. An early milestone for texts and documents.
- **R-35a:** A simple flyer as PDF and JPG at the end. No video.
- **R-16a-f:** Users see only vX.Y.Z; detailed build info only in internal places. Free and paid share the version. One single source. Store build numbers auto-increment from CI (commit count). A build check enforces consistency. Android `versionName` = X.Y.Z.
- **R-19m-t (first-run hints, BKL-019):** Tip bubbles only, each next to the control or area it explains, shown once at the moment the step becomes relevant: (1) open a file (a new file without stored systems opens in **organization mode**, D-25), (2) detection progress, (3) detected systems shown, (4) creating marks of different kinds, (5) change to annotation mode, (6) change the aspect ratio, (7) pen annotation, (8) change to slide mode. No hints for the detection tool or the refine tool. A global-settings checkbox (General) turns all hints off; "Reset all settings" turns them back on. Free/web: at most once per session. Bubbles never block input, disappear on tap or after a tunables timeout, stay inside the screen, never cover their control. All eight texts exist in all seven languages. Tests: appear at the trigger, once only, suppressed by the switch, shown again after reset.
- **Opening mode (D-25):** a newly opened file without embedded systems opens in organization mode; a file with systems opens in annotation mode (V1).

## 9. Testing, CI
- **R-11a/b (D-23):** Playwright device profiles for desktop Chrome/Firefox/Safari, small and large Android phone (a small-phone profile is new), Android tablet, iPhone, iPad. In addition an **Android emulator job** covering at least an Android tablet (smoke: open, detect, draw, save), run before releases. No iOS simulator tests and no device farms in V2. Long-running tests do not block the pipeline.
- **R-13a-g:** Real-PDF collection: a repository folder plus a URL list (downloaded and cached, checksum verified, failures skipped with a warning); either may be empty. The owner ensures copyright-free PDFs, a license note per PDF. An expectation file per PDF maps page to the number of detected systems; extend V1's `e2e/corpus/expected.json` (URL, checksum, license). A helper script generates it and never overwrites edited files without a flag. Used as detection regression and performance tests. Also used to tune the new detection parameters (R-19c).
- **R-15a/b:** Coverage is reported per kind of test (unit, integration, e2e/emulator, real-PDF detection, performance). No failing threshold at first.
- **R-44a:** Fast unit tests on every push. E2E tests before merges and releases (no longer on every push); the Android emulator job (R-11) before releases only. All workflows are manually triggerable (`workflow_dispatch`).

## 10. Ideas decided in the review
- **BKL-023** (drawing in organization mode, annotating unplayed systems): dropped. Replaced by R-61 (annotations visible in organization mode). LIM-016 stays.
- **#55** keyboard shortcuts beyond undo/redo, and their mapping/remapping: V3 (D-28).
- **BKL-008** metadata backup and library: V3, designed together with setlists BKL-003 (D-29).
- **BKL-013** split a system mid-line: V3; delete plus redraw (R-36) is enough for V2 (D-30).

## 11. Decisions of the review
| ID | Decision |
|---|---|
| D-1 | File identity as V1; cross-file references by file name only; per-file choices keyed by name (no fingerprint). |
| D-2 | Default values (stamp set, active-area width, highlight colors/fade, tooltip width, dead-time limits, highlighter opacity): in implementation. |
| D-3 | Native-speaker review plan for the six non-German languages: before release. |
| D-4 | Price, imprint, tax details: at release. |
| D-5 | Save after detection stays; the overwrite dialog appears then. |
| D-6 | Free/web: confirm on every close of a modified file. |
| D-7 | Persistence stays in the code; web/free switches it off; the test checks the default web build. |
| D-8 | Cross-file marks in all editions; session-only in free/web; manual opening where no file access exists. |
| D-9 | Service-worker cache allowed. |
| D-10 | Pass number kept. |
| D-11 | Slide break kept as a tool. |
| D-12 | Labels `file:page:system` (file omitted in the same file); "number systems" = system number on its page. |
| D-13 | Start mark begins the playing order. |
| D-14 | Marks list as V1 (organization mode, playing order). |
| D-15 | Detection popup with max width and min/max height (new engine work). |
| D-16 | Background detection: continues on web; pauses on Android/iOS (platform limit). |
| D-17 | Pen and finger always both draw; no finger toggle, no stylus flag. |
| D-18 | Per-PDF aspect-ratio override kept; the page-break mode is per app. |
| D-19 | Scroll bar: bug to reproduce. |
| D-20 | Recent files kept (long press on "+"), off in free/web. |
| D-21 | Bravura font for stamps. |
| D-22 | Only failure-case synthetic PDFs stay. |
| D-23 | Playwright profiles + small phone + Android emulator job (at least tablet). |
| D-24 | Deleting/redrawing a system deletes its marks; page rerun keeps marks only with an unchanged system count. Cross-file references to vanished systems stay and count as unresolved. |
| D-31 | Marks belong to systems (left side: start, jump target, bookmark; right side: jump start, stop, slide break), not to gaps; new schemaVersion with V1 migration. |
| D-32 | Free build: paid features are switched off and tested unreachable (no write call, no save UI), not excluded from the code. |
| D-25 | New files without systems open in organization mode. |
| D-26 | Auto-label + optional user text shown together (automatic part first). |
| D-27 | BKL-023 dropped; annotations from annotation mode are shown read-only in organization mode (R-61). |
| D-28 | #55 keyboard shortcuts: V3 (mapping decided there). |
| D-29 | BKL-008 backup/library: V3 with setlists. |
| D-30 | BKL-013 mid-line split: V3. |

## 12. Still open (small)
1. Whether the Android emulator smoke job also covers a phone, and its runtime budget.
2. The detection popup's default values for max width and min/max height (from the corpus).
3. Implementation values listed in D-2; verification of iOS file handling (R-54e).
4. D-1 consequence to accept consciously: two different files with the same name in different folders are one identity for per-file choices; renaming a referenced file breaks cross-file marks.
5. D-7 consequence: R-1c/R-22d "persist nothing" is a configuration, so tests must cover both configurations of every persistence feature.
6. R-38 (right-hand scroll bar): the owner still has to say browser and mode where it appears; implement only after it is reproduced.
7. Cross-file references (owner to confirm during implementation): a cross-file mark is stored in the file where it was created (the source file) and holds the target file name plus the target system (page and system number, or system ID). The app finds the other file by name among open files and files with persisted access (Android URI permission, iOS bookmark); if several match or none, it counts as unresolved.
8. D-17 consequence: with a drawing tool active, fingers cannot swipe or use tap zones to change slides (two fingers zoom/pan); slide changes use pedals, buttons, slider, wheel or keys (V1) or deselecting the tool.
9. R-13 downloads corpus PDFs from a URL list in tests only; this is not a runtime network request of the app (R-8d concerns the shipped app).

## 13. Parked (V3 / later)
- #31 content copy between files (scope R-31a to c recorded). #9 PDF from URL, Internet search, AI search. #41 native desktop apps.
- BKL-003 setlists, BKL-011 per-pass slide breaks, BKL-014 good-place-to-turn markers.
- BKL-002 stylus pressure, BKL-004 ML detection, BKL-005 deskew/noise, BKL-018 page rotation, BKL-024 password-protected PDFs, BKL-015 external file change detection.
- Dark mode, Japanese, Simplified Chinese. Crash reporting/analytics (BKL-020). Device farms (BKL-022). Pedal key remapping (BKL-009). File reordering. Web organizational features (imprint, manual, ads).
- #43 competitor research and BKL-021 PR preview deployments (parked after V2 by decision).
- #55 keyboard shortcuts and their mapping, BKL-008 metadata backup and library (with BKL-003), BKL-013 mid-line split.
- Dropped: BKL-023 (LIM-016 stays).
- Promoted to V2 (for `docs/limitations.md` when requirements are written): BKL-006 (R-36), BKL-007 (R-19c), BKL-010 (R-47), BKL-012 (R-55a), BKL-016 (R-21, export only), BKL-017 (R-20), BKL-019 (R-19m-t).
