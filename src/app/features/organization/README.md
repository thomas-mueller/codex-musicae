# Organization feature

Organization mode: the whole PDF as a continuous vertical-scroll viewer on which the user marks jumps, slide breaks and stops. Requirements: ORG-001…ORG-024, DET-014…DET-016 (see `docs/requirements.md`).

| Part | What it does |
|---|---|
| `organization-viewer.ts` | The viewer: page boxes, tiles, one overlay per page, selection, picking of jump targets, chip and pass stepper placement, Escape handling. |
| `page-tiles.ts` | Rendered tiles of a page. |
| `bars-layer.ts` / `bar-rows.ts` | Translucent bars over the gaps between systems (ORG-008/010), tap to select a junction (ORG-013); the bar row shows the slide-break line with scissors and the stop icon (ORG-011, ORG-022, ORG-023). **No numbers on the bars.** |
| `system-labels.ts` | The playing-order numbers ("3, 9") centered on each music system, digits 80 % of the system height, bar color and transparency (ORG-012). |
| `jump-markers.ts` | Jump start (right of the source system, jump icon rotated 180°, target system number and pass) and jump end (left of the system after the target, merge icon, source system number); fallback to the bar at junction 0 / N (ORG-018). Tap selects the jump, long press scrolls to the other end (ORG-019, ORG-020). |
| `long-press.directive.ts` | `appLongPress`, used by the markers. |
| `selection-chip.ts` / `chip-placement.ts` | The floating chip of a selected junction (jump, break, stop, delete) or jump (pass, change target, delete) and its placement inside the viewport (ORG-014, ORG-020). |
| `pass-stepper.ts` / `jump-pass.ts` | The pass stepper (ORG-016) and the default pass of a new jump (existing jumps from the same origin + 1). |
| `mark-list.ts` | The marks list popup: jumps, slide breaks and stops in playing order, unreached items last; tap navigates and selects, trash or swipe-left deletes (ORG-021). `replayArrivals` is the list's own pass over the replay of `core/playing-order`. |

Related code elsewhere: `state/ui.store.ts` (selection, picking, pending level), `state/org-view.store.ts` (layout, `scrollToJunction`), `state/document.store.ts` (marks, playing order, candidate run), `state/detection.service.ts` (`redetect`), `features/shell/level-confirm.ts` (level confirmation dialog, DET-014).

Numbers shown: system labels use playing-order numbers (PLY-010), markers and the list use print numbers 1..N (DEC-090). All sizes, colors, icons and separators live in `src/config/tunables.ts`.
