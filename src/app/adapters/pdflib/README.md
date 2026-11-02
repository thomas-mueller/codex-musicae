# pdf-lib adapters

`PdfLibWriter` implements the `PdfWriter` port (M15). It is a thin Comlink proxy; the work runs in `adapters/workers/pdf-writer.worker.ts` through `createPdfWriterApi()`.

- `ink-list.ts`, `ink-annotation.ts`, `remove-ink.ts`: read, write and erase `/Ink` annotations (SAV-006, ANN-005).
- `name-tree.ts`, `embedded-json.ts`: the metadata attachment in the catalog `/Names /EmbeddedFiles` tree (SAV-001, SAV-010).
- `apply-edits.ts`: remove ink, add ink, replace the attachment, save without object streams; everything else is preserved (SAV-013).
- `write-error.ts` has no pdf-lib import so the main bundle does not pull pdf-lib in.
