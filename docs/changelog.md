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
