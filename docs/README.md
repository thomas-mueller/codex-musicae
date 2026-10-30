# CodexMusicae — documentation index

A PDF score viewer for instrumentalists: slide-by-slide navigation by music system, playing-order jumps, handwritten notes saved into the PDF. One Angular code base for browsers (PWA), Android (Capacitor) and optionally iOS.

## Read first (agents)

1. `/AGENTS.md` — standing rules.
2. `docs/roadmap.md` — milestones, tags, model guidance.
3. The milestone file you were given in `docs/milestones/`.
4. Only the requirement IDs it lists (`grep -n "DET-005" docs/requirements.md`).

**Agents never commit or push.** The owner does that personally; see `/AGENTS.md`, section "Git: the owner commits and pushes".

## Files

| File | Purpose |
|---|---|
| `requirements.md` | atomic requirements: ID, target, status, milestone |
| `roadmap.md` | milestone index (M0–M19), tags `v0.<n>.0` and the release tag `v1.0.0`, cost guidance |
| `milestones/V1-Mnn.md` | self-contained task per milestone (steps, tests, do-not list, acceptance) |
| `architecture.md` | layers, import matrix, ports, state, rendering, resources |
| `contracts/` | compile-checked TypeScript stubs (`core/`, `ports/`) and verified test fixtures |
| `reference/` | plain-JavaScript reference implementations that produced the fixtures (informational) |
| `decisions.md` | why things are as they are; "Assumptions to review" (ASM-xx) |
| `limitations.md` | accepted limitations (LIM-xx) and the backlog for later versions (BKL-xx) |
| `baseline.md` | facts of the M0 baseline (historical snapshot at `v0.0.0`) |
| `android-ci.md` | Android build, signing and distribution pipeline (M3) |
| `changelog.md` | every change to requirements after the first review |
| `questions.md` | created by agents when a statement is ambiguous (stop and ask) |
| `/src/config/tunables.ts` | every number, color, icon name and key binding |

## How to start (owner)

1. Do **M0** (`milestones/V1-M00.md`): `ng new`, GitHub, Firebase, deploy pipeline, secrets, tag `v0.0.0`.
2. Optional **M0c** (`V1-M0c.md`): strongest model, read-only review of all documents → `docs/review-report.md`.
3. Then one fresh agent session per milestone in order: M1 … M17 (M18 iOS shell and M19 stylus are optional). Plan mode first; review the diff; commit and push it yourself (agents never do); tag `v0.<n>.0`; merge.
4. Use the strongest model for M0c and M4, a mid-tier model for the rest, escalating only after two failed attempts. See `roadmap.md`.
5. After M17 decide where v1 ends and tag that commit additionally `v1.0.0` (annotated): the v1 release.

## Change workflow (after the first release)

Edit requirements (new IDs, `changed`, `dropped`), log them in `changelog.md`, rerun M0c on the changed files, ask for a delta plan, then contracts/tests first, implementation second (DEC-064).
