# CodexMusicae — standing instructions for the coding agent

A PDF viewer for instrumentalists: steps through scores by music system ("slides"), playing-order jumps, handwritten notes saved into the PDF. One Angular code base for browser (PWA), Android (Capacitor) and optionally iOS.

These instructions are tool-neutral. If your tool expects `AGENTS.md`, copy this file.

## Read in this order

1. This file.
2. The milestone file you were given (`docs/milestones/V1-Mnn.md`). It is self-contained.
3. Only the requirement IDs it lists: `grep -n "ID" docs/requirements.md`. Never read the whole file.
4. `docs/decisions.md` only if you need a reason. Do not reopen settled decisions.

## Stack

Angular (standalone, signals, zoneless, OnPush, strict TypeScript), Capacitor, pdf.js, pdf-lib, OpenCV.js in a worker (via Comlink), Vitest, Playwright. Follow the current official Angular style guide and `ng generate` naming. Dependencies: do not add any that the milestone does not name; record additions in `docs/decisions.md`.

## Architecture rules (lint-enforced)

- Layers `core/`, `ports/`, `adapters/`, `state/`, `input/`, `features/`, `config/` with the import matrix in `docs/architecture.md`. Adapters are imported only by the composition root (`app.config.ts`, `main.ts`).
- `core/` is pure TypeScript: no Angular, DOM or library imports; deterministic.
- Every platform or library capability sits behind a port interface in `ports/` with an injection token; implementations live in `adapters/`. Features never call platform APIs directly.
- Derived state is `computed()` over `core/` functions. No hand-synchronized state.
- Inputs become semantic commands in `input/`. Components react to commands only.
- Per-pointer-event work (drawing) stays outside Angular reactivity.
- Errors cross port boundaries as typed results; the UI shows icons, not sentences.

## Standing rules

- No hard-coded user-visible strings: use the translation layer. UI is icon-first.
- No magic numbers, colors, icon names or key bindings: they live in `src/config/tunables.ts`.
- Tests contain the requirement ID in their name (`it('PLY-008 …')`). Mark a requirement `done` only when its tests pass.
- Do not edit existing tests to make code pass unless the milestone says so; report a suspected wrong test instead.
- Code that exists only for Safari/WebKit needs a Playwright WebKit test. Unverifiable platform code (iOS) is marked `// UNVERIFIED(ios)`.
- Free every OpenCV object in `finally`. Release bitmaps and canvases after use. Respect the cache budget and canvas pixel cap.
- Metadata schema changes only through a new `schemaVersion` with a migration; existing files must keep opening.
- No network requests except the app's own assets. No analytics, no CDN at runtime.
- When something is ambiguous, contradictory or untestable: write it to `docs/questions.md` and stop. Do not guess.

## Commands

- Install: `npm ci`
- Dev server: `npm start`
- Lint: `npm run lint`
- Lint self-test: `npm run lint:selftest`
- Unit tests: `npm test -- --watch=false`
- E2E: `npx playwright test`
- Production build: `npm run build`

## Workflow

- One fresh session per milestone; plan first, wait for approval.
- Branch `m<n>-<slug>`; commit after each step; run lint and tests yourself and fix failures.
- Do not touch layers or files outside the milestone's scope; follow its "do not" list.
- Stop at the end of the milestone. The owner reviews, tags and merges.
- Never push to `main`, tag, or change GitHub secrets.

## Naming and versions

- Milestone `V1-M<n>` → tag `v0.<n>.0`; fixes `v0.<n>.<p>`; the release of v1 additionally tags the last milestone's commit `v1.0.0` (annotated). The owner tags; you never do. Tags deploy nothing by themselves. Details: `docs/roadmap.md`.
- Version string: `git describe --tags --always --long`.
- Requirement IDs `TOPIC-nnn`, never reused; `target` v1 | v1-optional | v2 | backlog; `status` todo | done | changed | dropped.

## Layout of the documents

`docs/requirements.md` (what), `docs/roadmap.md` (order and tags), `docs/milestones/` (per-milestone tasks, contracts, test tables), `docs/decisions.md` (why), `docs/limitations.md` (accepted limits and backlog), `docs/changelog.md` (changes after v1), `src/config/tunables.ts` (all numbers).
