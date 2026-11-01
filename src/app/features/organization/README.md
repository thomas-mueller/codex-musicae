# Organization feature

Organization mode: the whole PDF as a continuous vertical-scroll viewer on which the user marks jumps, slide breaks and stops. Requirements: ORG-001…ORG-024, DET-014…DET-016 (see `docs/requirements.md`).

| Part | What it does |
|---|---|
| `organization-viewer.ts` | The viewer: page boxes, tiles, one overlay per page, selection, picking of jump targets, chip and pass stepper placement, Escape handling. |
| `page-tiles.ts` | Rendered tiles of a page. |
| `bars-layer.ts` / `bar-rows.ts` | Translucent bars over the gaps between systems (ORG-008/010), tap to select a junction (ORG-013); the bar row shows the slide-break line with scissors and the stop icon (ORG-011, ORG-022, ORG-023). **No numbers on the bars.** |
| `system-labels.ts` | The playing-order numbers ("3, 9") at the height of each music system, horizontally centered on the page, digits 80 % of the system height in a light weight, bar color and transparency (ORG-012). |
| `jump-markers.ts` | Jump start (right of the source system, jump icon rotated 180°) and jump end (left of the system after the target, merge icon), both labelled "<previous> → <next> ×<pass>" with playing-order numbers; fallback to the bar at junction 0 / N (ORG-018). Tap selects the jump, long press scrolls to the other end (ORG-019, ORG-020). |
| `mark-labels.ts` | The label texts of jumps, slide breaks and stops (`<previous> → <next> ×<pass>`, `<previous> \| <next>`, `<previous>`). |
| `long-press.directive.ts` | `appLongPress`, used by the markers. |
| `selection-chip.ts` / `chip-placement.ts` | The floating chip of a selected junction (jump, break, stop, delete) or jump (pass, change target, delete) and its placement inside the viewport (ORG-014, ORG-020). |
| `pass-stepper.ts` / `jump-pass.ts` | The pass stepper (ORG-016) and the default pass of a new jump (existing jumps from the same origin + 1). |
| `mark-list.ts` | The marks list: jumps, slide breaks and stops in playing order (`markPositions`), unreached items last and dimmed; tap navigates and selects, trash or swipe-left deletes (ORG-021). In expanded layouts `ToolArea` shows it in a panel beside its button; compact layouts use the sheet of `PopupHost`. |

Related code elsewhere: `state/ui.store.ts` (selection, picking, pending level), `state/org-view.store.ts` (layout, `scrollToJunction`), `state/document.store.ts` (marks, playing order, candidate run), `state/detection.service.ts` (`redetect`), `features/shell/level-confirm.ts` (level confirmation dialog, DET-014).

Numbers shown: everything uses playing-order numbers (PLY-010, `core/mark-positions`); numbers in the original PDF order are never shown (DEC-097, DEC-102). All sizes, colors, icons and separators live in `src/config/tunables.ts`.
