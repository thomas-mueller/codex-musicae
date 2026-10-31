# Open questions

## V1-M4 S4 — independent re-derivation of the fixtures

Method: for the cases below the expected value was derived by hand from the doc comment of the contract only, then compared with the fixture. Nothing was run; no fixture or contract was edited.

| Group | Cases | Result |
|---|---|---|
| playing order | O03, O04, O06, O11, O17 | all match (entries and `between`; O06: last arrival of stop 3 has entriesSoFar 9, so 9 entries and 8 `between` elements are kept) |
| slides | SP02, SP03, SP05, SP06, SP10 | all match (SP05/SP06: the adjacent merge goes into the LAST region and is rejected as a whole when the stack exceeds H; SP10: H = 940 / 1.119047619047619 = 840 within 1e-9) |
| detection | D06, D07, D09, D11, D13 | all match (D06 threshold 94500, rescued by step 4; D07 threshold 45600, title block removed by step 3; D09 threshold 790000; D11 threshold 69350; D13 equal areas give threshold 0) |
| junctions | J1, J2 | all match (bars, heights and the doubled junction on a page change) |

**Result: no findings.**

Non-blocking remarks (no action needed to proceed):

- `rectAreaCases`, `rectUnionCases`, `bitmapRectToDisplayCases` and `medianCases`-like groups partly lack a `req` field; the specs use the requirement IDs from the fixture file header (DET-009) as fallback.
- SP10 relies on the 1e-9 tolerance in `packSlides` because `H` is only approximately 840 in floating point; an implementation must use `stack <= H + 1e-9` exactly as documented.

## V1-M7 S2 — icon `file_download` missing from `@material-symbols/svg-400` (resolved)

`TUNABLES.icons.saveCopy` stays `'file_download'`; the package ships that glyph as `download`. Resolved by the owner: `scripts/build-icons.mjs` carries an alias (`file_download` -> `download`), the sprite symbol keeps the tunables name.

## V1-M7 S2 — `app.spec.ts` "I18-001 placeholder has no visible text" vs. the indicator placeholder

The existing test requires `main` to have empty `textContent`. The M7 table requires a "– / –" indicator in the bottom bar. To leave the test untouched, the placeholder is drawn with a CSS `::before` (`content: var(--cm-indicator-placeholder)`, value `T:layout.indicatorPlaceholder`), so it is not text content. Suggestion: the test is a pre-M7 placeholder check; the owner may relax it (e.g. assert no letters) and then render the indicator as ordinary text.
