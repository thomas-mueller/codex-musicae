# Architecture — CodexMusicae

Goal: robust, testable, extendable code that a small agent model can change safely. The rules here are enforced by lint and tests (ARC-001…ARC-006), not by good intentions.

## Principles

1. **Pure core.** All logic that decides something (system selection, junctions, playing order, slide packing, geometry, coordinate transforms, scheduling priorities, version parsing) is plain TypeScript in `core/`, takes all values as arguments, and is covered by fast unit tests.
2. **Thin adapters.** Everything that touches a platform or a library (pdf.js, pdf-lib, OpenCV.js, file access, fullscreen, wake lock, Capacitor) sits behind a **port** (interface + injection token). Features never call platform APIs.
3. **One-way data flow.** Ports and input produce events → stores hold state as signals → derived state is `computed()` over `core/` functions → components render.
4. **Commands, not event handlers.** Every user input becomes a semantic command in `input/`; components react to commands.
5. **Cheap defaults, explicit budgets.** Work is prioritized, cancellable and memory-bounded (see "Resource management").

## Folder structure

Follow what `ng new` generated for naming. Layers live under `src/app/`; the tunables file lives at `src/config/`.

```
src/
  config/tunables.ts            all numbers, colors, icon names, key bindings
  config/features.web.ts        V2: feature switches of the web build (free set); see "Version 2"
  config/features.native.ts     V2: feature switches of the native free build; the paid build forces them all on
  app/
    app.config.ts               composition root: wires ports to adapters (only place that imports adapters)
    core/                       pure TypeScript, one file per topic (subfolders only when a topic grows)
      model.ts                  DetectedPage, SystemInfo, Bar, Jump
      geometry.ts               Rect, page display space <-> PDF user space transforms, pixel cap
      system-selection.ts       choice of the systems among the connected components
      detection.ts              padding of the detected systems
      junctions.ts              system numbering, bars
      playing-order.ts          replay, stops, numbering, forced breaks
      edits.ts                  jumps, breaks and stops: add, update, remove, reconcile
      mark-positions.ts         where marks are met in the playing order (labels, list order)
      slides.ts                 packing
      aspect-ratio.ts           ratio steps, orientation
      fixtures/                 verified test data (see docs/contracts)
      (later)                   annotation, metadata, scheduling, version
      (V2, planned)             marks.ts, labels.ts, migrate-v1.ts (V2-M4), history.ts (V2-M7), boxes.ts (V2-M9), gestures.ts (V2-M13)
    ports/                      interfaces + InjectionTokens (+ Result and error types)
    adapters/
      web/                      browser implementations
      capacitor/                Android (and later iOS) implementations
      pdfjs/  pdflib/  opencv/  library adapters
      workers/                  worker entry points (detection, save)
    state/                      signal stores and services
    input/                      keymap, gesture recognizers, command bus
    features/                   standalone OnPush components per area
      shell/ files/ toolbar/ organization/ slides/ presentation/ annotation/
  assets/i18n/en.json           translation file
```

## Import rules (checked by lint)

| Layer | May import |
|---|---|
| `core/` | itself only (no Angular, DOM or third-party libraries; values come in as arguments) |
| `ports/` | `core/`, and `@angular/core` for `InjectionToken` and `Signal` types only |
| `adapters/` | `core/`, `ports/`, `config/`, libraries |
| `state/` | `core/`, `ports/`, `config/` |
| `input/` | `core/`, `state/`, `config/` |
| `features/` | `core/`, `state/`, `input/`, `ports/` (types), `config/` |
| `config/` | nothing |
| `app.config.ts`, `main.ts` | everything (composition root) |

**V2 change (DEC-130):** the feature-configuration files `config/features.*.ts` may be imported only by the composition root, which provides their content through the `FeatureFlags` token; every other layer reads the token. The rest of the matrix is unchanged.

Platform APIs (`navigator.wakeLock`, the Fullscreen API, `showOpenFilePicker`, `localStorage`, `IndexedDB`, Capacitor plugins) are banned by lint outside `adapters/` and the composition root.

## Port catalogue

Signatures are fixed in the milestone files (M4); this table fixes responsibilities.

| Port | Responsibility | Implementations | First used |
|---|---|---|---|
| `PdfRenderer` | open a document from bytes; page count; page geometry in display space; render a region or tile to an `ImageBitmap` with cancellation | pdf.js | M8 |
| `PdfWriter` | read embedded metadata and existing ink; produce new file bytes with ink annotations and metadata (runs in a worker); V2: text and stamp annotations with appearance streams (V2-M12), flattened export copy (V2-M15) | pdf-lib | M15 |
| `DetectionEngine` | binarize one page's bitmap (rendered at a level's scale) with the level's adaptive threshold and return its connected components (rectangle and pixel area); V2: a parameter set (width and height limits, dpi) replaces the levels, and the component boxes are returned for refinement (V2-M8) | OpenCV.js worker | M10 |
| `FileAccess` | pick files; read bytes; check writability; write in place; save a copy; persist and restore file references | web (File System Access / download), Android (SAF plugin) | M8, M15, M16 |
| `Preferences` | small JSON key-value store for UI state and file references | localStorage + IndexedDB, Capacitor Preferences | M8 |
| `AppLifecycle` | signals for hidden/visible, pause/resume, battery saver where detectable | web, Capacitor | M10, M15 |
| `Fullscreen` | enter/exit true fullscreen, report exits | Fullscreen API, Android immersive | M16 |
| `WakeLock` | acquire/release keep-awake | Screen Wake Lock, Android keep-awake | M16 |
| `OpenWith` | stream of incoming file references from the OS; V2: also Android `SEND` and the iOS share sheet (share-in, V2-M6) | Android intent, web file handler | M16 |
| `BackButton` | register back handlers with priority | Capacitor (Android) | M16 |
| `FeatureFlags` (V2) | read-only feature switches of the build (EDN-006…EDN-008) | provided by the composition root from `config/features.*.ts` | V2-M3 |
| `SystemLanguages` (V2) | the language tags the system prefers (I18-004) | web (`navigator.languages`, also in the native web view); empty by default | V2-M5 |
| `SendFile` (V2) | hand an exported PDF to the system share sheet or save it as a local copy (EXP-003) | Capacitor share (Android, iOS), local copy; no web adapter (the web build does not provide the token; features inject it as optional) | V2-M15 |

V2 adds no port for the persistence switch: the composition root wraps `Preferences` and the persisted file-reference part of `FileAccess` in switch-aware wrappers; each persistence switch (settings, recent files, session restore, per-file choices, zoom) decides what its wrapper drops (V2-M3).

iOS (M18) and older-platform fallbacks add implementations only.

## State

All stores use signals; components never mutate them directly.

- **`SessionStore`:** list of tabs, active tab, startup restore.
- **`DocumentStore` (one per tab):** document handle, page geometries, detection results per page and progress, jumps, breaks, stops, aspect-ratio override, ink annotations per page, undo/redo, save status, read-only flag, current position (system index and organization page). Derived with `computed()` from `core/`: junctions and bars, playing order, numbers, slides, slide count.
- **`UiStore`:** global mode (V2-M5: also the settings mode, with the way back to the mode before it), active tool, popups, selection (junction/jump), jump-target picking, presentation flag.
- **`PreferencesStore`:** persisted settings (tool colors and widths, ratio defaults per orientation, recent files, stylus flag) through the `Preferences` port.

**V2 changes:** `SessionStore` holds the open files in opening order behind one file entry (no tabs); `DocumentStore` holds marks on system sides (instead of jumps, breaks and stops on junctions), user-edited systems and the per-page component boxes; an `EditHistoryStore` keeps one undo history per document and mode (V2-M7); a `SettingsRegistry` declares every setting with its default, group, feature switch and reset handler, and `SettingsReset` adds the tool colors and widths to "Reset all settings"; a `LanguageStore` holds the language setting and the shown language (V2-M5); a `HintService` drives the first-run hints (V2-M16).

## Input layer

Raw events (keyboard, wheel, pointer) → recognizers (tap, swipe, pinch, pan, long press, double tap; thresholds from `tunables`) → **one resolver** that decides, from mode, tool, zoom and pointer type, whether a pointer draws or navigates (ARC-006) → semantic commands (`Next`, `Previous`, `First`, `Last`, `ToggleMode`, `Zoom`, `Pan`, `Back`, …) on a command bus. Features and stores subscribe to commands. The keymap is data in `tunables`.

## Rendering pipeline

- `PdfRenderer` yields `ImageBitmap`s for page regions and tiles. A **bitmap cache** (LRU, byte budget) holds them; evicted bitmaps are `.close()`d.
- A **slide plan** from `core/` lists the regions, their source pages, filler areas and overlay rectangles of a slide. The slide component draws the plan onto a canvas: bottom layer = page bitmaps and grey, then dimming overlays.
- Annotation layers: **committed strokes** are drawn into a cached layer redrawn only when strokes change; the **live stroke** has its own canvas and draws only new segments once per animation frame.
- Zoom is a view transform over the composed slide; after the gesture settles, visible tiles are re-rendered at the new scale (SLD-018).
- Coordinates: stored geometry is in page display space; `core/geometry` owns conversions to PDF user space (annotations) and screen space.

## Workers

- **Detection worker:** loads OpenCV.js lazily, processes one page at a time, frees all matrices in `finally`.
- **Save worker:** builds the complete PDF bytes with pdf-lib.
- pdf.js uses its own worker. Workers are called through Comlink; every call takes an `AbortSignal`.

## Resource management

- **Priorities** (NFR-003): input and drawing > visible render > neighbor prefetch > save > detection. A scheduler in `state/` (priority queue from `core/scheduling`) pauses or cancels lower classes when a higher one needs the CPU; detection also pauses while the user interacts, while hidden, and on battery saver.
- **Memory:** cache budget from `navigator.deviceMemory` buckets; canvas pixel cap; DPR cap 2; tiles ≤ tile size; bitmaps freed after use; only rectangles kept from detection; inactive tabs drop bitmaps.
- **Degradation ladder** (NFR-010), driven by a `ResourceGovernor`: normal → no prefetch → lower render resolution → free inactive tabs' bitmaps. Triggers: failed canvas or bitmap allocation, cache over budget after eviction, repeated slow frames.
- **Never fail outright:** a page that cannot be detected is marked and skipped; a save that fails keeps state and shows the error icon.

## Errors

Port methods return `Result<T, E>` with a closed set of error codes per port; adapters map library exceptions to codes. The UI maps codes to icons and tooltips (strings from the translation file). No exception crosses a port boundary.

## Testing strategy

- **Unit (Vitest):** all of `core/` first (M4 writes the tests from the spec tables, M5/M6 make them pass), then stores with fake ports.
- **Component tests:** shell, toolbar, files with fake ports.
- **E2E (Playwright, Chromium/Firefox/WebKit):** open a PDF, navigate, switch modes, draw, save a copy.
- **Golden detection corpus** and **PDF round trip** (M17); **performance budgets** against a large reference PDF (M17).
- **Corpus suites (V2-M3b, DEC-152):** every real PDF of `e2e/corpus/` belongs to the `detection` suite (systems per page against the owner's reviewed counts, run under the profiles of `profiles.json` on each engine of the entry, differences recorded as `deviations`), the `load` suite (Chromium: detection and navigation in parallel, `T:budgets`, cache and canvas invariants, fails the `perf` job) or both. A change of detection algorithm or settings is a new profile.
  - **Profiles:** `e2e/corpus/profiles.json` names the ways to run detection (today `v1-fast`, `v1-standard` (default), `v1-fine`); `runProfile` in `e2e/support/corpus.ts` is the only place that turns a profile into a call of the debug hook. An entry is asserted under the default profiles plus its own `profiles`; `expectedFor(entry, profile, engine)` (`scripts/lib/corpus-files.mjs`) picks the matching `deviation` or the reviewed counts.
  - **Load scenarios** (`e2e/perf/load.spec.ts`, Chromium, development build, per `load` entry): `open`, `parallel` (slide stepping, jumps, scrolling, zoom, one stroke while detection runs; the requested page is displayed after each action; `T:budgets`), `resources` (cache, canvas, heap, tasks per class, through `window.__cm`) and `throttled` (4x CPU, correctness and invariants only). Every measured value is a row of the `perf` job summary.
  - **Corpus workflow:** a normal PDF: list its URL in `e2e/corpus/urls.txt` or put it in `e2e/corpus/real/`, run `npm run corpus`, review the proposed counts and set `"reviewed": true` (suite `detection`, or `load` above 100 pages). A special load PDF: add `"load"` to `suites` (a file can be in both). A detection-challenge PDF with its own settings: add a profile to `profiles.json`, name it in the entry's `profiles`, record the numbers that differ as `deviations`. When M8 replaces the algorithm: change `runProfile` and `profiles.json`; the corpus entries stay.
- Tests carry requirement IDs in their names.

## Version 2

Overview of the structural changes of V2 (`docs/roadmap-v2.md`); the milestone files hold the details.

### Marks on systems (DEC-129, V2-M4)

- **Data model (`core/marks`):** a mark is `{ system, side, kind, userText? }` with `side` left (`start`, `jumpTarget`, `bookmark`) or right (`jumpStart`, `stop`, `slideBreak`). A jump pairs a `jumpStart` with a `jumpTarget` and has a pass number ≥ 1; its target may be a cross-file reference. Rules (one stop per system, none on the last system, one start mark per file) live in `core/` (MRK-001…MRK-008).
- **Junction derivation:** `core/` maps sides to the V1 junctions (right side of system k → junction k, left side of system k → junction k−1; the start mark gives the start junction) and runs the unchanged V1 replay (PLY-014…PLY-016). Slides, numbers and the marks list stay `computed()` over `core/`.
- **Labels (`core/labels`):** `<file>:<page>:<system on page>`, file omitted within the same file; jumps `start -> target ×n` (MRK-009…MRK-011).
- **Storage:** a new `schemaVersion` in the embedded JSON; `core/migrate-v1` converts the V1 junction form on read; saving writes the new schema only (SAV-015…SAV-017).
- **Deletion rules:** deleting a system deletes the marks on it; a page rerun keeps that page's marks only with an unchanged system count (MRK-013, MRK-014).

### Edition configuration (DEC-130, V2-M3)

- Two feature files in `src/config/`: `features.web.ts` (web, free set) and `features.native.ts` (native free set). Each holds one commented boolean per feature; separate from `tunables.ts`. Switches of web-only features exist in `features.web.ts` only.
- Build configurations `web`, `native-free` and `native-paid` select the file through `fileReplacements` (`native-free` and `native-paid` the same one); `native-paid` also sets the build constant `edition`, and the composition root then provides all switches as `true`. Each build bundles only its own file.
- The composition root provides the content through the `FeatureFlags` token in `ports/`; features and stores read the token, never the files (import rule above). A check fails the build when a shared switch is missing in either file or a web-only switch appears in the native file (EDN-013); an ESLint rule keeps the files out of every module but the composition root (V2-M3 S1).
- Persistence is switched by the wrappers described under the port catalogue; no feature branches on the edition.

### Cross-file references (DEC-128, V2-M4, V2-M6)

- A reference is `{ fileName, page, systemOnPage }` and is stored only in the embedded metadata of the file where the mark was created (MRK-012).
- Resolution runs in `state/`: the file is looked up by name among the open files and the files with persisted access through `FileAccess`; none or several matches leave the reference unresolved (FIL-042, FIL-043). An unresolved reference stays stored, and slide mode stops at it (MRK-016).

## Angular guideline conformance

Standalone components, signals, OnPush, zoneless, `inject()` and injection tokens, strict TypeScript, `angular-eslint`, CLI-generated naming. Deliberate additions: top-level layer folders (to keep `core/` framework-free); within `features/` the structure is by feature, as the style guide recommends.

## Extension points

| Future change | Where it lands |
|---|---|
| ML detection | new `DetectionEngine` adapter |
| Cross-PDF setlists (BKL-003, V3) | new `core/` model + new store; builds on cross-file references |
| iOS | new adapters (M18) |
| Older platforms | one more adapter per port, no feature changes |
| New language | one translation file |
| New metadata fields | new `schemaVersion` + migration in `core/metadata` |
| Key remapping and further shortcuts (BKL-009, BKL-025, V3) | the keymap is already data; add a UI and a persisted override |
