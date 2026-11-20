# Roadmap — CodexMusicae V2

Input: `docs/v2-requirements.md` (final, decisions D-1…D-32). Milestone files live in `docs/milestones/V2-Mnn.md` (one per milestone, self-contained). Work one milestone per fresh session, as in V1 (`docs/roadmap.md`, "Working loop"). A milestone is done when all its acceptance criteria pass, the requirement statuses are updated, and the owner has reviewed and tagged the commit.

## Naming and tags

- Milestones of version 2 are named `V2-M<n>` and tagged **`v1.<n>.0`** (e.g. `V2-M5` → `v1.5.0`). Fixes between milestones: `v1.5.1`. The minor number is always the milestone number. M0 is documentation and owner work: no tag.
- **Release of v2:** tag the last milestone's commit (M19) additionally **`v2.0.0`** — annotated (`git tag -a v2.0.0 -m "v2"`), created last — and publish a GitHub release note. Example: `v1.19.0` and `v2.0.0` point to the same commit. Only the `v2.0.0` commit is built for the stores.
- **Collision rule.** The minor numbers `v1.1.0…v1.19.0` belong to V2 milestones. Until `v2.0.0` exists, fixes to the released V1 are **patch-only** (`v1.0.1`, `v1.0.2`, …). After `v2.0.0`: fixes `v2.0.1`, additions `v2.1.0`.
- Users see only `vX.Y.Z` (R-16). The version script (M1) turns `git describe` output of this scheme into that form; internal places may show the full describe string.
- `AGENTS.md` ("Naming and versions") still names `V1-M<n>` and `v0.<n>.0`. M0 (S3) is authorized to update `AGENTS.md` for V2 (limited changes listed there, the "Git" section untouched) and to run `npm run sync:agents` for the three copies. No other milestone edits `AGENTS.md`.
- Tags deploy nothing by themselves.

## Sizing rule

As V1: a **step** is one agent session — one layer or feature area, about 15 requirement IDs at most, ending with passing tests and a suggested commit message. Dense milestones (M6, M8, M10, M12) are split into steps `S1…Sn` inside their file; the owner commits after each step and tags after the last.

## Rules that hold in every V2 milestone

- R-14b: no significant change to V1 code or architecture unless the milestone says so and gives the reason. Clean, minimal code, no leftovers, existing libraries.
- Every new feature gets its on/off switch in the feature-configuration files (from M3 on, R-22e) and a test per configuration.
- Every new user-visible string is a translation key, added in `en` and `de` in the milestone that introduces it; the other five languages are completed in M16.
- Every new number, color, icon name or key binding goes into `src/config/tunables.ts` with a unit comment (R-12c).
- Where a milestone has to change V1 behavior, it names the existing tests it may edit. No other existing test is edited (`AGENTS.md`).
- Anything ambiguous goes to `docs/questions.md`; the agent stops.
- Requirement IDs: M0 converts the `R-xxx` identifiers of the V2 requirements into `TOPIC-nnn` entries in `docs/requirements.md` and records the map in `docs/changelog.md`. The tables below use the V2 identifiers (`R-xxx`, `D-n`); the milestone files say which `TOPIC-nnn` they cover once M0 is done.

## Milestones

| ID | Tag | Scope | Requirements | Model / effort |
|---|---|---|---|---|
| M0 | — | **Owner + strong agent:** V2 requirements into `requirements.md`, decisions, limitations, architecture, changelog, `AGENTS.md` update and sync of its copies, review report; **owner starts the long-lead tasks** (store accounts, business and tax preparation, supplying real PDFs) | all | strong, high |
| M1 | v1.1.0 | Pipeline and quality gates: manual workflows, e2e triggers, coverage report, unused-code, dependency and license checks, external-request test, small-phone profile, version `vX.Y.Z`, tunables comments | R-44a, R-15, R-14c, #49, R-8d, R-11a, R-16, R-12c | mid, medium |
| M2 | v1.2.0 | Real-PDF corpus: folder, URL list, checksums, expectation format and helper script, synthetic fixtures reduced to failure cases | R-13, R-14a, D-22 | mid, medium |
| M3 | v1.3.0 | Editions: feature-configuration files, free and paid builds, persistence behind switches, app IDs, four store variants, tests per configuration | R-22a…l, R-8a…c, D-7, D-9, D-32 | mid, medium |
| M4 | v1.4.0 | **Data model v2 (core, contracts first):** marks on systems, new `schemaVersion` and migration, start mark, pass number, labels, cross-file references, deletion rules | D-10…D-13, D-24, D-26, D-31, R-28k, R-30a, R-30e | **strong, high** |
| M5 | v1.5.0 | Settings mode, Reset all settings, language infrastructure, tooltips at the screen edge, icon registry | R-12a/b, R-6d, R-47 (infrastructure), R-46, R-5 | mid, medium |
| M6 | v1.6.0 | Top bar and files: file entry and list, "+" and recent files, overwrite dialog, close rules, share-in, memory release, cross-file opening (S1…S4) | R-1a…n, R-54a…k, R-30f…k, D-1, D-5, D-6, D-8, D-20 | mid, medium |
| M7 | v1.7.0 | Undo and redo for all tools, history per mode, keyboard | R-55a | mid, medium |
| M8 | v1.8.0 | Detection: parameter popup with new filters, page rerun, background policy, progress indicator, highlight settings, number weight | R-18a…g, R-19a/c/d/g/i/j, R-37, R-10, D-15, D-16 | mid, medium (plan: strong) |
| M9 | v1.9.0 | Refinement: rectangle tool, hint mode, delete tool | R-36a…i | mid, medium |
| M10 | v1.10.0 | Marks in organization mode (S1…S4): tools, active areas, jump flow, labels, colors, cross-file, marks list | R-19b/f, R-28a…r, R-29, R-30a…e, R-40, R-59a, #59, D-14 | mid, medium (plan: strong) |
| M11 | v1.11.0 | Annotation tools I: thickness, cursor, color chooser, pen and finger, highlighter opacity, drawing rules | R-6a…c, R-7, R-20i, R-52, R-53, D-17 | mid, medium |
| M12 | v1.12.0 | Annotation tools II: text, stamps, mover, PDF storage, annotations visible in organization mode | R-20, R-61, D-21, D-27 | mid, medium (plan: strong) |
| M13 | v1.13.0 | Slides and zoom: aspect ratio, page-break control, side fill, organization zoom, gestures, dead time | R-4b/c, R-60, R-23, R-39b/c, R-26, R-17, D-18 | mid, medium |
| M14 | v1.14.0 | Rendering robustness and scroll-bar bug | R-27, R-58, R-38, D-19 | mid → strong on failure |
| M15 | v1.15.0 | Send to: flattened export | R-21a…g | mid, medium |
| M16 | v1.16.0 | First-run hints and translations in all seven languages | R-19m…t, R-47b/g/i, D-3 | mid, low (translations: smallest tier) |
| M17 | v1.17.0 | Hardening: full E2E, corpus run, performance, Android emulator job, low-memory stress, configuration tests, iOS verification, traceability | R-11a/b, R-1n, R-54e, R-15 | mid, medium |
| M18 | v1.18.0 | **Placeholder:** improvements and changes found before publishing | open | mid, medium |
| M19 | v1.19.0 + v2.0.0 | **App-store publishing:** icon, store texts and documents, screenshots, flyer, price, listings, release | R-2, R-34, R-35, R-16, R-32a, R-22g/h/i, D-3, D-4 | mid, medium (texts: smallest tier) |

### Why this order

1. **M1–M3 first.** Every later feature then has quality gates, real PDFs to test with and a place for its feature switch.
2. **M4 before everything that creates marks.** Marks move from gaps to systems; storage, playing order and labels change, and existing files must keep opening. The riskiest logic milestone gets the strongest model and the contracts-first routine of V1-M4.
3. **M5 before features that add settings** (highlight modes, dead time, hints switch, finger/stylus options).
4. **M7 (undo) before M9 and M10**, which create undoable edits.
5. **M8 before M9:** refinement needs the detection engine's component boxes and the new parameters.
6. **M16 after the workflow is frozen:** the hint bubbles describe the finished flow; translations are done once.
7. **M18 sits right before M19 on purpose.** Owner testing of M1–M17 (real devices, real scores) will produce changes. They are collected in M18; M19 then publishes a frozen state.

### Not in V2 (decided in the review)

Keyboard shortcuts beyond undo/redo and their mapping (D-28, #55), metadata backup and library (D-29, BKL-008, together with setlists), mid-line split of a system (D-30, BKL-013), drawing on unplayed systems (BKL-023, dropped), competitor research (#43), PR preview deployments (BKL-021), and everything in section 13 of `docs/v2-requirements.md`.

### Open items carried into milestones

The "Still open" list of `docs/v2-requirements.md` (section 12) is assigned as follows: emulator-job scope → M17; detection popup defaults → M8; D-2 default values → the milestone that builds the feature (listed in its file); iOS file handling → M17; scroll bar → M14; cross-file reference storage and lookup → M4 and M6; finger/stylus consequence → M11; persistence-switch test coverage → M3 and M17.

## Working loop per milestone

1. Fresh session. Start in plan mode with only `AGENTS.md` and the milestone file.
2. Review the plan, approve.
3. The agent writes tests first (where logic exists), implements, runs lint and tests until green, updates requirement statuses, and proposes a commit message per step. The agent never commits, branches or pushes (`AGENTS.md`, "Git").
4. The agent stops. The owner reviews the diff, commits, pushes, tags (`v1.<n>.0`) and merges to `main`.
5. After any larger requirement change, rerun the M0 review on the changed files.

## Cost guidance

As V1 (`docs/roadmap.md`): a mid-tier model at medium effort by default; the strongest tier only for M0, M4, the plan steps of M8, M10 and M12, and any bug a mid-tier model failed twice; the smallest tier for translations, store texts and other chores; no visual polishing in logic sessions.

## Risks

- **Tag scheme.** `v1.<n>.0` collides with the old convention "small additions `v1.1.0`". The collision rule above handles it; do not tag V1 additions as minors until `v2.0.0`.
- **M4** (migration of existing files) and **M12** (text and stamps as standard PDF annotations that other viewers display) are the largest technical risks.
- **M8** (new detection filters) needs real scores from M2; without them the defaults cannot be tuned.
- **M17** (Android emulator job) may be slow or flaky on CI; it runs before releases only.
- **Long-lead owner tasks** (store accounts, tax and business registration, native-speaker review) can block M19; M0 starts them.
