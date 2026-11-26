/**
 * core/metadata-v2 — the JSON embedded in the PDF in schema 2 (marks on systems): writer, reader, V1 migration.
 * Requirements: SAV-002, SAV-003, SAV-005, SAV-015, SAV-016, SAV-017.
 *
 * Temporary file of V2-M4: the app keeps writing schema 1 through `core/metadata` until S3, which switches `state/`, moves
 * this content into `core/metadata` and removes the schema 1 writer (DEC-155). The V1 reader stays.
 */
import { EMPTY_SYSTEM_MARKS, isCrossFile } from './marks';
import type { BookmarkMark, FileRef, JumpMark, PointMark, SystemMarks, SystemRef } from './marks';
import {
  aspectRatioJson, bad, detectionJson, good, invalid, isInt, isRecord, parseAspectRatio, parseDetection,
  parseMetadata as parseSchema1,
} from './metadata';
import type {
  EmbeddedMetadata as EmbeddedMetadataV1, Parsed, ParseResult as Schema1Result, Raw,
} from './metadata';
import { migrateMarksV1 } from './migrate-v1';
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
export function serializeMetadata(m: EmbeddedMetadata): string {
  return JSON.stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: m.appVersion,
    pageCount: m.pageCount,
    detection: detectionJson(m.detection),
    marks: marksJson(m.marks),
    aspectRatio: aspectRatioJson(m.aspectRatio),
  });
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
export function parseMetadata(text: string, maxLength: number): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return invalid('json');
  }
  if (!isRecord(raw)) {
    return invalid('root');
  }
  const version = raw['schemaVersion'];
  if (!isInt(version) || version < 1) {
    return invalid('schemaVersion');
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return { kind: 'newer', version };
  }
  return version === CURRENT_SCHEMA_VERSION ? validate(raw) : upgradeSchema1(parseSchema1(text), maxLength);
}

/** SAV-005, as in schema 1: `m` if m.pageCount === actualPageCount and a present detection lists every page, else null. */
export function reconcileMetadata(m: EmbeddedMetadata, actualPageCount: number): EmbeddedMetadata | null {
  const complete = m.detection === null || m.detection.pages.length === m.pageCount;
  return m.pageCount === actualPageCount && complete ? m : null;
}

// ---------------------------------------------------------------- writing

function refJson(ref: SystemRef | FileRef): SystemRef | FileRef {
  const { pageIndex, system } = ref;
  return isCrossFile(ref) ? { file: ref.file, pageIndex, system } : { pageIndex, system };
}

function textJson(text: string | undefined): { readonly text?: string } {
  return text === undefined ? {} : { text };
}

function pointJson({ at, text }: PointMark): PointMark {
  return { at: refJson(at), ...textJson(text) };
}

function marksJson(marks: SystemMarks): SystemMarks {
  return {
    jumps: marks.jumps.map(({ id, from, to, pass, text }) => ({ id, from: refJson(from), to: refJson(to), pass, ...textJson(text) })),
    bookmarks: marks.bookmarks.map(({ id, at, ref, text }) => ({
      id,
      at: refJson(at),
      ...(ref === undefined ? {} : { ref: refJson(ref) as FileRef }),
      ...textJson(text),
    })),
    stops: marks.stops.map(pointJson),
    breaks: marks.breaks.map(pointJson),
    start: marks.start === null ? null : pointJson(marks.start),
    nextJumpId: marks.nextJumpId,
    nextBookmarkId: marks.nextBookmarkId,
  };
}

// ---------------------------------------------------------------- reading schema 1

function upgradeSchema1(parsed: Schema1Result, maxLength: number): ParseResult {
  if (parsed.kind !== 'ok') {
    return parsed;
  }
  const { marks: old, detection, pageCount } = parsed.value;
  const hasMarks = old.jumps.length + old.breaks.length + old.stops.length > 0;
  let marks: SystemMarks = EMPTY_SYSTEM_MARKS;
  let pendingV1Marks: V1Marks | null = null;
  if (detection === null) {
    if (hasMarks) {
      pendingV1Marks = old;
    } else {
      marks = { ...EMPTY_SYSTEM_MARKS, nextJumpId: old.nextJumpId };
    }
  } else if (detection.pages.length === pageCount) {
    // The length check also bounds the array below by the size of the text.
    const counts = new Array<number>(pageCount).fill(0);
    for (const page of detection.pages) {
      counts[page.pageIndex] = page.systems.length;
    }
    marks = migrateMarksV1(old, counts, maxLength);
  }
  return { kind: 'ok', value: { ...parsed.value, schemaVersion: CURRENT_SCHEMA_VERSION, marks }, pendingV1Marks };
}

// ---------------------------------------------------------------- reading schema 2

function isPositiveInt(v: unknown): v is number {
  return isInt(v) && v >= 1;
}

/** `pageLimit` bounds the page index of a system of this file; another file is not bounded. */
function parseSystem(v: unknown, path: string, pageLimit: number): Parsed<SystemRef> {
  if (!isRecord(v)) {
    return bad(path);
  }
  const { pageIndex, system } = v;
  if (!isInt(pageIndex) || pageIndex < 0 || pageIndex >= pageLimit) {
    return bad(`${path}.pageIndex`);
  }
  return isPositiveInt(system) ? good({ pageIndex, system }) : bad(`${path}.system`);
}

function parseFileRef(v: unknown, path: string): Parsed<FileRef> {
  if (!isRecord(v)) {
    return bad(path);
  }
  const file = v['file'];
  if (typeof file !== 'string' || file === '') {
    return bad(`${path}.file`);
  }
  const system = parseSystem(v, path, Number.POSITIVE_INFINITY);
  return system.ok ? good({ file, ...system.value }) : bad(system.path);
}

function parseText(v: Raw, path: string): Parsed<{ readonly text?: string }> {
  const text = v['text'];
  if (text === undefined) {
    return good({});
  }
  return typeof text === 'string' && text !== '' ? good({ text }) : bad(`${path}.text`);
}

/** An id no earlier mark of the same kind uses. */
function parseId(v: unknown, path: string, used: Set<number>): Parsed<number> {
  if (!isPositiveInt(v) || used.has(v)) {
    return bad(`${path}.id`);
  }
  used.add(v);
  return good(v);
}

function parseJumpMark(v: unknown, path: string, pageCount: number, used: Set<number>): Parsed<JumpMark> {
  if (!isRecord(v)) {
    return bad(path);
  }
  const id = parseId(v['id'], path, used);
  if (!id.ok) {
    return bad(id.path);
  }
  const from = parseSystem(v['from'], `${path}.from`, pageCount);
  if (!from.ok) {
    return bad(from.path);
  }
  const target = v['to'];
  const to = isRecord(target) && 'file' in target ? parseFileRef(target, `${path}.to`) : parseSystem(target, `${path}.to`, pageCount);
  if (!to.ok) {
    return bad(to.path);
  }
  const pass = v['pass'];
  if (!isPositiveInt(pass)) {
    return bad(`${path}.pass`);
  }
  const text = parseText(v, path);
  return text.ok ? good({ id: id.value, from: from.value, to: to.value, pass, ...text.value }) : bad(text.path);
}

function parseBookmark(v: unknown, path: string, pageCount: number, used: Set<number>): Parsed<BookmarkMark> {
  if (!isRecord(v)) {
    return bad(path);
  }
  const id = parseId(v['id'], path, used);
  if (!id.ok) {
    return bad(id.path);
  }
  const at = parseSystem(v['at'], `${path}.at`, pageCount);
  if (!at.ok) {
    return bad(at.path);
  }
  let ref: { readonly ref?: FileRef } = {};
  if (v['ref'] !== undefined) {
    const parsed = parseFileRef(v['ref'], `${path}.ref`);
    if (!parsed.ok) {
      return bad(parsed.path);
    }
    ref = { ref: parsed.value };
  }
  const text = parseText(v, path);
  return text.ok ? good({ id: id.value, at: at.value, ...ref, ...text.value }) : bad(text.path);
}

function parsePoint(v: unknown, path: string, pageCount: number): Parsed<PointMark> {
  if (!isRecord(v)) {
    return bad(path);
  }
  const at = parseSystem(v['at'], `${path}.at`, pageCount);
  if (!at.ok) {
    return bad(at.path);
  }
  const text = parseText(v, path);
  return text.ok ? good({ at: at.value, ...text.value }) : bad(text.path);
}

function parseList<T>(v: unknown, path: string, parseItem: (item: unknown, itemPath: string) => Parsed<T>): Parsed<T[]> {
  if (!Array.isArray(v)) {
    return bad(path);
  }
  const items: T[] = [];
  for (let i = 0; i < v.length; i++) {
    const item = parseItem(v[i], `${path}[${i}]`);
    if (!item.ok) {
      return bad(item.path);
    }
    items.push(item.value);
  }
  return good(items);
}

/** Point marks strictly in print order, so one per system. */
function parsePointList(v: unknown, path: string, pageCount: number): Parsed<PointMark[]> {
  const list = parseList(v, path, (item, itemPath) => parsePoint(item, itemPath, pageCount));
  if (!list.ok) {
    return list;
  }
  const ordered = list.value.every(({ at }, i) => {
    const before = list.value[i - 1]?.at;
    return before === undefined || before.pageIndex < at.pageIndex || (before.pageIndex === at.pageIndex && before.system < at.system);
  });
  return ordered ? list : bad(path);
}

function isNextId(next: unknown, marks: readonly { readonly id: number }[]): next is number {
  return isPositiveInt(next) && marks.every((mark) => mark.id < next);
}

function parseMarks(v: unknown, pageCount: number): Parsed<SystemMarks> {
  if (!isRecord(v)) {
    return bad('marks');
  }
  const jumpIds = new Set<number>();
  const jumps = parseList(v['jumps'], 'marks.jumps', (item, path) => parseJumpMark(item, path, pageCount, jumpIds));
  if (!jumps.ok) {
    return bad(jumps.path);
  }
  const bookmarkIds = new Set<number>();
  const bookmarks = parseList(v['bookmarks'], 'marks.bookmarks', (item, path) => parseBookmark(item, path, pageCount, bookmarkIds));
  if (!bookmarks.ok) {
    return bad(bookmarks.path);
  }
  const stops = parsePointList(v['stops'], 'marks.stops', pageCount);
  if (!stops.ok) {
    return bad(stops.path);
  }
  const breaks = parsePointList(v['breaks'], 'marks.breaks', pageCount);
  if (!breaks.ok) {
    return bad(breaks.path);
  }
  let start: PointMark | null = null;
  if (v['start'] !== null) {
    const parsed = parsePoint(v['start'], 'marks.start', pageCount);
    if (!parsed.ok) {
      return bad(parsed.path);
    }
    start = parsed.value;
  }
  const { nextJumpId, nextBookmarkId } = v;
  if (!isNextId(nextJumpId, jumps.value)) {
    return bad('marks.nextJumpId');
  }
  if (!isNextId(nextBookmarkId, bookmarks.value)) {
    return bad('marks.nextBookmarkId');
  }
  return good({
    jumps: jumps.value, bookmarks: bookmarks.value, stops: stops.value, breaks: breaks.value, start, nextJumpId, nextBookmarkId,
  });
}

function validate(raw: Raw): ParseResult {
  const { appVersion, pageCount } = raw;
  if (typeof appVersion !== 'string') {
    return invalid('appVersion');
  }
  if (!isInt(pageCount) || pageCount < 0) {
    return invalid('pageCount');
  }
  const detection = parseDetection(raw['detection'], pageCount);
  if (!detection.ok) {
    return invalid(detection.path);
  }
  const marks = parseMarks(raw['marks'], pageCount);
  if (!marks.ok) {
    return invalid(marks.path);
  }
  const aspectRatio = parseAspectRatio(raw['aspectRatio']);
  if (!aspectRatio.ok) {
    return invalid(aspectRatio.path);
  }
  return {
    kind: 'ok',
    value: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appVersion,
      pageCount,
      detection: detection.value,
      marks: marks.value,
      aspectRatio: aspectRatio.value,
    },
    pendingV1Marks: null,
  };
}

