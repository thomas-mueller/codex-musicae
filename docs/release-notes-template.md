# Release notes — template

Copy this file into the GitHub release (or a note next to the tag) and fill it in. Keep it short.

## Version

- Version string: `____` (`git describe --tags --always --long`; the info icon of the app shows the same text)
- Tag: `v0.<n>.0` (milestone) or `v0.<n>.<p>` (fix); for the release of v1 additionally the annotated tag `v1.0.0` on the same commit
- Date: ____

## What changed

Requirement IDs, taken from `docs/changelog.md` since the last tag, and the milestones delivered. One line each.

- `ID` — what a user can now do or what works differently

## Known limitations touched

IDs from `docs/limitations.md` that this version changes or that users are likely to meet (for example `LIM-002`, `LIM-011`). Say what the user sees.

- `LIM-nnn` — ____

## Checks behind this version

- Lint, unit tests, build (`lint-test`): ____
- End-to-end matrix (`e2e`: three desktop engines full suite, device profiles `@smoke`): ____
- Performance budgets (`perf` job, numbers vs `T:budgets`): ____
- Traceability (`docs/traceability.md` generated, exceptions unchanged?): ____
- Device checklist (`docs/device-checklist.md`, release checklist): device ____, date ____, result ____
- iOS Safari testers (`docs/tester-checklist-ios-safari.md`): ____ testers, problems ____

## Upgrade notes

Metadata schema version (`schemaVersion`) and whether existing files keep opening: ____
