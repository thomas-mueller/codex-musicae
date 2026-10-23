# Roadmap — CodexMusicae V1

Milestone files live in `docs/milestones/V1-Mnn.md` (one per milestone, self-contained). Work one milestone per fresh session. A milestone is done when all its acceptance criteria pass, the requirement statuses are updated, and the owner has reviewed and tagged the commit.

## Naming and tags

- Milestones of version 1 are named `V1-M<n>` and tagged **`v0.<n>.0`** (e.g. `V1-M5` → `v0.5.0`; the baseline M0 → `v0.0.0`). Fixes between milestones: `v0.5.1`. The minor number is always the milestone number; unplanned work becomes a new milestone with the next free number.
- **Release of v1:** when the last milestone you include in v1 is finished (M17 at the earliest; M18 and M19 are optional), tag the **same commit** additionally **`v1.0.0`** — an annotated tag (`git tag -a v1.0.0 -m "v1"`), created last, so `git describe --tags` shows it for that commit — and publish a GitHub release note. Example: `v0.17.0` and `v1.0.0` point to the same commit.
- After the release: fixes `v1.0.1`, small additions `v1.1.0`, and so on. For the next major version V2 the recommended pattern is semver pre-release tags `v2.0.0-m.<n>` for its milestones and `v2.0.0` for the release (decided when V2 is planned; the `v1.<n>.0` range would collide with maintenance releases of v1).
- M0c is a review, not a build: no tag. Tags deploy nothing by themselves.
- Versions below 1.0.0 are pre-release milestones: they show progress, not stability.

## Sizing rule

A **step** is one agent session: one layer or feature area, about 15 requirement IDs at most, ending with passing tests and a commit. Dense milestones (M7, M10, M13, M15, M16) are split into steps `S1…Sn` inside their file; commit after each step; the owner tags after the last.

## Milestones

| ID | Tag | Scope | Requirement IDs | Model / effort |
|---|---|---|---|---|
| M0 | v0.0.0 | **Owner:** `ng new` baseline (zoneless, strict, no SSR), GitHub repo, Firebase project (Hosting; App Distribution enabled), deploy pipeline, secrets | GEN-004, PIP-008 | owner |
| M0c | — | Optional read-only review of all documents; writes `docs/review-report.md` only | all | strong, high |
| M1 | v0.1.0 | Adapt baseline: layers, lint boundaries, `tunables.ts`, i18n, Vitest + Playwright (3 engines), pipeline split, bundle budget | GEN-001, GEN-006, I18-001, I18-002, PLT-001, PLT-003, NFR-014, ARC-001…004, PIP-001, PIP-002, PIP-007, TST-004, TST-005 | mid, medium |
| M2 | v0.2.0 | Versioning from tags + PWA/offline/update policy | PIP-005, PIP-009, PLT-009 | small, low |
| M3 | v0.3.0 | Capacitor, Android shell, signed build to App Distribution | GEN-002, PLT-002, PIP-003, PIP-006 | mid, medium |
| M4 | v0.4.0 | Contracts and tests: copy the verified contracts and fixtures (`docs/contracts`) into `src/`, write the unit tests (red), independent re-derivation of the hardest cases | ARC-005, TST-001 | **strong, high** |
| M5 | v0.5.0 | `core/`: geometry, transforms, junctions, detection filter, padding, ratio steps | DET-005…011, DET-024, PLY-001, SLD-013 | mid, low (make tests pass; do not edit tests) |
| M6 | v0.6.0 | `core/`: playing order, stop, breaks, numbering, slide packing | PLY-002…013, SLD-001…006 | mid, low (plan step: strong) |
| M7 | v0.7.0 | Shell: responsive layout, icons, mode switch, empty state, tooltips, popups (S1 frame, S2 controls) | GEN-007…010, FIL-007, UIX-001…008, UIX-010…017 | mid, medium |
| M8 | v0.8.0 | File open, tabs, preferences store, pdf.js renderer, bitmap cache, scheduler | FIL-001…005, FIL-008, FIL-009, FIL-015, GEN-005, NFR-003…006, NFR-008…010 | mid, medium |
| M9 | v0.9.0 | Organization mode as a normal PDF viewer, tiled zoom | ORG-001…007, NFR-007 | mid, medium |
| M10 | v0.10.0 | Detection: S1 OpenCV extraction, S2 worker plumbing, S3 scheduling and resource management, S4 bars | DET-001…004, DET-012, DET-013, DET-016…022, ORG-008…010, NFR-011, NFR-012 | mid, medium (plan: strong) |
| M11 | v0.11.0 | Jumps, breaks, stops, bar content, jump list, levels UI, re-run | ORG-011…024, DET-014, DET-015 | mid, medium |
| M12 | v0.12.0 | Slide rendering in annotation mode (composition, filler, dimming, ratio, zoom render, indicator) | SLD-007…012, SLD-014…018, NAV-020 | mid, medium |
| M13 | v0.13.0 | Input layer (S1 keys + presentation mode + progress, S2 taps + swipes, S3 wheel + pinch + double tap) | NAV-001…019, UIX-009, UIX-018…020, ARC-006 | mid, medium |
| M14 | v0.14.0 | Drawing tools, undo/redo, eraser, stroke ownership | ANN-001…004, ANN-006…013, SAV-007 | mid, medium |
| M15 | v0.15.0 | Saving: S1 schema + migrations, S2 ink writer, S3 safe write + triggers, S4 save a copy | SAV-001…006, SAV-008…014, ANN-005, FIL-006, FIL-010, FIL-016, FIL-017, DET-023, NFR-013, PLT-010 | mid, medium (plan: strong) |
| M16 | v0.16.0 | Platform: S1 web fullscreen + wake lock, S2 Android immersive + back, S3 SAF + open with, S4 tab restore | FIL-011…014, FIL-018, FIL-019, PLT-004…008, NFR-015 | mid → strong on failure |
| M17 | v0.17.0 | Hardening: E2E, golden corpus, round trip, performance budgets, checklists | PLT-011, NFR-001, NFR-002, NFR-016, TST-002, TST-003, TST-006…008 | mid, medium |
| M18 | v0.18.0 | **v1-optional** iOS shell and CI compile check (unverified) | GEN-003, PLT-012…014, PIP-004 | mid, medium |
| M19 | v0.19.0 | **v1-optional** stylus support | STY-001…004 | mid, medium |

v1 ends at the last milestone you decide to include (M17 at minimum). M18 and M19 are dropped first if time or budget runs short.

## Working loop per milestone

1. Fresh session. Start in plan mode with only `CLAUDE.md` and the milestone file.
2. Review the plan, approve.
3. The agent writes tests first (where logic exists), implements, runs lint and tests until green, updates requirement statuses, commits per step.
4. The agent stops. The owner reviews the diff, tags (`v0.<n>.0`) and merges to `main`.
5. After any larger requirement change, rerun M0c on the changed files.

## Cost guidance (~20 € monthly plan)

- Default: a mid-tier model at medium effort. Strongest tier only for: M0c, M4, the plan step of M6, M10, M15, and any bug a mid-tier model failed twice.
- Smallest tier for chores: renaming, translation files, doc updates, config tweaks.
- Let the agent run lint and tests itself; do not relay errors by hand.
- No visual polishing in logic sessions; do it in a separate cheap pass.
- Plan limits change; check your plan's current terms. Fallback: an API key with a spending cap.
