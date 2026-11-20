# Requirement changelog — CodexMusicae

Every change to a requirement, decision or tunable that affects behavior is logged here. Before v1 is released the log stays empty except for the owner's review changes; from `v1.0.0` on, every change is logged.

To implement changes, tell the agent: "Implement the requirement changes listed in `docs/changelog.md` since `<tag>`." The agent reads the git diff of `docs/` and this file, then follows the v2 workflow (DEC-064).

## Rules

- IDs are never reused. A removed requirement gets status `dropped`; a modified one gets status `changed` and keeps its ID; a new one gets a new ID.
- Each entry: date, ID(s), what changed, why, affected milestone/tests.
- Freeze: at `v1.0.0` the requirement files are tagged in git, so v1 can always be diffed against the current state.
- Compatibility: the embedded PDF metadata schema changes only through a new `schemaVersion` with a migration; v1 files must keep opening.

## Entries

| Date | ID(s) | Change | Reason | Affected |
|---|---|---|---|---|
| 2026-10-21 | PLY-002, PLY-007 | A jump may start at junction N; the replay checks jumps before ending at N | Found while verifying fixtures: D.C. at the end of a piece could never fire | M6, fixtures O05–O07, O19–O21 |
| 2026-10-21 | DET-005, DET-006 | Zero-size rectangles are ignored; equal areas give threshold 0; tie rules specified | Edge cases found while writing the contract | M5, fixtures D08, D14 |
| 2026-10-30 | PIP-001, PIP-002, PIP-003 | `lint-test` ignores tag pushes; `deploy-web` and `android` run after a successful `lint-test` on any branch, not only `main`; PIP-003 says APK instead of APK/AAB | Owner tests every branch and commit during implementation; tags would only redeploy an already deployed commit; M3 forbids an AAB | M1, M3, workflows |
| 2026-10-31 | ORG-016 | A new jump starts at (number of existing jumps from the same origin) + 1 instead of 1 | Owner review: repeats with several endings need the occurrence index to count up | M11, `jump-pass` specs, E2E |
| 2026-10-31 | ORG-011, ORG-012 | Playing-order numbers move from the bars to the music systems: label centered on the system, digits 80 % of its height, bar color and transparency; the bars keep only break line and stop | Owner review: numbering the real systems is easier to read than numbered bars | M11, `system-labels`, `bar-rows`, E2E |
| 2026-10-31 | ORG-018, ORG-019, ORG-020 | Jump badges on the bars become markers on the systems: start at the right of the source system (jump icon rotated 180°), end at the left of the system after the target (merge icon); labels are system numbers instead of page·bar; fallback to the bar at junctions 0 and N | Owner review: the old labels were not intuitive | M11, `jump-markers`, E2E |
| 2026-10-31 | ORG-021 | The jump list becomes the marks list: jumps, slide breaks and stops in playing order, unreached items last; icon key `jumpList` → `markList` | Owner review: breaks and stops belong in the overview, ordered as they are played | M11, `mark-list`, E2E |
| 2026-10-31 | PIP-001 | E2E: built once, one job per engine, serve-only web servers, two workers, two retries, longer timeouts, shared helpers | E2E runs failed with timeouts on the GitHub runners | workflow `lint-test`, `playwright.config.ts`, `e2e/support` |
| 2026-11-01 | PIP-001 | E2E moves out of `lint-test` into the separate, temporarily optional workflow `e2e` with nine parallel one-project jobs that build for themselves; no artifacts, no report uploads; `deploy-web` and `android` no longer depend on E2E | `upload-artifact` hit the free-account storage quota and failed `lint-test`, blocking deploy and APK builds | workflows `lint-test`, `e2e`, `playwright.config.ts`, DEC-100 |
| 2026-11-01 | ORG-012 | The system numbers are horizontally centered on the page and use a light font weight (`T:layout.systemLabelFontWeight`) | Owner review: too heavy and dominant; centered on the page | `system-labels` |
| 2026-11-01 | ORG-018, ORG-021 | Jump markers and list rows show "<previous> → <next> ×<pass>" with playing-order numbers; slide breaks "<previous> \| <next>", stops "<previous>"; system numbers in PDF order are no longer shown anywhere | Owner review: the PDF order is not intuitive, the numbers on the systems are | `mark-positions`, `jump-markers`, `mark-list` |
| 2026-11-01 | ORG-021 | In expanded layouts the marks list opens beside its button (strip side), not at the opposite edge, and never over the scroll bar | Owner review | `tool-area`, `popup-host` |
| 2026-11-02 | FIL-016 | `FileAccess` gains `requestWriteAccess(ref)`; a write that finds the permission in the `prompt` state without a user gesture answers `needs-user-gesture` instead of `denied`; the tab shows an "Allow saving" control (also triggered by selecting or closing the tab) instead of becoming read-only | Owner test in Chrome: files without a granted permission were never saved because an autosave cannot show the permission prompt | M15 S3, `WebFileAccess`, `SessionStore`, `tab-item` |
| 2026-11-04 | PIP-003, PIP-010 | Firebase uploads go to the owners group (`FIREBASE_OWNERS_TESTER_GROUPS`) on every run and to the Android / iOS tester group only for builds of `main` | Owner wants every branch build for themself but fewer builds for the wider tester groups | workflows `android`, `ios`, docs |
| 2026-11-08 | PLT-004, PLT-016 | New PLT-016: fullscreen request fallback chain, exit by document state, one retry on the next gesture, failure reason on the console | Owner test: presentation mode did not enter fullscreen in Edge on Windows | `WebFullscreen`, `PresentationPlatform`, `NavigationHandler`, DEC-126, E2E |
