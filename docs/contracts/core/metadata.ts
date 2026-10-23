/**
 * core/metadata — the JSON embedded in the PDF (schema v1), validation and migration.
 * Requirements: SAV-002, SAV-003, SAV-004, SAV-005, DET-023.
 * No third-party schema library: the validator is hand-written, pure and covered by fixtures.
 */
import type { Rect } from './geometry';

export const CURRENT_SCHEMA_VERSION = 1;

export type DetectionLevelId = 'fast' | 'standard' | 'fine';

export interface MetadataPage {
  readonly pageIndex: number;
  readonly width: number;
  readonly height: number;
  readonly state: 'done' | 'failed';
  /** Display space, sorted; empty for failed pages. */
  readonly systems: readonly Rect[];
}

export interface MetadataJump {
  readonly id: number;
  readonly origin: number;
  readonly target: number;
  readonly pass: number;
}

export interface EmbeddedMetadata {
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly pageCount: number;
  /** null when detection had not completed at save time (then detection runs again on the next open). */
  readonly detection: { readonly level: DetectionLevelId; readonly pages: readonly MetadataPage[] } | null;
  readonly marks: {
    readonly jumps: readonly MetadataJump[];
    readonly breaks: readonly number[];
    readonly stops: readonly number[];
    readonly nextJumpId: number;
  };
  /** Per-PDF aspect-ratio overrides (SLD-015). */
  readonly aspectRatio: { readonly portrait?: number; readonly landscape?: number };
}

/**
 * Stable JSON text. Key order exactly as in `EmbeddedMetadata` (and as in the fixtures); rectangles are written as
 * [x, y, width, height] arrays with every number rounded to 2 decimals; `undefined` optional fields are omitted;
 * no whitespace (JSON.stringify without indentation).
 */
export function serializeMetadata(_m: EmbeddedMetadata): string {
  throw new Error('not implemented');
}

export type ParseResult =
  | { readonly kind: 'ok'; readonly value: EmbeddedMetadata }
  | { readonly kind: 'newer'; readonly version: number }
  | { readonly kind: 'invalid'; readonly reason: string };

/**
 * Parses and validates text produced by serializeMetadata (or by an older version after migration).
 *  - not valid JSON, not an object, or `schemaVersion` missing / not a positive integer -> invalid
 *  - schemaVersion > CURRENT_SCHEMA_VERSION -> { kind: 'newer', version } (the caller must not overwrite it)
 *  - otherwise every field is validated: pageCount integer >= 0; detection null or { level in the 3 ids, pages: array of
 *    { pageIndex integer >= 0 and < pageCount, width > 0, height > 0, state 'done'|'failed', systems: array of 4-number arrays
 *    with width > 0 and height > 0 } }; marks.jumps entries with integer id >= 1, origin, target >= 0, pass >= 1;
 *    breaks and stops arrays of integers >= 1, ascending, unique; nextJumpId integer greater than every jump id;
 *    aspectRatio numbers within 0.5..2.0 when present. Any violation -> invalid with reason = the JSON path of the FIRST violation,
 *    e.g. 'marks.jumps[0].pass'. Checks run in the order of the interface declaration (schemaVersion, appVersion, pageCount,
 *    detection [level, then pages in order, each with pageIndex, width, height, state, systems], marks [jumps, breaks, stops, nextJumpId],
 *    aspectRatio [portrait, landscape]); inside a jump: id, origin, target, pass. Reasons for the first checks: not JSON -> 'json',
 *    not a plain object -> 'root', schemaVersion missing or not a positive integer -> 'schemaVersion'. A missing section -> its name.
 *    A rectangle that is not an array of 4 finite numbers or has width/height <= 0 -> the path of that rectangle ('detection.pages[0].systems[1]').
 *  - rectangles are converted back to `Rect` objects.
 * Migrations: a table `version -> function` upgrades older versions step by step (v1 has none); an unknown older version is invalid.
 */
export function parseMetadata(_text: string): ParseResult {
  throw new Error('not implemented');
}

/**
 * SAV-005: returns `m` unchanged if m.pageCount === actualPageCount, else null (discard and detect again).
 * Also null if m.detection is not null and its page list length !== pageCount.
 */
export function reconcileMetadata(_m: EmbeddedMetadata, _actualPageCount: number): EmbeddedMetadata | null {
  throw new Error('not implemented');
}
