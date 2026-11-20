# Document review — V2-M0 S2 (read-only)

**Date:** 2026-11-20. **Scope:** commit `58b9598` (S2) and the files it touches or depends on: `docs/decisions.md` (DEC-128…136), `docs/architecture.md` ("Version 2", port catalogue, matrix), `docs/requirements.md` (MRK-044…046, ORG-020), `docs/changelog.md`, `docs/roadmap-v2.md`, `docs/roadmap.md`, `docs/README.md`, `docs/questions.md`, `docs/milestones/V2-M03/M06/M10/M13/M15`. Checks as in `V1-M0c`. No file except this report was changed.

**Mechanical result:** `npm run lint` passes (traceability: 502 requirements, 209 with tests, 18 exceptions; agent-copy check ok).

## Checked and found consistent

- DEC-128…136 are unique and continue after DEC-127. Every D-n of the V2 requirements either has a requirement (changelog map) or a DEC; D-17 has the announced entry in V2-M11 step 4.
- The marks data model in `architecture.md` matches MRK-001…MRK-008 (sides, one stop per system, none on the last system, one start mark). The junction derivation (right side of system k → junction k, left side → junction k−1) is consistent with the V1 numbering ("junction 0" before system 1).
- The cross-file reference (MRK-012, FIL-041…FIL-044, MRK-015, MRK-016, LIM-032) matches the architecture text.
- "Break hints" no longer appears anywhere; R-60a-e, SLD-028 and V2-M13 agree.
- Tag scheme DEC-131 equals `roadmap-v2.md`, V2-M00 S3 and PIP-018; milestone tags in `roadmap-v2.md` follow `v1.<n>.0`.
- `docs/roadmap-v2.md` and `docs/README.md` match the S2 result; the new MRK IDs are in `requirements.md`, `traceability.md`, the M10 ID list and the changelog map.

## Findings

| # | Sev. | Where | Finding | Proposed fix |
|---|---|---|---|---|
| 1 | High | EDN-009 vs EDN-013; M03 S1.1 vs S1.4; `architecture.md` "Edition configuration" | **Contradiction.** EDN-009 and M03 S1.1 (`webOrganizational`, R-22l) allow switches that exist only in the web file. EDN-013 and M03 S1.4 fail the build when a key is missing in *any* configuration file; the architecture repeats EDN-013 without exception. As written, the web-only key fails the native build. | Word the rule: every shared key exists in both files; keys marked web-only exist only in `features.web.ts` and may not appear in the native file. Or put `webOrganizational` in both files, `false` in native. Align EDN-013, M03 S1.4 and the architecture sentence. |
| 2 | High | EDN-006/007/012; M03 S1.2; `architecture.md` | **Undefined mechanism for `native-paid`.** Two files exist, three build configurations. M03 says "the paid native file enables all", the architecture says `native-paid` "switches every feature on". Neither names a third file, nor says how the build produces it, while EDN-007 says each build bundles only its own file and EDN-012 tests "the paid configuration". | Decide: (a) a third file `features.native-paid.ts` (then EDN-006 "two files" becomes three, and a missing key check covers three) or (b) the native file is generated/overridden at build time. Record in DEC-130 and the architecture. |
| 3 | Medium | `architecture.md` "Persistence is switched by choosing…" vs M03 S2.3 and S3.1 | **Three different descriptions of the persistence switch.** Architecture: composition root chooses persistence-off *implementations* of `Preferences` and of the file-reference storage. M03 S2.3: a *wrapper* selected by the switches. M03 S3.1: web adapters "not constructed". The switches are per feature (`persistSettings`, `recentFiles`, `sessionRestore`, `persistFileChoices`, `restoreZoom`), which swapping a whole port cannot express. File-reference storage is also not a separate port (it is part of `FileAccess`). | One description: a switch-aware wrapper around `Preferences` and the persisted part of `FileAccess`, constructed by the composition root; per-feature keys decide what it blocks. Update architecture and M03 to the same wording. |
| 4 | Medium | DEC-132 | **Unverifiable claim and licence detail.** "Release 1.482 (latest release on 2026-11-20)" cannot be confirmed from the repository or offline; the latest Bravura release this reviewer knows is lower. OFL 1.1 forbids using a reserved font name for a *modified* font; V2-M12 converts glyphs to SVG paths or ships a subset, which is a modification. | Owner confirms the release number on the Bravura GitHub page before DEC-132 is relied on (or write "latest release at V2-M12; pinned there"). Add to V2-M12 S1: check the font's reserved name and rename or omit the font name in a subset; keep the OFL text in `THIRD_PARTY_NOTICES.txt`. |
| 5 | Medium | `roadmap.md` line 9; DEC-060 | **Stale text.** `roadmap.md` still recommends `v2.0.0-m.<n>` and "small additions `v1.1.0`", which collides with DEC-131 (`v1.1.0` = V2-M1). DEC-060 says "See `roadmap.md`" for V2 tags and is marked superseded, but the pointed-to text is not. | Annotate `roadmap.md` line 9 "Superseded for V2 by DEC-131 / `roadmap-v2.md`"; change DEC-060's pointer to `roadmap-v2.md`. |
| 6 | Medium | ORG-019 → MRK-032; `questions.md` item 4 | **Lost behavior.** V1: a long press on a jump marker scrolls to the other end of the jump (ORG-019). V2 gives the long press to user-text editing (MRK-032) and ORG-019 is repointed to it. Item 4 named this gap ("jump to the other end"); the owner decision (MRK-044/045) covers pass, target and delete only. | Owner decides: drop the function (record in changelog and V2 limitations) or add a requirement (e.g. a selected jump also offers "go to other end"). Until then ORG-019's pointer is misleading. |
| 7 | Medium | V2-M10 "Tests" / steps | The new MRK-044…046 have no named test (selection with no tool active, offered actions per mark kind, start-mark-first and bookmark ordering), and the file does not name the V1 chip tests it may edit (rule "Rules that hold in every V2 milestone"). | Add the unit/E2E lines and the list of V1 chip tests (ORG-020 area) that M10 may change. |
| 8 | Low | MRK-045, MRK-046 | **Not atomic.** MRK-045 states two facts (jump actions; actions of other kinds). MRK-046 states three placement rules. | Split: MRK-045 → jump actions / delete for other kinds; MRK-046 → start first / reached bookmarks / unreached bookmarks. New IDs, no renumbering. |
| 9 | Low | ORG-020, changelog row | ORG-020 ("chip offers pass, change target and delete") is repointed to MRK-044 only; the offered actions are MRK-045. Same for ORG-021 → MRK-040 only (MRK-046 extends it). | List both IDs in each pointer and in the changelog map. |
| 10 | Low | `architecture.md` import rule | The new rule (`config/features.*.ts` imported only by the composition root) is labelled lint-enforced, but no M03 step adds the ESLint rule or its self-test (`npm run lint:selftest`); S1.4 covers missing keys only. | Add the rule and a self-test case to M03 S1. |
| 11 | Low | M03 (`PreferencesPort`), M15 (`SendFilePort`) vs architecture (`Preferences`, `SendFile`) | Port names differ. V1 code uses `Preferences` / `PREFERENCES`, `FileAccess` / `FILE_ACCESS`. | Use the architecture names in M03 and M15 (`SendFile`, token `SEND_FILE`). |
| 12 | Low | `architecture.md` `SendFile` row vs M15 S1 | Architecture: "the web adapter is never selected". M15 creates a web adapter that is never selected. Dead code for a never-used adapter conflicts with the "no leftovers" rule (R-14b). | State why the adapter exists (token must resolve in every build) or provide the disabled behavior from the `sendTo` switch alone. |
| 13 | Low | `changelog.md` row 2026-11-20 ("263 new v2 IDs") | History row is correct for S1 but the total is now 266 (MRK-044…046). | Add "+3 in S2" to the S2 row. |
| 14 | Info | V2-M00 S3, `roadmap-v2.md` ("Git section untouched") vs the owner's memory note | The owner asked for a line in the AGENTS.md Git section (no GitHub CLI or API) to be written in S3; S3 and `roadmap-v2.md` say the Git section stays untouched. | Update S3 item 2/3 and `roadmap-v2.md` with the owner's authorized wording before S3 runs. |
| 15 | Info | `docs/review-report.md` | README listed the file; it did not exist (V1-M0c's report is not in the repository). This file is the V2-M0 S2 report. | None; README line is correct now. |

## Resolution (2026-11-20)

| # | Result |
|---|---|
| 1 | Fixed: EDN-009 and EDN-013 distinguish shared and web-only switches; M03 S1.1/S1.4 and the architecture agree. |
| 2 | Fixed: two files kept (owner decision); `native-paid` bundles the native file and the composition root forces all switches on (EDN-006, M03 S1.2, architecture, DEC-130, changelog row). |
| 3 | Fixed: one description (switch-aware wrappers by the composition root) in architecture and M03 S2.3. |
| 4 | Fixed in text: DEC-132 no longer claims the release; V2-M12 S3.1 pins it and covers the OFL reserved-name rule. Owner confirmed 1.482 as the newest release; DEC-132 names it again. |
| 5 | Fixed: `roadmap.md` line 9 marked superseded; DEC-060 points to `roadmap-v2.md`. |
| 6 | Decided by the owner: long press goes to the other end (new MRK-050, ORG-019 → MRK-050); user text is edited on the selected mark (MRK-032 reworded). |
| 7 | Fixed: M10 tests lines and the list of V1 specs it may edit. |
| 8 | Fixed: MRK-045 split (MRK-047), MRK-046 split (MRK-048, MRK-049); map, M10 ID list and traceability updated. |
| 9 | Fixed: ORG-020 → MRK-044, MRK-045; ORG-021 → MRK-040, MRK-046, MRK-048, MRK-049. |
| 10 | Fixed: ESLint rule and self-test case added to M03 S1.5. |
| 11 | Fixed: M03 uses `Preferences`; M15 uses `SendFile` / `SEND_FILE`. |
| 12 | Fixed: no web adapter; optional injection (M15, architecture). |
| 13 | Fixed: changelog row states 269 `v2` IDs. |
| 14 | Fixed: owner accepted the wording; V2-M00 S3 and `roadmap-v2.md` now allow exactly one Git bullet. |
| 15 | n/a |

`npm run lint` passes (505 requirements).
