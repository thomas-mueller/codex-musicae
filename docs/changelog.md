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
| 2026-11-20 | 263 new `v2` IDs; 54 V1 IDs `changed`, 2 `dropped` | V2 requirements entered as atomic entries; V1 entries that V2 changes keep their text with a pointer to the successor | V2 (`docs/v2-requirements.md`, `docs/roadmap-v2.md`), V2-M0 S1 | V2-M1…M19; tables below |
| 2026-11-20 | MRK-044…MRK-050 (+7 IDs, 270 `v2` IDs in total; MRK-050 restores the long press to the other end, MRK-032 now edits text on a selected mark; MRK-047…MRK-049 split MRK-045/MRK-046 after the S2 review), ORG-020, ORG-021; R-60a-e | Owner decisions in V2-M0 S2: a tap on a marker (no tool active) selects the mark, a selected jump offers pass, change target and delete, other marks offer delete; marks-list placement of start mark and bookmarks; the undefined term "break hints" is removed from R-60a-e and V2-M13 | Open points found in V2-M0 S1 (`docs/questions.md`) | V2-M10, V2-M13 |
| 2026-11-20 | EDN-006, EDN-009, EDN-013 | S2 review: two feature files kept (owner decision); the paid build is the native file with every switch forced on by the composition root; EDN-013 distinguishes shared and web-only switches | V2-M0 S2 review (`docs/review-report.md`, findings 1, 2) | V2-M3 |
| 2026-11-25 | TST-015, TST-023…TST-027 | V2-M3b done: TST-015 becomes `changed` (successors TST-024, TST-025); the load suite also runs the high-resolution scan (tiff2pdf) and the 98-page score besides the 281-page file; the Firefox/WebKit "first three entries" smoke rule is dropped (every detection entry runs on every engine of its `engines` list); the WebKit run of `IMSLP30601-PMLP01586-bs5fp.pdf` (page 7: 11 instead of 12 systems) stays red, no deviation recorded | Owner decisions of V2-M3b S1 to S3: keep all engines for the tiff2pdf scan, leave the Firefox and the bs5fp differences for M8, add `load` to two entries | V2-M3b, `expected.json`, `e2e/detection-corpus.spec.ts`, `e2e/perf/load.spec.ts`, `e2e.yml` |
| 2026-11-26 | SAV-016, MRK-012 | V1 jumps from junction 0 or to junction N are converted to a start mark or a stop only where the playing order stays identical, else dropped; a bookmark may hold a cross-file target (DEC-153) | The migration rule had no system for these jumps; the shape of a cross-file bookmark was not stated | V2-M4, `migrate-v1` and `marks` fixtures; V2-M4 S3: the V1 chips can no longer create such jumps |
| 2026-11-26 | DET-015 → MRK-014; SAV-015…SAV-017 | The app stores and saves marks on systems (schema 2). A detection re-run deletes marks page by page instead of by the total system count; DET-015 is `changed`. A new jump from the first bar or to the last bar is rejected. V1 marks of a file without detection appear when detection has finished (DEC-154…DEC-156) | V2 data model | V2-M4 S3, `state/`, `core/edits`, `core/metadata` |
| 2026-11-26 | Tests (V2-M4 S3) | Changed existing tests. `core/metadata.spec` and its fixtures, merged with the S2 `metadata-v2` tests: PM04 says version 3 for "newer", PM16 and PM17 expect the upgraded document; SM1–SM4 and the schema 1 round trip are removed with the schema 1 writer (successors SV01–SV05), RM1–RM3 (successors RV1–RV3); the older-reader test checks the written version, as the schema 1 reader is no longer public. `metadata-v2.property.spec` is now `metadata.property.spec`. Both build schema 1 text with `src/testing/schema1-text.ts` | The schema 1 writer and the temporary `metadata-v2` file are gone | V2-M4 S3 |
| 2026-11-26 | Tests (V2-M4 S3) | `core/edits.spec` runs the fixtures on marks on systems and compares the junction view. Fixtures AJ3, RJ1, RJ2, UJ1–UJ5 and JX1–JX4: the second jump starts at gap 1 instead of gap 0; UJ2 retargets to gap 2 instead of gap N; JX1 expects nothing starting at gap 0; JX4 looks at the empty gap 4. New AJ7, AJ8, UJ6 reject edge jumps. RC1 and RC2 (DET-015 total count) are removed | A jump from gap 0 or to gap N has no system form (DEC-153) | V2-M4 S3 |
| 2026-11-26 | Tests (V2-M4 S3) | `state/document.store.spec`: the playing-order cases O08, O10, O12, O13, O17, O18, O20, O21 and the numbers case N3 leave the three store loops; a new test checks that each of their edge jumps is rejected (owner approved during S3; not foreseen in the S3 plan) | Same | V2-M4 S3 |
| 2026-11-26 | Tests (V2-M4 S3) | `state/document.metadata.spec`, `save.service.spec`, `session.store.spec`: schema 1 shaped metadata and `replaceMarks` inputs are schema 2; one assertion reads `systemMarks` because there is no junction view without systems; the "newer" case writes version 3. `save-pipeline.spec` and `e2e/support/saving.ts`: `parseMetadata` takes the length cap. `detection-redetect.spec`: the setup also accepts system counts page by page. `e2e/organization-marks.spec`: ORG-019 jumps from bar 1 to bar 21 instead of the first to the last bar. `marks.spec` and `mark-positions.spec` only gained tests | Schema 2 and DEC-153 | V2-M4 S3 |
| 2026-11-26 | MRK-015 | Moved from V2-M4 to V2-M6; the text is unchanged and the status stays `todo` (owner decision) | V2-M4 keeps cross-file references, but only the resolution of V2-M6 can decide that one is unresolved | V2-M4, V2-M6 |
| 2026-11-26 | UIX-025, UIX-026, UIX-034 | Settings mode and settings registry built. UIX-034 moves from V2-M7 to V2-M5: undo and redo leave the compact top bar; the compact annotation tool popup holds them (the compact part of UIX-033, which stays `todo` for V2-M7) | With the settings button the compact top bar needed 352 px, more than the minimum width of 320 px (owner decision, DEC-159) | V2-M5, V2-M7, `features/shell` |
| 2026-11-26 | UIX-022 | Moved from V2-M5 to V2-M6; the text is unchanged and the status stays `todo` (owner decision) | No V2-M5 step covers it, and V2-M6 replaces the open button, the only control with a right-click action | V2-M5, V2-M6 |
| 2026-11-26 | EDN-006 | "every feature has an on/off switch with a comment" becomes "every switch has a comment". The rule that every new feature needs a switch and a test per configuration is removed; the existing switches and the EDN-013 check stay (DEC-158) | Owner decision | `AGENTS.md`, `docs/roadmap-v2.md`, V2-M17 |
| 2026-11-26 | Tests (V2-M5 S1) | Changed existing tests, both approved by the owner. `e2e/shell-controls.spec`: the UIX-004/005 top-bar lists end in the settings button and the compact one has no undo or redo; the compact FIL-007 test opens the tool popup first. `features/shell/app-shell.spec`: the shared setup of the ink controls sets the wide viewport after the first render (before it, the size observer replaced it with 0x0, so the tests ran the compact layout); no assertion changed | Undo and redo left the compact top bar | UIX-004, UIX-005, FIL-007, ANN-006, ANN-013 |
| 2026-11-26 | UIX-023, UIX-024 | "Reset all settings" is built (UIX-024 `done`). Clarification, text unchanged: "all user settings" means the listed items; the default aspect ratio per orientation and the stylus values are not reset (DEC-160). UIX-023 stays `todo` until the language setting exists | Owner decisions | V2-M5, `state/settings-registry`, `state/settings-reset` |
| 2026-11-26 | UIX-010 | No text change. Fix: on a first visit, icons added after the first render stayed blank for seconds; the sprite is now loaded once into the document (DEC-161). New tunables `iconSprite` | Bug found in V2-M5 S2 | `features/shell/icon`, `adapters/web/icon-sprite`, `app.config`, `e2e/icons.spec` |
| 2026-11-26 | GEN-013, I18-003, I18-004, UIX-023 | Languages built: seven files, system language with English fallback, changeable under General and covered by "Reset all settings"; all four `done`. Process changes, no requirement text changed: the German texts are drafted by the agent and reviewed by the owner (amends DEC-134), and a new string goes into all seven files (`docs/roadmap-v2.md`). New tunables `i18n` and `testing.longTextExtraRatio` (DEC-162) | V2-M5 S3, owner decisions | `assets/i18n`, `docs/i18n-status.md`, `core/language`, `state/language.store`, V2-M16 |
| 2026-11-27 | UIX-021, UIX-027…UIX-030 | Tooltips stay inside the screen and wrap; an icon-usage test and `docs/icons.md`; all five `done` (UIX-021 and UIX-030 by review, see the traceability exceptions). Fix: tooltips of disabled controls were dimmed and hidden behind their neighbours. New tunables `layout.tooltipMaxWidthPx` and `layout.tooltipEdgeGapPx` (DEC-163). V2-M5 is complete | V2-M5 S4, owner decision | `core/tooltip-position`, `features/shell/tooltip.directive`, `styles.css`, `icon-button.css`, `tab-item.css`, V2-M14, V2-M18 |
| 2026-11-27 | UIX-015 → UIX-035; UIX-036 (+2 `v2` IDs) | The expanded top bar loses its More button: "save a copy" becomes a top-bar button, and the version moves to the settings mode in every layout, so the info popover goes (DEC-164). Requirements and milestone texts only, not yet built | Owner request, preparation of V2-M6 | V2-M6 S1, V2-M15 S2 |
| 2026-11-27 | FIL-021, FIL-022, FIL-025, FIL-026 (not built before); UIX-002 → UIX-037 (+1 `v2` ID) | Reworded before they were built. Old FIL-021: "…the file name, a status marker and a close icon." Old FIL-022: "The status marker of the file entry shows modified (unsaved changes), error, read-only lock or needs-re-open, always at the same position; in free and web it is the only change indicator." Old FIL-025: "A "+" button right of the next-file button opens the file picker; it replaces the V1 open-file control." FIL-026 said "+" for the button. New: red "*", lock after the name, all statuses, a pale blue pill (a tab highlight and a down arrow were built first and rejected on sight), leftmost open-file button, one mode button below 600 px, no previous/next buttons and no close icon in the top-bar entry below 600 px (DEC-165) | Owner decisions in V2-M6 S1 | V2-M6 S1 |
| 2026-11-27 | Tests (V2-M6 S1) | Changed existing tests. `tabs.spec` → `files/files.spec` and `tab-item.free.spec` → `file-item.free.spec` (tab bar, shrinking and "all tabs" cases removed; right-click inverted; marker order). `popup-host.spec`, `popup-host.free.spec` (compact More menu), `version-wiring.spec` (settings view), `shell-text.spec` (ignored selector), `settings-editions.spec` and `language-switch.spec` (approved by the owner during S1). New cases in `mode-switch.spec`, `settings-view.spec`, `long-press.directive.spec`, `layout.spec`; new `top-bar.spec`, `file-entry.spec`. E2E: `files-tabs.spec` → `files.spec` (the recent-files case runs on the paid build); `session-restore`, `organization-viewer`, `resource`, `free-edition`, `web-storage`, `support/fit` (file selectors); `shell-controls`, `tooltips`, `saveCopyDownload` (no More button on wide screens); every mode click goes through `support/modes` | Same | V2-M6 S1 |
| 2026-11-27 | UIX-038 (+1 `v2` ID) | All app text uses a modern sans-serif font of the device; before, most text fell back to the browser's serif default and some numbers were monospace. No font file, no dependency. New tunable `typography.fontFamily` | Owner request during V2-M6 S1 | V2-M6 S1, `styles.css`, `testing/font.spec` |
| 2026-11-27 | FIL-021…FIL-028, UIX-022, UIX-035…UIX-038 | V2-M6 S1 is built; all `done`. Tests changed after the entry above: `e2e/support/modes` repeats the tap on the mode button until the choice shows; `tooltips.spec` waits for the mode popup to close | V2-M6 S1 | V2-M6 |
| 2026-11-27 | FIL-017, SAV-011, PLT-010 → FIL-037; UIX-036; TST-007 | The "save a copy" button is removed from the top bar and from the phone More menu (DEC-167). "Save as new file" (overwrite question, close question, lock notice) is the only way to write elsewhere; in Safari and Firefox it downloads. The More button shows in the compact annotation layout only. Old UIX-036: "…"save a copy" is a top-bar button next to the settings button, disabled without a document or when its feature switch is off." Old TST-007 said "save a copy". The `saveCopy` feature switch stays and now stands for "save as new file" | Owner: the button is not needed | V2-M6 S2 |
| 2026-11-27 | Tests (removal of "save a copy") | `top-bar.spec` and `popup-host.spec` check that the button is gone; `popup-host.free.spec` removed (it tested only that button; the free edition is covered by the lock and close-question specs); `session.store.spec` and `free-edition.spec` go through "save as new file". E2E: `saveCopyDownload` downloads through the lock notice; `free-edition`, `shell-controls`, `tooltips` | Same | V2-M6 S2 |
| 2026-11-27 | FIL-020, FIL-022, FIL-033…FIL-041, FIL-046, FIL-047; FIL-049, FIL-050 (+2 `v2` IDs); SAV-012; LIM-029, LIM-034 | V2-M6 S2: overwrite question, "save as new file", notice for unwritable files, close question whenever changes would be lost, none of them in presentation mode. Reworded before built: FIL-022 (old: the lock "is a control that saves a copy"), FIL-039 (old: "…shows one warning per file per session offering "Save as new file"; the modified marker stays."). SAV-012: finished detection no longer marks a file as changed where it cannot be written. LIM-029 lifted; LIM-034 new (DEC-166) | Owner decisions in V2-M6 S2 | V2-M6 S2 |
| 2026-11-27 | Tests (V2-M6 S2) | Changed existing tests: `testing/provide-test-ports` (overwrite question off by default), `session.store.spec` (its preferences likewise; the read-only close answers the close question), `free-edition.spec` (closing a changed file asks), `feature-persistence.spec` (per-file choices persist), `files.spec` and `file-item.free.spec` (the lock shows the notice), `reset-confirm.spec` (the question is switched off again after the reset). New: `save-rules`, `file-prompts`, `overwrite-choices`, `session.saving`, `features/saving/saving` specs, cases in `save.service` and the file adapters, E2E `save-dialogs` | Same | V2-M6 S2 |
| 2026-11-27 | Process (no requirement) | Local E2E runs only after the last step of a milestone, on desktop Chromium only; when a requirement may be marked `done` before that (DEC-168) | Owner: the E2E runs take too long | `AGENTS.md` and its generated copies, `docs/roadmap-v2.md`, `docs/milestones/V2-M06.md` |
| 2026-11-27 | FIL-020, FIL-033…FIL-039, FIL-041, FIL-046, FIL-047, FIL-049, FIL-050 | V2-M6 S2 is built; `done` on unit tests with the E2E specs written, to be confirmed by the E2E run after S4 (DEC-168). FIL-040 stays `todo` until S3 | V2-M6 S2 | V2-M6 |
| 2026-11-27 | FIL-026; EDN-017 (+1 `v2` ID) | Free and paid differ only in saving and persisting. Old FIL-026: "…in free and web the list is switched off (EDN feature switch)." The switches `shareIn` and `crossFileAutoOpen` are removed (DEC-169) | Owner decisions | V2-M6 S3 |
| 2026-11-27 | FIL-029, FIL-030, FIL-031, FIL-040, NFR-020, EDN-017 | V2-M6 S3 is built: share-in, and inactive files release their rendered data (DEC-170); `done` on unit tests with the E2E specs written, to be confirmed after S4. FIL-032 stays `todo` until S4 | V2-M6 S3 | V2-M6 |
| 2026-11-27 | Tests (V2-M6 S3) | Changed existing tests: `free-edition.spec` (incoming files open in free), `files.spec` unit and E2E (recent list in free), `feature-file-access.spec` (reopen and forget pass through), `session.store.spec` (NFR-010 case now checks the release on leaving). New: cases in `features.spec`, `platform-rules.spec`, `working-resolution-renderer.spec`, `region-renderer.spec`, `detection.service.spec`, `session.store.spec`; E2E `memory.spec` | Same | V2-M6 S3 |
| 2026-11-27 | PLY-017, FIL-051, FIL-052, MRK-016 | V2-M6 S4: a cross-file jump ends the order of its file; the next page turn continues in the other file at the target line, and turning back returns one jump at a time. MRK-016 now covers every case in which the jump cannot lead on. Fixture G03 of `playing-order-start.cases` now expects a cross-file jump as an exit instead of ignoring it | Owner decision ("continue in file B", DEC-171) | M6 S4; `core/playing-order`, `core/cross-file`, `state/cross-file*`, `e2e/cross-file.spec` |
| 2026-11-27 | FIL-032, FIL-042–FIL-045, MRK-015, MRK-017 | Built: referenced files open in the background from the open and recent files; warnings as notices below the top bar; the "don't show again" of the close warning is a setting | V2-M6 S4 (DEC-171) | `features/saving/cross-file-notice` |
| 2026-11-27 | DEC-168 | The local E2E run at the end of a milestone also runs the `@smoke` tests on the Chromium tablet (`chromium-galaxy-tablet`) | Owner decision | `AGENTS.md`, `docs/roadmap-v2.md` |
| 2026-11-28 | Tests (V2-M7 S2) | One existing test changed, approved by the owner: `e2e/shell-controls.spec`, UIX-006 expanded: the expected tool strip of organization mode ends in undo and redo (UIX-033). Existing unit tests are unchanged; tests were added to `core/history.spec` and `state/detection-redetect.spec`. |

## V2 changes to V1 requirements

Recorded by V2-M0 S1 (2026-11-20). The V1 text stays in `requirements.md` with status `changed` or `dropped` and a pointer to its V2 successor; it is copied here verbatim as the frozen V1 wording.

| ID | V1 status | V1 text | V2 status | Successor | Milestone |
|---|---|---|---|---|---|
| GEN-002 | v1·done | The Android applicationId and Capacitor appId are `T:identity.appId`. | changed | GEN-011 | V2-M3 |
| GEN-003 | v1-optional·todo | The iOS bundle ID is `T:identity.appId`. | changed | GEN-011 | V2-M3 |
| GEN-009 | v1·done | Every control is an icon from the icon set; visible text is limited to numbers, the version string and error codes. | changed | GEN-013 | V2-M5 |
| I18-002 | v1·done | A second language can be added by adding one translation file, without code changes. v1 ships English only. | changed | I18-003 | V2-M5 |
| FIL-003 | v1·done | Each tab shows the file name, a close icon and a status marker (unsaved dot, error icon, read-only lock icon, needs-re-open icon). | changed | FIL-021 | V2-M6 |
| FIL-004 | v1·done | In expanded layout the tabs are a tab bar; in compact layout one button shows the current tab name and opens the list of all tabs. | changed | FIL-023 | V2-M6 |
| FIL-008 | v1·done | A recent-files list (max `T:resources.recentFilesMax`, newest first) opens from the open-file control; selecting an entry reopens it, or asks to re-pick the file if access is lost. | changed | FIL-026 | V2-M6 |
| FIL-012 | v1·done | After startup the mode is annotation mode, even if the app was closed in presentation mode. | changed | FIL-048 | V2-M16 |
| FIL-016 | v1·done | If a file cannot be written, its tab shows the read-only lock icon and offers "save a copy"; ink, jumps and breaks stay editable in memory. | changed | FIL-039 | V2-M6 |
| SAV-004 | v1·done | The JSON contains: `schemaVersion`, `appVersion`, `pageCount`, detection level, system rectangles per page, jumps, breaks, stops, and optional aspect-ratio overrides per orientation. | changed | SAV-015 | V2-M4 |
| DET-003 | v1·done | A page is rendered to a bitmap at the level's `renderScale`; if width×height exceeds `T:resources.maxCanvasPixels` the scale is reduced to fit. | changed | DET-030 | V2-M8 |
| DET-004 | v1·done | The bitmap is converted to gray and binarized with the adaptive mean threshold (`THRESH_BINARY_INV`, ink = foreground; block size and constant per level, `T:detection.levels`); the bounding rectangle and the pixel area of every 4-connected component are collected. The background component (label 0) is not collected. | changed | DET-033 | V2-M8 |
| DET-013 | v1·done | Three levels `fast`, `standard`, `fine` each define `minSystemWidthRatio`, `fullWidthSystemRatio`, `renderScale`, `adaptiveBlockSize` and `adaptiveC` (`T:detection.levels`); the default is `T:detection.defaultLevel`. `renderScale` is bitmap pixels per PDF point, written as dpi / 72: `fast` 100 dpi, `standard` 150 dpi, `fine` 200 dpi (ASM-09). | changed | DET-030 | V2-M8 |
| DET-014 | v1·done | Organization mode offers a level selector (three icon steps); choosing a level asks for confirmation and then re-runs detection. | changed | DET-030 | V2-M8 |
| DET-016 | v1·done | Organization mode shows detection progress (processing icon, processed/total pages); slide modes show the slide count as "n+" until detection is complete. | changed | ORG-032 | V2-M8 |
| DET-017 | v1·done | Detection pauses while the user interacts (resumes after `T:detection.idleBeforeResumeMs` without input), while the app is hidden, and under battery saver where detectable. | changed | DET-027 | V2-M8 |
| PLY-002 | v1·done | The playing order is generated by this replay: set position = 0 and all arrival counts = 0; repeat: increment the arrival count at the position; if a jump exists with origin = position and pass = arrival count, set position = its target and repeat; otherwise, if position = N stop; otherwise append system position+1 to the order and set position = position+1. | changed | PLY-015 | V2-M4 |
| PLY-003 | v1·done | Pass n of a jump means the n-th arrival at its origin junction, counting the start at junction 0, forward steps and jump arrivals. | changed | PLY-015 | V2-M4 |
| PLY-007 | v1·done | A jump has an integer pass ≥ 1; its origin and its target may be any junction 0..N, and the target differs from the origin. A jump from junction N fires when the end is reached on that pass (D.C. at the end of a piece). | changed | PLY-016 | V2-M4 |
| PLY-012 | v1·done | With no jumps, breaks or stops, the playing order is systems 1..N in print order. | changed | PLY-015 | V2-M4 |
| ORG-003 | v1·done | Zoom: default on open is fit-page; the minimum is fit-page; the maximum is `T:zoom.max` × the fit-width scale; the reset button returns to fit-page; content smaller than the viewport is centered; zoom buttons step by `T:zoom.buttonStep`. | changed | ORG-047 | V2-M13 |
| ORG-010 | v1·done | Bars use `T:colors.orgBar.tint` at `opacity`; a selected junction uses `selectedOpacity`, on both bars of a page change. | changed | ORG-025 | V2-M8 |
| ORG-011 | v1·changed | Each bar shows one compact row with the stop symbol and the break scissors line. The playing-order numbers are not on the bars but on the music systems (ORG-012); jump markers sit on the systems too (ORG-018). There is no numbering toggle. *(Changed after review: the numbers and jump badges moved from the bars to the systems.)* | changed | MRK-001 | V2-M4 |
| ORG-012 | v1·changed | Every music system shows its playing-order numbers (PLY-010), ascending and comma separated ("3, 9"), as a label at the height of the system and horizontally centered on the page. The digits cover `T:layout.systemLabelHeightRatio` of the system height, in the light weight `T:layout.systemLabelFontWeight`, with the color and transparency of the bars (`T:colors.orgBar`). A system that is never played has no label. The bars show no numbers. System numbers in the original PDF order are not shown anywhere. *(Changed after review: formerly the numbers of the system above each bar.)* | changed | ORG-028 | V2-M8 |
| ORG-013 | v1·done | Tapping a bar selects its junction; tapping empty space, Esc or back deselects. Taps in organization mode never navigate. | changed | ORG-025 | V2-M8 |
| ORG-014 | v1·done | A selected junction shows a chip with icons: jump, slide break, stop, delete (delete only if the junction holds an item). | changed | ORG-042 | V2-M10 |
| ORG-015 | v1·done | Jump creation: select the origin, tap the jump icon, all other bars become tappable targets with a hint bar and a cancel icon; page navigation and zoom stay active; tapping a bar creates the jump; Esc or back cancels. | changed | MRK-022 | V2-M10 |
| ORG-016 | v1·changed | After creation a stepper opens to set the pass number (integer ≥ 1). A new jump starts at the number of the existing jumps with the same origin plus one (first jump of a bar 1, second 2, …). *(Changed after review: the default was always 1.)* | changed | MRK-023 | V2-M10 |
| ORG-017 | v1·done | Several jumps may sit on one junction; two jumps with the same origin and pass are allowed (PLY-006). There are no plausibility checks. | changed | MRK-002 | V2-M4 |
| ORG-018 | v1·changed | Jump markers sit on the music systems. The start is at the right edge of the source system (system `origin`), vertically centered, with the jump icon rotated by `T:layout.markerRotationDeg` (the split points toward the end of the PDF); the end is at the left edge of the system after the target junction, vertically centered, with a merge icon (arrows coming from the beginning of the PDF). Both carry the label "<previous> → <next> ×<pass>": the playing-order numbers of the system played just before the jump and the one played right after it (the numbers shown on the systems, ORG-012); a number that does not exist (start or end of the playing order) or a jump that is never reached shows `T:layout.unknownNumber`. Both ends have one color from `T:colors.jumpPalette`; several markers on a system stack from the edge. At junction 0 (no source system) the start and at junction N (no next system) the end sit on the bar of that junction. *(Changed after review: formerly badges on the bars with page·bar labels, then print numbers.)* | changed | MRK-009 | V2-M4 |
| ORG-019 | v1·changed | A long press (`T:layout.longPressMs`) on a jump marker scrolls to the other end of the jump. | changed | MRK-050 | V2-M10 |
| ORG-020 | v1·changed | Tapping a jump marker selects the jump; the chip then offers pass, change target and delete. | changed | MRK-044, MRK-045 | V2-M10 |
| ORG-021 | v1·changed | A marks-list button opens the list of jumps, slide breaks and stops in the order of the final playing order: an item is placed where the playing position first meets it (a jump where it fires, a stop where it ends the order). Items that are never reached follow at the end, dimmed: jumps in creation order, then breaks, then stops. Labels use playing-order numbers: jump "<previous> → <next> ×<pass>" with its color, slide break scissors icon and "<previous> \| <next>", stop the stop icon and "<previous>". Compact layouts show a sheet; expanded layouts show a panel beside the button on the side of the tool strip, which never covers the viewer's scroll bar. Tapping an entry navigates to it and selects it; a swipe to the left or a trash icon deletes it. *(Changed after review.)* | changed | MRK-040, MRK-046, MRK-048, MRK-049 | V2-M10 |
| ORG-022 | v1·done | The break icon toggles a slide break on the selected junction; a break shows as a solid line in `T:colors.breakLine` with a scissors icon at the left edge. | changed | MRK-003 | V2-M4 |
| ORG-023 | v1·done | The stop icon toggles a stop on the selected junction; it shows the stop icon on the bar. | changed | MRK-003 | V2-M4 |
| ORG-024 | v1·done | Deleting a jump, break or stop is immediate and has no undo. | changed | ANN-014 | V2-M7 |
| SLD-009 | v1·done | Filler that overlaps the padded area of a system not on this slide is covered, over the full slide width and the vertical extent of that area, by `T:colors.canvasGrey` at `T:colors.overlayOpacity`. | changed | SLD-029 | V2-M13 |
| SLD-014 | v1·done | The global default ratio is stored per orientation; its first value is the presentation-mode viewport ratio captured at the first presentation entry in that orientation, before that the device screen ratio; rounded to `T:aspectRatio.roundDecimals` and clamped. | changed | SLD-020 | V2-M13 |
| SLD-017 | v1·done | "Show more" and "show less" buttons are in the bottom bar (expanded) or the overflow menu (compact), in annotation mode. | changed | SLD-019 | V2-M13 |
| ANN-001 | v1·done | Tools are pen, highlighter, eraser. The active tool's button has the toggled look (UIX-011). | changed | ANN-031 | V2-M12 |
| ANN-003 | v1·done | Each tool remembers its last color and width index in the preferences store; defaults `T:annotation.defaultPen` and `defaultHighlighter`. | changed | ANN-024 | V2-M11 |
| ANN-004 | v1·done | Pen and highlighter each offer 6 color presets and 3 widths (`T:colors.penPresets`, `highlighterPresets`, `T:annotation.penWidthsPt`, `highlighterWidthsPt`); the highlighter uses opacity `T:annotation.highlighterOpacity` with multiply blending. | changed | ANN-022 | V2-M11 |
| ANN-006 | v1·done | Undo and redo cover added and erased strokes per document, up to `T:annotation.undoDepth` steps, and are cleared when the document closes. | changed | ANN-014 | V2-M7 |
| NAV-002 | v1·done | Keys (`T:keymap`): next = PageDown, ArrowRight, ArrowDown, Space; previous = PageUp, ArrowLeft, ArrowUp, Shift+Space; first = Home; last = End. Keys with Ctrl, Alt or Meta are ignored. | changed | NAV-021 | V2-M7 |
| UIX-001 | v1·done | The modes are organization, annotation and presentation; the current mode is global state. | changed | UIX-025 | V2-M5 |
| UIX-002 | v1·done | A segmented three-icon control switches modes, in the same place in both layouts; the active mode is filled, the others outlined; it is hidden in presentation mode. | changed | UIX-037 | V2-M6 |
| UIX-004 | v1·done | Compact annotation layout: top bar with tab switcher, open-file, mode switch, undo, redo; bottom bar with previous, "slide x of n", next, zoom −, zoom +, zoom reset; one floating button expands to pen, highlighter, eraser; aspect-ratio buttons and the version info sit in the overflow menu. | changed | FIL-021 | V2-M6 |
| UIX-005 | v1·done | Expanded annotation layout: tab bar on top; vertical tool strip on `T:layout.toolStripSide` with pen, highlighter, eraser, undo, redo; popup next to it; the same bottom bar plus the aspect-ratio buttons. | changed | FIL-021 | V2-M6 |
| UIX-006 | v1·done | Organization layout uses the same frame; the tool strip is replaced by level selector, marks-list button and overflow; the bottom bar shows "page x of n", previous, next and zoom buttons. In compact layout the organization controls sit behind one overflow button that opens a sheet. | changed | ORG-042 | V2-M10 |
| UIX-015 | v1·done | An info icon shows the version string (PIP-005) in a small popover. | changed | UIX-035 | V2-M6 |
| FIL-017 | v1·todo | "Save a copy" writes the modified PDF to a new file. _P: web download or save picker; Android document-create intent._ | changed | FIL-037 | V2-M6 |
| SAV-011 | v1·todo | Where the platform allows, saving writes to the same file. _P: web in-place only in Chromium (File System Access); Safari and Firefox offer "save a copy" only._ | changed | FIL-037 | V2-M6 |
| PLT-010 | v1·done | Safari and Firefox have no in-place save; saving offers "save a copy". | changed | FIL-037 | V2-M6 |
| PLT-011 | v1·todo | On every push the E2E suite runs on Chromium, Firefox and WebKit, including Android and iPad/iPhone device profiles. | changed | TST-018 | V2-M17 |
| NFR-009 | v1·done | Inactive tabs release their bitmaps and keep only lightweight document data. | changed | NFR-020 | V2-M6 |
| PIP-001 | v1·changed | Pipeline `lint-test` runs on every push to every branch (not on tag pushes): lint, lint self-test, unit tests and the production build. E2E on three engines runs in the separate workflow `e2e` on every push, one job per Playwright project (nine in parallel), each building for itself; it is temporarily optional: `deploy-web` and `android` do not wait for it (DEC-100). No artifacts are used (free-account storage quota). | changed | PIP-012 | V2-M1 |
| PIP-005 | v1·done | The version string is `git describe --tags --always --long` (checkout with full history), injected at build time and shown in the app (UIX-015). | changed | PIP-018 | V2-M1 |
| PIP-006 | v1·done | Android `versionName` is the version string and `versionCode` is the commit count. | changed | PIP-019 | V2-M1 |
| STY-001 | v1-optional·done | The first pointer event with `pointerType` `pen` sets a persisted flag `stylusSeen`. | dropped | ANN-019 | V2-M11 |
| STY-002 | v1-optional·done | With `stylusSeen`, the pen draws and fingers zoom, pan, tap and swipe but never draw; tap zones and swipes work with a tool active. | changed | ANN-018 | V2-M11 |
| STY-003 | v1-optional·done | A setting "allow finger drawing" in the pen popup (default `T:stylus.allowFingerDrawingDefault`) lets fingers draw even with `stylusSeen`. | dropped | ANN-019 | V2-M11 |

## V2 requirement map

From the identifiers of `docs/v2-requirements.md` (`R-xxx`, `D-n`, idea `#n`) to the entries of `requirements.md` (V2-M0 S1). An ID may serve several sources; each entry belongs to one V2 milestone (in brackets). V1 IDs marked "unchanged" already state the V2 behavior. "DEC (M0 S2)" = a decision without its own requirement, recorded in `docs/decisions.md`.

| V2 source | Requirement IDs (V2 milestone) |
|---|---|
| R-UX1 | DET-033 (V2-M8), UIX-021 (V2-M5) |
| R-1a | FIL-020 (V2-M6) |
| R-1b | FIL-025 (V2-M6) |
| R-1c | FIL-021 (V2-M6), FIL-022 (V2-M6) |
| R-1d | FIL-022 (V2-M6) |
| R-1e | FIL-023 (V2-M6) |
| R-1f | FIL-024 (V2-M6) |
| R-1g | FIL-025 (V2-M6), FIL-026 (V2-M6) |
| R-1h | FIL-027 (V2-M6) |
| R-1i | FIL-028 (V2-M6) |
| R-1j | FIL-029 (V2-M6), FIL-030 (V2-M6), FIL-001 (V1, unchanged) |
| R-1k | FIL-031 (V2-M6) |
| R-1l | NFR-020 (V2-M6) |
| R-1m | FIL-032 (V2-M6) |
| R-1n | TST-021 (V2-M17) |
| R-2a | STO-008 (V2-M19) |
| R-2b | STO-009 (V2-M19) |
| R-4b | SLD-019 (V2-M13) |
| R-4c | SLD-020 (V2-M13), SLD-021 (V2-M13), SLD-022 (V2-M13) |
| R-5a-d | UIX-029 (V2-M5), UIX-030 (V2-M5) |
| R-6a | ANN-002 (V1, unchanged) |
| R-6b | ANN-020 (V2-M11) |
| R-6c | ARC-004 (V1, unchanged) |
| R-6d | ANN-019 (V2-M11), UIX-023 (V2-M5), UIX-024 (V2-M5) |
| R-6e | UIX-022 (V2-M6) |
| R-7a | ANN-022 (V2-M11) |
| R-7b | ANN-023 (V2-M11) |
| R-7c | ANN-024 (V2-M11) |
| R-7d | ANN-025 (V2-M11) |
| R-7e | ANN-026 (V2-M11) |
| R-7f | ANN-026 (V2-M11) |
| R-7g | ANN-027 (V2-M11) |
| R-8a | GEN-012 (V2-M3), GEN-006 (V1, unchanged) |
| R-8b | EDN-014 (V2-M3), EDN-015 (V2-M3), EDN-016 (V2-M3) |
| R-8c | STO-006 (V2-M19), GEN-005 (V1, unchanged) |
| R-8d | NFR-017 (V2-M1), NFR-018 (V2-M1) |
| R-10a-h | ORG-030 (V2-M8), ORG-031 (V2-M8) |
| R-11a | TST-009 (V2-M1), TST-018 (V2-M17), BKL-022 (device farms: later) |
| R-11b | TST-019 (V2-M17) |
| R-12a | GEN-013 (V2-M5), UIX-025 (V2-M5), BKL-009 (pedal remapping: V3) |
| R-12b | UIX-026 (V2-M5) |
| R-12c | ARC-008 (V2-M1) |
| R-12d | ARC-009 (V2-M3) |
| R-13a | TST-010 (V2-M2) |
| R-13b | TST-011 (V2-M2) |
| R-13c | TST-012 (V2-M2) |
| R-13d | TST-013 (V2-M2), TST-014 (V2-M2) |
| R-13e | TST-015 (V2-M2) |
| R-13f | TST-015 (V2-M2) |
| R-13g | DET-032 (V2-M8), TST-002 (V1, unchanged) |
| R-14a | TST-016 (V2-M2) |
| R-14b | ARC-007 (V2-M1) |
| R-14c | PIP-013 (V2-M1), PIP-014 (V2-M1), PIP-015 (V2-M1) |
| R-15a | PIP-016 (V2-M1) |
| R-15b | PIP-017 (V2-M1) |
| R-16a | PIP-018 (V2-M1) |
| R-16b | PIP-020 (V2-M1) |
| R-16c | PIP-020 (V2-M1) |
| R-16d | PIP-021 (V2-M19), PIP-005 (V1 source of the version, unchanged) |
| R-16e | PIP-020 (V2-M1) |
| R-16f | PIP-019 (V2-M1) |
| R-17a | NAV-025 (V2-M13) |
| R-17b | NAV-025 (V2-M13) |
| R-17c | NAV-026 (V2-M13) |
| R-17d | NAV-027 (V2-M13) |
| R-18a | DET-001 (V1, unchanged) |
| R-18b | DET-023, SAV-005 (V1, unchanged) |
| R-18c | DET-025 (V2-M8), DET-026 (V2-M8) |
| R-18e | DET-027 (V2-M8), DET-028 (V2-M8) |
| R-18f | DET-029 (V2-M8) |
| R-18g | DET-002, DET-019, DET-021, NFR-003 (V1, unchanged) |
| R-19a | DET-030 (V2-M8) |
| R-19b | ORG-042 (V2-M10) |
| R-19c | DET-030 (V2-M8), DET-031 (V2-M8), DET-032 (V2-M8), DET-033 (V2-M8) |
| R-19d | ORG-026 (V2-M8), ORG-027 (V2-M8) |
| R-19f | ORG-042 (V2-M10) |
| R-19g | ORG-025 (V2-M8) |
| R-19i | ORG-028 (V2-M8) |
| R-19j | ORG-029 (V2-M8) |
| R-19m-t | GEN-013 (V2-M5), HNT-001 (V2-M16), HNT-002 (V2-M16), HNT-003 (V2-M16), HNT-004 (V2-M16), HNT-005 (V2-M16), HNT-006 (V2-M16), HNT-007 (V2-M16), HNT-008 (V2-M16) |
| R-20a | SAV-018 (V2-M12), ANN-031 (V2-M12), ANN-045 (V2-M12) |
| R-20b | ANN-032 (V2-M12) |
| R-20c | ANN-033 (V2-M12) |
| R-20g | ANN-043 (V2-M12) |
| R-20h | ANN-044 (V2-M12) |
| R-20i | ANN-021 (V2-M11) |
| R-20j | GEN-013 (V2-M5), ANN-039 (V2-M12), ANN-040 (V2-M12) |
| R-20m | ANN-041 (V2-M12) |
| R-20n | ANN-042 (V2-M12) |
| R-20p | ANN-034 (V2-M12), ANN-035 (V2-M12), ANN-036 (V2-M12) |
| R-21a | EXP-001 (V2-M15), EXP-002 (V2-M15) |
| R-21b | EXP-003 (V2-M15) |
| R-21c | EXP-004 (V2-M15) |
| R-21d | EXP-006 (V2-M15) |
| R-21e | EXP-005 (V2-M15) |
| R-21f | EXP-001 (V2-M15) |
| R-21g | EXP-007 (V2-M15) |
| R-22a | EDN-001 (V2-M3), EDN-002 (V2-M3) |
| R-22b | EDN-003 (V2-M3) |
| R-22c | EDN-004 (V2-M3) |
| R-22d | ORG-048 (V2-M13), EDN-005 (V2-M3) |
| R-22e | EDN-006 (V2-M3), EDN-007 (V2-M3), EDN-008 (V2-M3) |
| R-22g | EDN-010 (V2-M3), STO-001 (V2-M19) |
| R-22h | STO-002 (V2-M19) |
| R-22i | GEN-011 (V2-M3), STO-003 (V2-M19) |
| R-22j | TST-020 (V2-M17), EDN-011 (V2-M3), EDN-012 (V2-M3) |
| R-22k | TST-020 (V2-M17), EDN-013 (V2-M3) |
| R-22l | EDN-009 (V2-M3) |
| R-23a-f | SLD-029 (V2-M13), SLD-008, UIX-009 (V1, unchanged) |
| R-26a | ORG-047 (V2-M13) |
| R-26b | NAV-023 (V2-M13) |
| R-26c | NAV-023 (V2-M13) |
| R-26d | NAV-024 (V2-M13), NAV-017 (V1, unchanged) |
| R-27a | NFR-021 (V2-M14) |
| R-27b | NFR-021 (V2-M14) |
| R-28a | MRK-018 (V2-M10) |
| R-28b | MRK-019 (V2-M10) |
| R-28c | MRK-020 (V2-M10), MRK-021 (V2-M10) |
| R-28d | MRK-022 (V2-M10) |
| R-28e | GEN-013 (V2-M5), MRK-009 (V2-M4), MRK-031 (V2-M10) |
| R-28f | MRK-009 (V2-M4) |
| R-28g | MRK-024 (V2-M10) |
| R-28h | MRK-024 (V2-M10) |
| R-28i | MRK-025 (V2-M10) |
| R-28j | MRK-026 (V2-M10) |
| R-28k | MRK-002 (V2-M4), MRK-003 (V2-M4), MRK-004 (V2-M4), MRK-005 (V2-M4), MRK-006 (V2-M4), MRK-007 (V2-M4) |
| R-28l | MRK-010 (V2-M4), MRK-011 (V2-M4), MRK-032 (V2-M10) |
| R-28m | MRK-027 (V2-M10), MRK-028 (V2-M10) |
| R-28n | ORG-043 (V2-M10), ORG-044 (V2-M10), ORG-045 (V2-M10) |
| R-28o | MRK-019 (V2-M10) |
| R-28p | MRK-029 (V2-M10) |
| R-28q | MRK-029 (V2-M10) |
| R-28r | MRK-030 (V2-M10) |
| R-29 | MRK-007 (V2-M4) |
| R-29a-f | MRK-033 (V2-M10), MRK-034 (V2-M10), MRK-035 (V2-M10) |
| R-30a | MRK-009 (V2-M4) |
| R-30b | MRK-037 (V2-M10) |
| R-30c | MRK-038 (V2-M10) |
| R-30d | MRK-039 (V2-M10) |
| R-30e | MRK-009 (V2-M4) |
| R-30f | FIL-042 (V2-M6) |
| R-30g | FIL-043 (V2-M6) |
| R-30h | MRK-016 (V2-M6), MRK-017 (V2-M6) |
| R-30i | FIL-044 (V2-M6) |
| R-30j | FIL-045 (V2-M6) |
| R-30k | FIL-002 (V1, unchanged) |
| R-32a | STO-004 (V2-M19), STO-005 (V2-M19) |
| R-34a | STO-010 (V2-M19) |
| R-34b | STO-011 (V2-M19) |
| R-34c | STO-012 (V2-M19) |
| R-34d | no requirement (branding decided later by the owner) |
| R-35a | STO-013 (V2-M19) |
| R-36a | ORG-034 (V2-M9), ORG-041 (V2-M9) |
| R-36b | ORG-035 (V2-M9), ORG-036 (V2-M9) |
| R-36c | ORG-037 (V2-M9) |
| R-36d | DET-034 (V2-M8), ORG-039 (V2-M9) |
| R-36h | ORG-038 (V2-M9) |
| R-36i | ORG-040 (V2-M9) |
| R-37a | ORG-032 (V2-M8) |
| R-37b | ORG-032 (V2-M8) |
| R-37c | ORG-033 (V2-M8) |
| R-38a | UIX-031 (V2-M14) |
| R-38b | UIX-031 (V2-M14) |
| R-39b | ORG-047 (V2-M13) |
| R-39c | ORG-048 (V2-M13) |
| R-40a | MRK-040 (V2-M10) |
| R-40b | MRK-041 (V2-M10) |
| R-40c | MRK-042 (V2-M10), MRK-043 (V2-M10) |
| R-44a | PIP-011 (V2-M1), PIP-012 (V2-M1) |
| R-46a | UIX-014 (V1, unchanged) |
| R-46b | UIX-027 (V2-M5) |
| R-46c | UIX-028 (V2-M5) |
| R-46d | UIX-032 (V2-M14) |
| R-47b | I18-003 (V2-M5) |
| R-47g | I18-004 (V2-M5) |
| R-47i | I18-005 (V2-M16), I18-006 (V2-M16), I18-007 (V2-M19) |
| R-52a-c | ANN-028 (V2-M11) |
| R-53a | ANN-029 (V2-M11), ANN-030 (V2-M11) |
| R-53b | ANN-010 (V1, unchanged) |
| R-54a | FIL-033 (V2-M6), FIL-035 (V2-M6) |
| R-54b | FIL-036 (V2-M6), FIL-037 (V2-M6) |
| R-54c | FIL-038 (V2-M6) |
| R-54d | FIL-034 (V2-M6) |
| R-54e | PLT-017 (V2-M17) |
| R-54f | FIL-039 (V2-M6), FIL-040 (V2-M6) |
| R-54h-k | FIL-041 (V2-M6) |
| R-55a | NAV-021 (V2-M7), NAV-022 (V2-M7), ANN-014 (V2-M7), ANN-015 (V2-M7), ANN-016 (V2-M7), ANN-017 (V2-M7) |
| R-57a | PLT-004, PLT-016 (V1, unchanged) |
| R-57b | PLT-004, PLT-016 (V1, unchanged) |
| R-58a | NFR-022 (V2-M14) |
| R-58b | NFR-023 (V2-M14) |
| R-58c | NFR-023 (V2-M14) |
| R-58d | TST-017 (V2-M14) |
| R-58e | NFR-024 (V2-M14) |
| R-59a | MRK-036 (V2-M10) |
| R-60a | SLD-023 (V2-M13) |
| R-60b | SLD-024 (V2-M13), SLD-025 (V2-M13) |
| R-60c | SLD-026 (V2-M13) |
| R-60d | SLD-027 (V2-M13), SLD-028 (V2-M13) |
| R-60e | SLD-023 (V2-M13) |
| R-61 | ORG-046 (V2-M12) |
| D-1 | FIL-041 (V2-M6), MRK-012 (V2-M4), FIL-002 (V1, unchanged); DEC (M0 S2) |
| D-2 | DEC (M0 S2); values set in the implementing milestone |
| D-3 | I18-007 (V2-M19), DEC (M0 S2) |
| D-4 | STO-002 (V2-M19), STO-005 (V2-M19), DEC (M0 S2) |
| D-5 | FIL-035 (V2-M6) |
| D-6 | FIL-046 (V2-M6), FIL-047 (V2-M6), FIL-006 (V1, unchanged) |
| D-7 | EDN-008 (V2-M3), EDN-014 (V2-M3), DEC (M0 S2) |
| D-8 | MRK-017 (V2-M6) |
| D-9 | EDN-015 (V2-M3) |
| D-10 | MRK-008 (V2-M4), MRK-010 (V2-M4), MRK-023 (V2-M10) |
| D-11 | ORG-042 (V2-M10) |
| D-12 | ORG-028 (V2-M8), MRK-009 (V2-M4), MRK-010 (V2-M4) |
| D-13 | PLY-015 (V2-M4), MRK-006 (V2-M4) |
| D-14 | MRK-040 (V2-M10) |
| D-15 | DET-030 (V2-M8), DET-031 (V2-M8) |
| D-16 | DET-027 (V2-M8), DET-028 (V2-M8) |
| D-17 | ANN-018 (V2-M11), ANN-019 (V2-M11), STY-004 (V1, unchanged) |
| D-18 | SLD-020 (V2-M13), SLD-013, SLD-015 (V1, unchanged) |
| D-19 | UIX-031 (V2-M14) |
| D-20 | FIL-026 (V2-M6) |
| D-21 | ANN-037 (V2-M12), ANN-038 (V2-M12), DEC (M0 S2, Bravura dependency) |
| D-22 | TST-016 (V2-M2) |
| D-23 | TST-009 (V2-M1), TST-019 (V2-M17) |
| D-24 | ANN-017 (V2-M7), MRK-013 (V2-M4), MRK-014 (V2-M4), MRK-015 (V2-M6) |
| D-25 | FIL-048 (V2-M16) |
| D-26 | MRK-011 (V2-M4), MRK-032 (V2-M10) |
| D-27 | ORG-046 (V2-M12) |
| D-28 | DEC (M0 S2); BKL-025 |
| D-29 | DEC (M0 S2); BKL-008 |
| D-30 | DEC (M0 S2); BKL-013 |
| D-31 | SAV-015 (V2-M4), SAV-016 (V2-M4), SAV-017 (V2-M4), PLY-014 (V2-M4), PLY-016 (V2-M4), MRK-001 (V2-M4), MRK-012 (V2-M4), DEC (M0 S2) |
| D-32 | EDN-008 (V2-M3), EDN-011 (V2-M3) |
| #24 | dropped (no requirement) |
| #42 | NFR-019 (V2-M1), STO-007 (V2-M19) |
| #48 | NFR-019 (V2-M1) |
| #49 | PIP-015 (V2-M1) |
| #50 | MRK-036 (V2-M10) |
| #51 | merged into R-58a…e (see those rows) |
| #55 | BKL-025 (V3) |
| #56 | ANN-018 (V2-M11) |
| #57 | PLT-004, PLT-016 (V1, unchanged) |
| #59 | MRK-036 (V2-M10) |
| BKL-008 | V3 (limitations.md) |
| BKL-013 | V3 (limitations.md) |
| BKL-023 | dropped (limitations.md); see D-27 |
| Owner decision (V2-M0 S2) | MRK-044 (V2-M10), MRK-045 (V2-M10), MRK-046 (V2-M10), MRK-047 (V2-M10), MRK-048 (V2-M10), MRK-049 (V2-M10), MRK-050 (V2-M10) |
| Owner decision (V2-M2b, 2026-11-22) | NFR-026 (V2-M2b), NFR-027 (V2-M2b), TST-022 (V2-M2b) |
| Owner decision (V2-M3b, 2026-11-24) | TST-023 (V2-M3b), TST-024 (V2-M3b), TST-025 (V2-M3b), TST-026 (V2-M3b), TST-027 (V2-M3b); TST-015 becomes `changed` when V2-M3b is done |
| Owner decision (V2-M6 preparation, 2026-11-27) | UIX-035 (V2-M6), UIX-036 (V2-M6) |
| Owner decision (V2-M6 S1, 2026-11-27) | UIX-037 (V2-M6), UIX-038 (V2-M6) |
| Owner decision (V2-M6 S2, 2026-11-27) | FIL-049 (V2-M6), FIL-050 (V2-M6) |
| Owner decision (V2-M6 S3, 2026-11-27) | EDN-017 (V2-M6) |
| Owner decision (V2-M6 S4, 2026-11-27) | PLY-017 (V2-M6), FIL-051 (V2-M6), FIL-052 (V2-M6) |
