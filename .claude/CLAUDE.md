# CodexMusicae — standing instructions for the coding agent

A PDF viewer for instrumentalists: steps through scores by music system ("slides"), playing-order jumps, handwritten notes saved into the PDF. One Angular code base for browser (PWA), Android (Capacitor) and optionally iOS.

These instructions are tool-neutral. If your tool expects `AGENTS.md`, copy this file.

`AGENTS.md` is the single source of truth. `CLAUDE.md`, `.claude/CLAUDE.md` and `.gemini/GEMINI.md` are generated copies: edit only `AGENTS.md`, then run `npm run sync:agents` (the owner commits all four). `npm run lint` fails when a copy differs.

## Read in this order

1. This file.
2. The milestone file you were given (`docs/milestones/V1-Mnn.md` or `docs/milestones/V2-Mnn.md`). It is self-contained.
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
- Tests contain the requirement ID in their name (`it('PLY-008 …')`). Mark a requirement `done` only when its tests pass. In a step before the last one of a milestone, "its tests pass" means that its unit tests pass and its E2E tests are written; the E2E run at the end of the milestone confirms it, and a failure there sets the requirement back to `todo` until it is fixed. A requirement that only E2E tests cover stays `todo` until that run.
- Do not edit existing tests to make code pass unless the milestone says so; report a suspected wrong test instead.
- Code that exists only for Safari/WebKit needs a Playwright WebKit test. Unverifiable platform code (iOS) is marked `// UNVERIFIED(ios)`.
- Free every OpenCV object in `finally`. Release bitmaps and canvases after use. Respect the cache budget and canvas pixel cap.
- Metadata schema changes only through a new `schemaVersion` with a migration; existing files must keep opening.
- No network requests except the app's own assets. No analytics, no CDN at runtime.
- Editions (EDN-017): free and paid differ **only** in saving changes into files and in keeping data between app starts. Every other feature is the same in both and gets **no** feature switch; add a switch only for saving or persisting (web-only switches excepted, EDN-009). If an older document or an existing switch says otherwise, tell the owner what you would remove before removing it.
- When something is ambiguous, contradictory or untestable: write it to `docs/questions.md` and stop. Do not guess.

## Commands

- Install: `npm ci`
- Dev server: `npm start`
- Lint: `npm run lint`
- Lint self-test: `npm run lint:selftest`
- Unit tests: `npm test -- --watch=false`
- E2E: `npx playwright test --project=chromium` (locally only at the end of a milestone, see "E2E tests")
- Production build: `npm run build`
- Capacitor sync: `npm run cap:sync`
- Android debug APK: `npm run android:debug`
- Sync the instruction copies: `npm run sync:agents`
- Android local setup: `source ./init.sh` (selects JDK 21 and configures the local Android SDK)

## Workflow

- One fresh session per milestone (V1 and V2); plan first, wait for approval.
- Work on the branch the owner has checked out; run lint, unit tests and the build yourself and fix failures (E2E: see "E2E tests"). The owner alone creates branches and chooses their names: never create, rename, switch or delete a branch.
- At the end of each step, stop editing and give the owner a summary of the changed files and a suggested commit message (with test counts where the milestone asks for them). The owner commits.
- Do not touch layers or files outside the milestone's scope; follow its "do not" list.
- Stop at the end of the milestone. The owner reviews, commits, pushes, tags and merges.
- Never change GitHub secrets.

## E2E tests: only at the end of a milestone

E2E runs take too long locally to run in every step (CPU-bound detection on real scans; the full suite on one engine takes about half an hour on the owner's machine).

- **Do not run Playwright in a step** that is not the last step of its milestone, not even single specs. A milestone without steps counts as one last step.
- In every step still **write and update the E2E specs** the milestone asks for, and keep them passing `npm run lint`. Do not report them as passing: say that they have not run.
- **After the last step** of the milestone, run the E2E suite locally **on the desktop `chromium` project only** and fix what it finds, for all steps of the milestone. This is where "E2E green" in the acceptance criteria is met locally.
- Do not run the Firefox, WebKit, phone or tablet projects locally, also where a milestone file names them: the GitHub `e2e` workflow runs them, and it runs only on a pull request to `main`, on a `v*` tag or when the owner starts it by hand (`docs/ci.md`). Their specs are still written as the milestone asks (WebKit tests for WebKit-only code included). Say in the summary that they have not run locally.
- Note in the step summary what is still to be confirmed by that run; keep known failures in the milestone file under "Open for the E2E run".
- Run E2E earlier only when the owner asks for it.
- A run that is cut off can leave `serve-static` processes behind, and a later local run then tests the old build: check for them first.
- This is about local runs only; the GitHub `e2e` workflow is unchanged.

## Git: the owner commits and pushes

The repository owner commits and pushes all code personally. The agent never does this: not when a milestone file says "commit", not "just once", not on any branch.

- Never run `git branch`, `git checkout -b`, `git switch -c`, `git worktree add` or any other command that creates, renames, switches or deletes a branch. If a milestone file names a branch, treat the name as a suggestion for the owner.
- Never run `git commit` (including `--amend`), `git push` (any remote, branch or tag), `git tag`, `git merge`, `git rebase`, `git reset`, `git cherry-pick`, `git stash`, or `git add` (a delete or move of a tracked file is the exception below). Never open, update or merge pull requests or create releases (see the GitHub bullet below).
- Read-only git is fine: `status`, `diff`, `log`, `show`, `describe`, `blame`.
- `git rm` and `git mv` are allowed, and only for keeping the repository clean: remove tracked files that are no longer used or needed, and move or rename tracked files instead of keeping a duplicate. Never leave duplicated or unused files behind; name every removal and move in the step summary. They only change the index for that path; the owner still commits.
- Never use the GitHub CLI (`gh`) or any GitHub API, not even read-only (PRs, issues, CI status, releases). The owner does all GitHub work. This replaces the narrower `gh pr …` ban.
- Wherever a document says "commit" in an instruction to you, read it as "leave the change in the working tree and propose a commit message". If any instruction conflicts with this section, this section wins.
- Never change git configuration or remotes.

## Naming and versions

- Milestone `V1-M<n>` → tag `v0.<n>.0`; fixes `v0.<n>.<p>`; the release of v1 additionally tags the last milestone's commit `v1.0.0` (annotated). The owner tags; you never do. Tags deploy nothing by themselves. Details: `docs/roadmap.md`.
- Milestone `V2-M<n>` → tag `v1.<n>.0`; fixes `v1.<n>.<p>`; the release of V2 additionally tags the last milestone's commit `v2.0.0` (annotated). Until `v2.0.0` exists, fixes to the released V1 are patch-only (`v1.0.<p>`); collision rule in `docs/roadmap-v2.md`. The owner tags; you never do. Tags deploy nothing by themselves.
- Version string: `git describe --tags --always --long`.
- The build runs `scripts/generate-version.mjs`; read the generated raw value through the `APP_VERSION` injection token (the generated file is ignored and must not be edited).
- Requirement IDs `TOPIC-nnn`, never reused; `target` v1 | v1-optional | v2 | backlog; `status` todo | done | changed | dropped.

## Layout of the documents

`docs/requirements.md` (what), `docs/roadmap.md` (order and tags), `docs/roadmap-v2.md` (V2 order and tags), `docs/milestones/` (per-milestone tasks, contracts, test tables: `V1-Mnn.md` are history, `V2-Mnn.md` are the V2 tasks), `docs/decisions.md` (why), `docs/limitations.md` (accepted limits and backlog), `docs/changelog.md` (changes after v1), `src/config/tunables.ts` (all numbers).
