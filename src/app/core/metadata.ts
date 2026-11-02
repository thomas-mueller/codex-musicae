/**
 * core/metadata — the JSON embedded in the PDF (schema v1), validation and migration.
 * Requirements: SAV-002, SAV-003, SAV-004, SAV-005, DET-023.
 * No third-party schema library: the validator is hand-written, pure and covered by fixtures.
 */
import type { Rect } from './geometry';

export const CURRENT_SCHEMA_VERSION = 1;

/** Numbers are written with this many decimals. */
const DECIMALS = 2;
const DECIMAL_BASE = 10;
const DECIMAL_FACTOR = DECIMAL_BASE ** DECIMALS;
const RATIO_MIN = 0.5;
const RATIO_MAX = 2.0;
const RECT_LENGTH = 4;
const DETECTION_LEVELS: readonly string[] = ['fast', 'standard', 'fine'];
const PAGE_STATES: readonly string[] = ['done', 'failed'];

function roundDecimals(v: number): number {
  return Math.round(v * DECIMAL_FACTOR) / DECIMAL_FACTOR;
}

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
export function serializeMetadata(m: EmbeddedMetadata): string {
  const aspectRatio: { portrait?: number; landscape?: number } = {};
  if (m.aspectRatio.portrait !== undefined) {
    aspectRatio.portrait = m.aspectRatio.portrait;
  }
  if (m.aspectRatio.landscape !== undefined) {
    aspectRatio.landscape = m.aspectRatio.landscape;
  }
  return JSON.stringify({
    schemaVersion: m.schemaVersion,
    appVersion: m.appVersion,
    pageCount: m.pageCount,
    detection:
      m.detection === null
        ? null
        : {
            level: m.detection.level,
            pages: m.detection.pages.map((p) => ({
              pageIndex: p.pageIndex,
              width: roundDecimals(p.width),
              height: roundDecimals(p.height),
              state: p.state,
              systems: p.systems.map((r) => [
                roundDecimals(r.x),
                roundDecimals(r.y),
                roundDecimals(r.width),
                roundDecimals(r.height),
              ]),
            })),
          },
    marks: {
      jumps: m.marks.jumps.map((j) => ({ id: j.id, origin: j.origin, target: j.target, pass: j.pass })),
      breaks: [...m.marks.breaks],
      stops: [...m.marks.stops],
      nextJumpId: m.marks.nextJumpId,
    },
    aspectRatio,
  });
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
export function parseMetadata(text: string): ParseResult {
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
  const upgraded = migrate(raw, version);
  return upgraded === null ? invalid('schemaVersion') : validate(upgraded);
}

/**
 * SAV-005: returns `m` unchanged if m.pageCount === actualPageCount, else null (discard and detect again).
 * Also null if m.detection is not null and its page list length !== pageCount.
 */
export function reconcileMetadata(m: EmbeddedMetadata, actualPageCount: number): EmbeddedMetadata | null {
  if (m.pageCount !== actualPageCount) {
    return null;
  }
  if (m.detection !== null && m.detection.pages.length !== m.pageCount) {
    return null;
  }
  return m;
}

type Raw = Record<string, unknown>;
type Invalid = { readonly kind: 'invalid'; readonly reason: string };

/** Upgrades older schema versions step by step; v1 is the first, so the table is empty. */
const MIGRATIONS: Readonly<Record<number, (raw: Raw) => Raw>> = {};

function migrate(raw: Raw, version: number): Raw | null {
  let current = raw;
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step === undefined) {
      return null;
    }
    current = step(current);
  }
  return current;
}

function invalid(reason: string): Invalid {
  return { kind: 'invalid', reason };
}

function isRecord(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Result of a section parser: the value or the path of the first violation. */
type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly path: string };

function good<T>(value: T): Parsed<T> {
  return { ok: true, value };
}

function bad<T>(path: string): Parsed<T> {
  return { ok: false, path };
}

function parseRect(v: unknown, path: string): Parsed<Rect> {
  if (!Array.isArray(v) || v.length !== RECT_LENGTH || !v.every(isFiniteNumber)) {
    return bad(path);
  }
  const [x = 0, y = 0, width = 0, height = 0] = v as number[];
  return width > 0 && height > 0 ? good({ x, y, width, height }) : bad(path);
}

function parsePage(v: unknown, path: string, pageCount: number): Parsed<MetadataPage> {
  if (!isRecord(v)) {
    return bad(path);
  }
  const { pageIndex, width, height, state, systems } = v;
  if (!isInt(pageIndex) || pageIndex < 0 || pageIndex >= pageCount) {
    return bad(`${path}.pageIndex`);
  }
  if (!isFiniteNumber(width) || width <= 0) {
    return bad(`${path}.width`);
  }
  if (!isFiniteNumber(height) || height <= 0) {
    return bad(`${path}.height`);
  }
  if (typeof state !== 'string' || !PAGE_STATES.includes(state)) {
    return bad(`${path}.state`);
  }
  if (!Array.isArray(systems)) {
    return bad(`${path}.systems`);
  }
  const rects: Rect[] = [];
  for (let i = 0; i < systems.length; i++) {
    const r = parseRect(systems[i], `${path}.systems[${i}]`);
    if (!r.ok) {
      return bad(r.path);
    }
    rects.push(r.value);
  }
  return good({ pageIndex, width, height, state: state as MetadataPage['state'], systems: rects });
}

function parseDetection(v: unknown, pageCount: number): Parsed<EmbeddedMetadata['detection']> {
  if (v === null) {
    return good(null);
  }
  if (!isRecord(v)) {
    return bad('detection');
  }
  if (typeof v['level'] !== 'string' || !DETECTION_LEVELS.includes(v['level'])) {
    return bad('detection.level');
  }
  const rawPages = v['pages'];
  if (!Array.isArray(rawPages)) {
    return bad('detection.pages');
  }
  const pages: MetadataPage[] = [];
  for (let i = 0; i < rawPages.length; i++) {
    const p = parsePage(rawPages[i], `detection.pages[${i}]`, pageCount);
    if (!p.ok) {
      return bad(p.path);
    }
    pages.push(p.value);
  }
  return good({ level: v['level'] as DetectionLevelId, pages });
}

function parseJump(v: unknown, path: string): Parsed<MetadataJump> {
  if (!isRecord(v)) {
    return bad(path);
  }
  const { id, origin, target, pass } = v;
  if (!isInt(id) || id < 1) {
    return bad(`${path}.id`);
  }
  if (!isInt(origin) || origin < 0) {
    return bad(`${path}.origin`);
  }
  if (!isInt(target) || target < 0) {
    return bad(`${path}.target`);
  }
  if (!isInt(pass) || pass < 1) {
    return bad(`${path}.pass`);
  }
  return good({ id, origin, target, pass });
}

/** Integers >= 1, strictly ascending (hence unique). */
function parseJunctionList(v: unknown): readonly number[] | null {
  if (!Array.isArray(v)) {
    return null;
  }
  for (let i = 0; i < v.length; i++) {
    if (!isInt(v[i]) || v[i] < 1 || (i > 0 && v[i] <= v[i - 1])) {
      return null;
    }
  }
  return v as number[];
}

function parseMarks(v: unknown): Parsed<EmbeddedMetadata['marks']> {
  if (!isRecord(v)) {
    return bad('marks');
  }
  const rawJumps = v['jumps'];
  if (!Array.isArray(rawJumps)) {
    return bad('marks.jumps');
  }
  const jumps: MetadataJump[] = [];
  for (let i = 0; i < rawJumps.length; i++) {
    const j = parseJump(rawJumps[i], `marks.jumps[${i}]`);
    if (!j.ok) {
      return bad(j.path);
    }
    jumps.push(j.value);
  }
  const breaks = parseJunctionList(v['breaks']);
  if (breaks === null) {
    return bad('marks.breaks');
  }
  const stops = parseJunctionList(v['stops']);
  if (stops === null) {
    return bad('marks.stops');
  }
  const nextJumpId = v['nextJumpId'];
  if (!isInt(nextJumpId) || jumps.some((j) => nextJumpId <= j.id)) {
    return bad('marks.nextJumpId');
  }
  return good({ jumps, breaks, stops, nextJumpId });
}

function parseAspectRatio(v: unknown): Parsed<EmbeddedMetadata['aspectRatio']> {
  if (!isRecord(v)) {
    return bad('aspectRatio');
  }
  const result: { portrait?: number; landscape?: number } = {};
  for (const key of ['portrait', 'landscape'] as const) {
    const value = v[key];
    if (value === undefined) {
      continue;
    }
    if (!isFiniteNumber(value) || value < RATIO_MIN || value > RATIO_MAX) {
      return bad(`aspectRatio.${key}`);
    }
    result[key] = value;
  }
  return good(result);
}

function validate(raw: Raw): ParseResult {
  if (typeof raw['appVersion'] !== 'string') {
    return invalid('appVersion');
  }
  const pageCount = raw['pageCount'];
  if (!isInt(pageCount) || pageCount < 0) {
    return invalid('pageCount');
  }
  const detection = parseDetection(raw['detection'], pageCount);
  if (!detection.ok) {
    return invalid(detection.path);
  }
  const marks = parseMarks(raw['marks']);
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
      schemaVersion: raw['schemaVersion'] as number,
      appVersion: raw['appVersion'],
      pageCount,
      detection: detection.value,
      marks: marks.value,
      aspectRatio: aspectRatio.value,
    },
  };
}
