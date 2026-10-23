# Architecture — CodexMusicae

Goal: robust, testable, extendable code that a small agent model can change safely. The rules here are enforced by lint and tests (ARC-001…ARC-006), not by good intentions.

## Principles

1. **Pure core.** All logic that decides something (detection filter, junctions, playing order, slide packing, geometry, coordinate transforms, scheduling priorities, version parsing) is plain TypeScript in `core/`, takes all values as arguments, and is covered by fast unit tests.
2. **Thin adapters.** Everything that touches a platform or a library (pdf.js, pdf-lib, OpenCV.js, file access, fullscreen, wake lock, Capacitor) sits behind a **port** (interface + injection token). Features never call platform APIs.
3. **One-way data flow.** Ports and input produce events → stores hold state as signals → derived state is `computed()` over `core/` functions → components render.
4. **Commands, not event handlers.** Every user input becomes a semantic command in `input/`; components react to commands.
5. **Cheap defaults, explicit budgets.** Work is prioritized, cancellable and memory-bounded (see "Resource management").

## Folder structure

Follow what `ng new` generated for naming. Layers live under `src/app/`; the tunables file lives at `src/config/`.

```
src/
  config/tunables.ts            all numbers, colors, icon names, key bindings
  app/
    app.config.ts               composition root: wires ports to adapters (only place that imports adapters)
    core/                       pure TypeScript, one file per topic (subfolders only when a topic grows)
      model.ts                  DetectedPage, SystemInfo, Bar, Jump
      geometry.ts               Rect, page display space <-> PDF user space transforms, pixel cap
      detection.ts              filter steps, padding
      junctions.ts              system numbering, bars
      playing-order.ts          replay, stops, numbering, forced breaks
      slides.ts                 packing
      aspect-ratio.ts           ratio steps, orientation
      fixtures/                 verified test data (see docs/contracts)
      (later)                   annotation, metadata, scheduling, version
    ports/                      interfaces + InjectionTokens (+ Result and error types)
    adapters/
      web/                      browser implementations
      capacitor/                Android (and later iOS) implementations
      pdfjs/  pdflib/  opencv/  library adapters
      workers/                  worker entry points (detection, save)
    state/                      signal stores and services
    input/                      keymap, gesture recognizers, command bus
    features/                   standalone OnPush components per area
      shell/ tabs/ toolbar/ organization/ slides/ presentation/ annotation/
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

Platform APIs (`navigator.wakeLock`, the Fullscreen API, `showOpenFilePicker`, `localStorage`, `IndexedDB`, Capacitor plugins) are banned by lint outside `adapters/` and the composition root.

## Port catalogue

Signatures are fixed in the milestone files (M4); this table fixes responsibilities.

| Port | Responsibility | Implementations | First used |
|---|---|---|---|
| `PdfRenderer` | open a document from bytes; page count; page geometry in display space; render a region or tile to an `ImageBitmap` with cancellation | pdf.js | M8 |
| `PdfWriter` | read embedded metadata and existing ink; produce new file bytes with ink annotations and metadata (runs in a worker) | pdf-lib | M15 |
| `DetectionEngine` | detect connected-component rectangles for one page at a level's render scale | OpenCV.js worker | M10 |
| `FileAccess` | pick files; read bytes; check writability; write in place; save a copy; persist and restore file references | web (File System Access / download), Android (SAF plugin) | M8, M15, M16 |
| `Preferences` | small JSON key-value store for UI state and file references | localStorage + IndexedDB, Capacitor Preferences | M8 |
| `AppLifecycle` | signals for hidden/visible, pause/resume, battery saver where detectable | web, Capacitor | M10, M15 |
| `Fullscreen` | enter/exit true fullscreen, report exits | Fullscreen API, Android immersive | M16 |
| `WakeLock` | acquire/release keep-awake | Screen Wake Lock, Android keep-awake | M16 |
| `OpenWith` | stream of incoming file references from the OS | Android intent, web file handler | M16 |
| `BackButton` | register back handlers with priority | Capacitor (Android) | M16 |

iOS (M18) and older-platform fallbacks add implementations only.

## State

All stores use signals; components never mutate them directly.

- **`SessionStore`:** list of tabs, active tab, startup restore.
- **`DocumentStore` (one per tab):** document handle, page geometries, detection results per page and progress, jumps, breaks, stops, aspect-ratio override, ink annotations per page, undo/redo, save status, read-only flag, current position (system index and organization page). Derived with `computed()` from `core/`: junctions and bars, playing order, numbers, slides, slide count.
- **`UiStore`:** global mode, active tool, popups, selection (junction/jump), jump-target picking, presentation flag.
- **`PreferencesStore`:** persisted settings (tool colors and widths, ratio defaults per orientation, recent files, stylus flag) through the `Preferences` port.

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
- **Component tests:** shell, toolbar, tabs with fake ports.
- **E2E (Playwright, Chromium/Firefox/WebKit):** open a PDF, navigate, switch modes, draw, save a copy.
- **Golden detection corpus** and **PDF round trip** (M17); **performance budgets** against a large reference PDF (M17).
- Tests carry requirement IDs in their names.

## Angular guideline conformance

Standalone components, signals, OnPush, zoneless, `inject()` and injection tokens, strict TypeScript, `angular-eslint`, CLI-generated naming. Deliberate additions: top-level layer folders (to keep `core/` framework-free); within `features/` the structure is by feature, as the style guide recommends.

## Extension points

| Future change | Where it lands |
|---|---|
| ML detection | new `DetectionEngine` adapter |
| Cross-PDF setlists | new `core/` model + new store |
| iOS | new adapters (M18) |
| Older platforms | one more adapter per port, no feature changes |
| New language | one translation file |
| New metadata fields | new `schemaVersion` + migration in `core/metadata` |
| Key remapping | the keymap is already data; add a UI and a persisted override |
