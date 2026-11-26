/**
 * core/metadata-v2 — the JSON embedded in the PDF in schema 2 (marks on systems): writer, reader, V1 migration.
 * Requirements: SAV-002, SAV-003, SAV-005, SAV-015, SAV-016, SAV-017.
 *
 * Temporary file of V2-M4: the app keeps writing schema 1 through `core/metadata` until S3, which switches `state/`, moves
 * this content into `core/metadata` and removes the schema 1 writer (DEC-155). The V1 reader stays.
 */
import type { SystemMarks } from './marks';
import type { EmbeddedMetadata as EmbeddedMetadataV1 } from './metadata';
import type { V1Marks } from './migrate-v1';

export const CURRENT_SCHEMA_VERSION = 2;

export interface EmbeddedMetadata {
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly pageCount: number;
  /** As in schema 1. */
  readonly detection: EmbeddedMetadataV1['detection'];
  readonly marks: SystemMarks;
  /** As in schema 1. */
  readonly aspectRatio: EmbeddedMetadataV1['aspectRatio'];
}

export type ParseResult =
  | {
      readonly kind: 'ok';
      readonly value: EmbeddedMetadata;
      /**
       * Schema 1 marks that cannot be migrated yet because the file holds no detection result (DEC-154); else null. While it
       * is not null, `value.marks` is empty and the caller must not write `value` over the data in the file (DEC-155); it
       * migrates these marks with `migrateMarksV1` when detection has finished.
       */
      readonly pendingV1Marks: V1Marks | null;
    }
  | { readonly kind: 'newer'; readonly version: number }
  | { readonly kind: 'invalid'; readonly reason: string };

/**
 * Stable JSON text without whitespace. `schemaVersion` is ALWAYS written as CURRENT_SCHEMA_VERSION, whatever `m` says
 * (SAV-017). Key order: schemaVersion, appVersion, pageCount, detection, marks, aspectRatio; `detection` and `aspectRatio` as
 * in schema 1 (rectangles as arrays, 2 decimals). marks: jumps {id, from, to, pass, text}, bookmarks {id, at, ref, text},
 * stops {at, text}, breaks {at, text}, start (null or {at, text}), nextJumpId, nextBookmarkId. A system of this file is
 * {pageIndex, system}; a cross-file reference is {file, pageIndex, system}. Absent `text` and `ref` keys are omitted.
 */
export function serializeMetadata(_m: EmbeddedMetadata): string {
  throw new Error('not implemented');
}

/**
 * Not JSON -> invalid 'json'; not a plain object -> 'root'; `schemaVersion` missing or not a positive integer ->
 * 'schemaVersion'. A version above CURRENT_SCHEMA_VERSION -> newer (the caller must not overwrite it, SAV-003).
 *
 * Version 1 (SAV-003, SAV-016): validated by the schema 1 `parseMetadata` (same reasons), then upgraded; the value has
 * schemaVersion 2.
 *  - detection present and its page list as long as pageCount: marks = migrateMarksV1(v1 marks, counts, maxLength), where
 *    counts[i] is the number of systems of the page with pageIndex i (0 without an entry);
 *  - detection present with another page list length: empty marks (`reconcileMetadata` discards such data);
 *  - detection null with at least one jump, break or stop: empty marks (EMPTY_SYSTEM_MARKS), pendingV1Marks = the V1 marks;
 *  - detection null without any: empty marks that keep the V1 nextJumpId.
 *  pendingV1Marks is null in every other case. `maxLength` is the playing-order cap used by the migration.
 *
 * Version 2: every field is validated; any violation -> invalid, reason = JSON path of the FIRST violation. Order: appVersion,
 * pageCount, detection (as schema 1), marks (jumps, bookmarks, stops, breaks, start, nextJumpId, nextBookmarkId), aspectRatio.
 * A section that is missing or of the wrong type gives its own path ('marks', 'marks.jumps', 'marks.start').
 *  - A system of this file: integer pageIndex in 0..pageCount-1 ('….pageIndex') and integer system >= 1 ('….system'). It is
 *    NOT compared with the system counts: marks without effect are legal.
 *  - A cross-file reference: non-empty string file, integer pageIndex >= 0, integer system >= 1. A jump target (`to`) is
 *    cross-file when it has the key `file`; a bookmark `ref`, when present, is always cross-file.
 *  - jump, in this order: id (integer >= 1, not used by an earlier jump), from, to, pass (integer >= 1), text.
 *  - bookmark: id (as for jumps, among bookmarks), at, ref, text. Point marks: at, text.
 *  - text, when present, is a non-empty string.
 *  - stops and breaks are strictly in print order, one per system: else the path of the list.
 *  - start is null or one point mark.
 *  - nextJumpId / nextBookmarkId: integers >= 1, greater than every id of their kind.
 *  - A jump whose two ends became the same junction (after a deletion) is valid.
 * Unknown keys are ignored. Absent `text` and `ref` give objects without these keys. Rectangles become `Rect` objects.
 */
export function parseMetadata(_text: string, _maxLength: number): ParseResult {
  throw new Error('not implemented');
}

/** SAV-005, as in schema 1: `m` if m.pageCount === actualPageCount and a present detection lists every page, else null. */
export function reconcileMetadata(_m: EmbeddedMetadata, _actualPageCount: number): EmbeddedMetadata | null {
  throw new Error('not implemented');
}
