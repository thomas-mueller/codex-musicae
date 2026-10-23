# Decisions — CodexMusicae

Settled decisions. Do not reopen them in an agent session; if one blocks you, write the problem to `docs/questions.md` and stop. Rationale is short on purpose.

## Product and scope

- **DEC-001** Purpose: a PDF viewer for instrumentalists. Core feature: stepping through the score by music systems ("slides"), with playing-order jumps and repeats, plus handwritten notes saved back into the PDF.
- **DEC-002** Whole systems only. Marks in the middle of a system cannot be represented. Reason: simple model, matches nearly all scores.
- **DEC-003** Three modes: organization (original PDF with bars, jumps, breaks, stops), annotation (slides, drawing, zoom), presentation (full screen, slide only, no drawing).
- **DEC-004** v1 has no cross-PDF setlists, ML detection, deskew, manual box editing, global settings screen, dark mode, extra languages. See `limitations.md`.
- **DEC-005** The repository is private; only built apps are distributed.

## Stack

- **DEC-010** Angular (standalone, signals, zoneless, strict) as the single code base for browser, Android and iOS. Capacitor wraps it for native. Flutter, React Native and fully native were rejected (PDF ecosystem, web parity, three code bases).
- **DEC-011** Libraries: pdf.js (rendering), pdf-lib (writing; low-level for ink appearance streams), OpenCV.js (detection, in a worker, self-hosted), Comlink (worker RPC), Playwright, Vitest (no schema library: see DEC-067). New dependencies need a line here.
- **DEC-012** Hosting: Firebase Hosting for the web app; Firebase App Distribution for Android test builds. Firebase App Hosting is not used.
- **DEC-013** Icons: Material Symbols Outlined, self-hosted, names in `tunables.ts`.

## Architecture

- **DEC-020** Layers `core/` (pure TypeScript), `ports/` (interfaces + injection tokens), `adapters/`, `state/` (signal stores), `input/`, `features/`, plus `config/tunables.ts`, with the import matrix in `architecture.md`; adapters are wired only in the composition root. Enforced by lint.
- **DEC-021** Derived state (playing order, slides, numbers) is `computed()` over `core/` functions; nothing is synchronized by hand.
- **DEC-022** The input layer turns every input into semantic commands; keymap in tunables; components see commands only.
- **DEC-023** Jumps, breaks and stops are the source of truth; numbers and slides are derived.
- **DEC-024** Heavy work (detection, saving) runs in workers with cancellation; per-point drawing stays outside Angular reactivity.
- **DEC-025** Platform differences live in port implementations. iOS and older platforms are added as adapters, not as branches in features.

## Data and saving

- **DEC-030** The PDF is the only home of document data: ink annotations (standard `/Ink`) plus one embedded JSON attachment with versioned, validated, migratable schema. No app-owned storage of PDF-derived data; detection results are cached in runtime memory only.
- **DEC-031** The preferences store holds UI state and file references only (last tabs and positions, ratio defaults, tool settings, stylus flag).
- **DEC-032** Geometry is stored in page display space (pdf.js scale-1 viewport); the transform to PDF user space is inverted for annotations. No page-rotation feature in v1.
- **DEC-033** Missing embedded data means re-detection; manual jumps and breaks are lost in that case (accepted).
- **DEC-034** Autosave after 3 s idle, on tab switch/close, and when the app is hidden. Saving never blocks drawing.

## Algorithms

- **DEC-040** Detection filter (owner's algorithm): bitmap → Otsu → connected-component rectangles including the background component (always the largest = the page). Drop the largest; keep rectangles above the middle of the largest area gap; discard those narrower than `minSystemWidthRatio`; add those at least `fullWidthSystemRatio` wide. Only the three levels are exposed.
- **DEC-041** Padding = median vertical gap between systems per page, with document-wide fallback.
- **DEC-042** Playing order is replayed from jumps; every jump fires at most once. Stops cut at the last arrival. Breaks apply on every pass.
- **DEC-043** Slides: width fixed in PDF units (widest padded system), height from the aspect ratio, greedy packing, adjacent same-page systems merged, filler from real PDF content, dimmed where it shows systems of other slides. A single system taller than the slide shrinks that slide only.
- **DEC-044** Aspect ratio: float 0.5–2.0, buttons move to round multiples of 0.1; global default per orientation, per-PDF override per orientation.

## UX

- **DEC-050** Layout: two size classes (compact/expanded), bars 48 px, always visible in annotation and organization mode.
- **DEC-051** Navigation: pedals as keys, three tap zones (30/40/30), swipes, wheel, buttons, slider. Zoom is separate from the aspect ratio and resets on slide change in annotation mode.
- **DEC-052** Drawing only in annotation mode. Base rule: one pointer draws with a tool active, two zoom or pan. Stylus special handling is M19.
- **DEC-053** Presentation mode: full screen, wake lock, thin green progress line, exit by center tap, Esc, or Android back.

## Process

- **DEC-060** Milestones of version 1 are `V1-M<n>`, tagged `v0.<n>.0` (pre-release); the release of v1 adds the annotated tag `v1.0.0` on the last included milestone's commit. Steps live inside dense milestones. V2 milestones: recommended `v2.0.0-m.<n>` pre-release tags, release `v2.0.0`. See `roadmap.md`.
- **DEC-061** Tests before implementation for `core/`; M4 (strong model) writes the tests from spec tables; M5/M6 must not edit them.
- **DEC-062** Local development on the owner's Ubuntu PC; agent works on a branch, owner reviews and merges.
- **DEC-063** Safari is a core v1 browser (min 16.4), verified via Playwright WebKit and asynchronous testers. Native iOS (M18) is optional and unverifiable without a Mac.
- **DEC-064** v2 workflow: edit requirements (new IDs, `changed`, `dropped`), log in `changelog.md`, run M0c on changed files, write a delta plan, then contracts/tests first, then implementation.
- **DEC-065** Contracts (`docs/contracts`) are real, compile-checked TypeScript stubs; fixtures were generated from an independent reference implementation (`docs/reference/core-reference.mjs`) and verified against it. M4 copies them and writes the tests; M5/M6 implement. A found error in a fixture is fixed in `docs/contracts` and logged in `changelog.md`, never silently in `src/`.
- **DEC-067** The embedded-metadata validator is hand-written in `core/` (pure, fixture-tested). `zod` is not used (it would break the "no third-party imports in `core/`" rule); DEC-011 is amended accordingly.
- **DEC-068** Ink is drawn by the app from its own stroke model (PDF user space). Until M15 pdf.js still renders existing annotations; from M15 the renderer disables annotations (`annotationMode` disabled) and the app loads all existing `/Ink` annotations into the model, so every stroke can be erased and nothing is drawn twice. Other annotation types (text, highlight, stamps of other apps) are preserved in the file but not displayed (LIM-025).
- **DEC-069** Strokes saved by this app get `/NM = strokeId`; erasing a stroke removes the annotation by `nm:<id>` (own) or `obj:<n>` (foreign) reference.
- **DEC-070** The M0 baseline uses Angular 21.2.0, Vitest 4.0.8, Node 24.16.0 and npm with `package-lock.json`; it started without a linter. M1 uses flat ESLint with `angular-eslint` and `eslint-plugin-boundaries`, because the architecture rules require lint-enforced layer boundaries.
- **DEC-071** Runtime translations use `@jsverse/transloco` with an app-local HTTP loader. Static identity metadata is generated from `TUNABLES.identity.appName` into ignored Angular build output, so the source of truth remains `src/config/tunables.ts` without mutating tracked files during builds.
- **DEC-072** M1 browser E2E uses Playwright against the production Angular build served by the repository's Node standard-library static server; no development server or additional static-server dependency is used. The configured device projects use descriptors exposed by the installed Playwright version.
- **DEC-073** Safari/WebKit-only behavior must be introduced together with a Playwright WebKit test. Browserslist targets Safari and iOS Safari 16.4 or newer; Browserslist has no separate Edge Android dataset, so Edge's supported versions are represented by the shared Edge target.
- **DEC-074** Angular's M1 `initial` budget is set to `600kB`, matching `T:budgets.initialBundleKbGzip` as an Angular build-budget threshold. Angular measures this budget using the raw JavaScript/CSS `Initial Total` reported by the application builder, not gzip transfer size.
- **DEC-066** A jump may start at junction N (D.C. at the end of a piece): the replay checks jumps before ending at N. Found while verifying the fixtures.

## Assumptions to review

Calls made while compiling the documents that go beyond what was explicitly discussed. Confirm or change them (change the requirement and log it in `changelog.md`).

- **ASM-01** Tool buttons: tap toggles the tool; a long press or a small settings affordance opens the color/width popup (resolves an earlier inconsistency about tapping the active tool). ANN-002.
- **ASM-02** Zoom is relative to the fit scale: slides 100–400 %; organization mode default fit-width, minimum fit-page, maximum 4 × fit-width. ORG-003.
- **ASM-03** Detection uses connected components of the inverted Otsu bitmap; the background component supplies "the page" rectangle. DET-004.
- **ASM-04** After detection finishes on a writable file, a save is scheduled so detection is not repeated. SAV-012.
- **ASM-05** Jumping the queue to an unfinished page shows provisional, non-interactive bars. DET-021.
- **ASM-06** In organization mode, all next/previous keys (including ArrowUp/Down) change the page; no fine keyboard scrolling. NAV-005.
- **ASM-07** Constraints on stops, jumps and breaks: stop and break only at junctions 1..N-1; jump origin and target any junction 0..N with target ≠ origin (a jump from N makes D.C. at the end of a piece possible). PLY-007, PLY-009, PLY-013.
- **ASM-08** On the web, file handles are stored in IndexedDB; Chromium still needs one tap to re-grant permission after restart. FIL-015, FIL-013.
- **ASM-09** Detection levels: fast 0.6/0.8/1.0, standard 0.5/0.75/1.5, fine 0.4/0.7/2.5 (min width / full width / render scale). Tune with real scores.
- **ASM-10** Compact layout below 600 px width or 480 px height (so landscape phones are compact). UIX-003.
- **ASM-11** A ratio wider than the screen letterboxes the slide: music size is capped by fitting the system width, so only the height shrinks. See LIM-015.
- **ASM-12** Android in-place writing uses a truncating write; a crash mid-write can corrupt the file. LIM-011.
- **ASM-13** M2 also contains the PWA setup (service worker, offline, update policy), because it is small and belongs with build metadata.
- **ASM-14** Minimum Safari 16.4 (wake lock), stricter than iOS 16.0.
- **ASM-15** The grey is `#B0B4BA` with overlay opacity 0.7; "transparent" was read as the dimming overlay. Tune visually.
- **ASM-16** Progress line = index / (n − 1) so the first slide shows 0 %. UIX-020.
- **ASM-17** Ink is drawn by the app from its own stroke model; from M15 pdf.js annotations are disabled and other annotation types are preserved but not displayed (DEC-068, LIM-025).
- **ASM-18** Ink loaded from a file counts as highlighter (`multiply`) when its opacity is below 1 (heuristic).
- **ASM-19** Android in-place writing goes through a temp file and one native copy with a truncating write; a crash during that short window can still corrupt the file (LIM-011).
- **ASM-20** A jump may start at junction N (D.C. at the end of a piece) (DEC-066).
- **ASM-21** Jumps are named for the user as "page·bar" (for example 7·1), computed by `junctionLabel`.
- **ASM-22** The wheel unlocks again only when both the idle gap and the cooldown have passed (NAV-011), so trackpad inertia never turns a second slide.
- **ASM-23** The persisted position of a tab is the system index of the first entry on the current slide; after a restart the first occurrence is used, within a session the exact entry is kept.
- **ASM-24** "Save a copy" lives in the overflow menu and behind the tab's lock icon.
- **ASM-25** Detection results are embedded only when detection is complete; an incomplete run is repeated on the next open.
- **ASM-26** Web file handles live in IndexedDB inside `WebFileAccess`; the preferences store itself only holds JSON.
- **ASM-27** The performance tests run un-throttled on CI with the tolerance factor `T:budgets.ciToleranceFactor`; real tablets are checked manually.
- **ASM-28** The tester without a Mac verifies iOS only through Safari (web app); the native iOS shell is compile-checked only (M18).
