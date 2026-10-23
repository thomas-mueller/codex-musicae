# Contracts and fixtures

Verified inputs for milestones M4, M5 and M6. Everything here compiles under `strict` TypeScript and every fixture value was checked against the independent reference implementation in `docs/reference/core-reference.mjs`.

## Layout (mirrors the target layout)

| Here | Goes to (M4) |
|---|---|
| `contracts/core/*.ts` | `src/app/core/` (stubs that throw `not implemented`) |
| `contracts/core/fixtures/*.cases.ts` | `src/app/core/fixtures/` |
| `contracts/ports/*.ts` | `src/app/ports/` |

## Rules

- Signatures and the doc comments above them are the contract. The comments contain the algorithms; implement exactly them.
- Fixtures: `id` is unique per file; `req` names the requirement(s). Test names are `` `${req} ${id}: ${name}` ``.
- Compare floating-point numbers with `toBeCloseTo(expected, 9)`, everything else exactly (`toEqual`).
- Do not change an expected value or a signature to make code pass. If you believe a fixture is wrong, write it to `docs/questions.md` with your own derivation and stop.
- `ports/pdf-writer.ts` is provisional (M15 may refine it); the other ports are fixed until the milestone that first implements them says otherwise.

## Which milestone copies which contract

M4 copies and tests the first set (`geometry`, `model`, `detection`, `junctions`, `aspect-ratio`, `playing-order`, `slides`, all `ports/`). `junctions.ts` and `slides.ts` are copied complete, so `junctionLabel` (M11) and `findEntryForSystem` (M12) exist as stubs from M4 on and are specified and implemented later. Every later milestone copies the files it needs from here **at its start**, writes the table-driven spec from the fixtures first (red, only `not implemented` failures), then implements until green. No strong model is needed for these: the specs are mechanical.

| Milestone | Contracts and fixtures to copy and implement |
|---|---|
| M7 | `layout.ts` + `layout.cases.ts` |
| M8 | `lru-cache.ts`, `scheduler.ts` (+ cases) |
| M9 | `view.ts` incl. `tilesCovering` (+ `view.cases.ts`) |
| M10 | `detection-queue.ts` (+ cases) |
| M11 | `edits.ts`, `junctionLabel` in `junctions.ts` (+ `edits.cases.ts`, `junction-labels.cases.ts`) |
| M12 | `composition.ts`, `findEntryForSystem` in `slides.ts` (+ `composition.cases.ts`, `entry-lookup.cases.ts`) |
| M13 | `gestures.ts` (+ `gestures.cases.ts`) |
| M14 | `annotation.ts` (+ `annotation.cases.ts`; needs `composition.cases.ts` for the composition inputs named there) |
| M15 | `metadata.ts`, `autosave.ts` (+ `metadata.cases.ts`, `autosave.cases.ts`) |
| M16 | `session.ts` (+ `session.cases.ts`) |
| M19 | `palm.ts` (+ `palm.cases.ts`); the stylus rows PP09–PP16 of `gestures.cases.ts` are already covered by M13 |

Never overwrite a file in `src/` that already contains implementations; when a milestone needs a function whose stub already exists (`junctionLabel`, `findEntryForSystem`), only copy its fixtures and implement the stub. Each milestone adds the exports of the files it copied to `src/app/core/index.ts`.

Reference implementations: `docs/reference/core-reference.mjs` (first set), `core-reference-2.mjs` (second), `core-reference-3.mjs` (third: annotation, metadata, autosave, session, palm).
