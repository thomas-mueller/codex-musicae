/**
 * Fixtures: core/metadata-v2
 * Requirements: SAV-002, SAV-003, SAV-005, SAV-015, SAV-016, SAV-017, MRK-001, MRK-012
 * Expected values were derived by hand from the contract. Do not edit them without recording the reason in docs/changelog.md.
 */
import { EMPTY_SYSTEM_MARKS } from '../marks';
import type { SystemMarks } from '../marks';
import type { EmbeddedMetadata, ParseResult } from '../metadata-v2';

const r = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const marks = (patch: Partial<SystemMarks> = {}): SystemMarks => ({ ...EMPTY_SYSTEM_MARKS, ...patch });
const metadata = (patch: Partial<EmbeddedMetadata> = {}): EmbeddedMetadata => ({
  schemaVersion: 2, appVersion: 'v1.4.0', pageCount: 2, detection: null, marks: marks(), aspectRatio: {}, ...patch,
});

const FULL_MARKS = marks({
  jumps: [
    { id: 1, from: { pageIndex: 1, system: 2 }, to: { pageIndex: 0, system: 1 }, pass: 1 },
    { id: 3, from: { pageIndex: 0, system: 2 }, to: { file: 'Coda.pdf', pageIndex: 4, system: 1 }, pass: 2, text: 'to coda' },
  ],
  bookmarks: [
    { id: 1, at: { pageIndex: 0, system: 1 } },
    { id: 2, at: { pageIndex: 0, system: 1 }, ref: { file: 'Parts.pdf', pageIndex: 0, system: 3 }, text: 'cue "A" ×2' },
  ],
  stops: [{ at: { pageIndex: 0, system: 2 } }, { at: { pageIndex: 1, system: 1 }, text: 'Fine' }],
  breaks: [{ at: { pageIndex: 0, system: 2 } }],
  start: { at: { pageIndex: 0, system: 1 }, text: 'Intro' },
  nextJumpId: 4,
  nextBookmarkId: 3,
});

const EMPTY_MARKS_TEXT = '"marks":{"jumps":[],"bookmarks":[],"stops":[],"breaks":[],"start":null,"nextJumpId":1,"nextBookmarkId":1}';
const FULL_TEXT =
  '{"schemaVersion":2,"appVersion":"v1.4.0","pageCount":2,"detection":null,"marks":{' +
  '"jumps":[{"id":1,"from":{"pageIndex":1,"system":2},"to":{"pageIndex":0,"system":1},"pass":1},' +
  '{"id":3,"from":{"pageIndex":0,"system":2},"to":{"file":"Coda.pdf","pageIndex":4,"system":1},"pass":2,"text":"to coda"}],' +
  '"bookmarks":[{"id":1,"at":{"pageIndex":0,"system":1}},' +
  '{"id":2,"at":{"pageIndex":0,"system":1},"ref":{"file":"Parts.pdf","pageIndex":0,"system":3},"text":"cue \\"A\\" ×2"}],' +
  '"stops":[{"at":{"pageIndex":0,"system":2}},{"at":{"pageIndex":1,"system":1},"text":"Fine"}],' +
  '"breaks":[{"at":{"pageIndex":0,"system":2}}],' +
  '"start":{"at":{"pageIndex":0,"system":1},"text":"Intro"},"nextJumpId":4,"nextBookmarkId":3},"aspectRatio":{}}';

const DETECTED: EmbeddedMetadata['detection'] = {
  level: 'standard',
  pages: [
    { pageIndex: 0, width: 595.2756, height: 841.8898, state: 'done', systems: [r(50.123, 100.456, 495.001, 120.999)] },
    { pageIndex: 1, width: 595, height: 842, state: 'failed', systems: [] },
  ],
};
const DETECTED_TEXT =
  '"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595.28,"height":841.89,"state":"done","systems":[[50.12,100.46,495,121]]},' +
  '{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]}';

export const serializeV2Cases: ReadonlyArray<{ id: string; req: string; name: string; metadata: EmbeddedMetadata; expectedText: string }> = [
  {
    id: 'SV01', req: 'SAV-015', name: 'no marks', metadata: metadata(),
    expectedText: `{"schemaVersion":2,"appVersion":"v1.4.0","pageCount":2,"detection":null,${EMPTY_MARKS_TEXT},"aspectRatio":{}}`,
  },
  { id: 'SV02', req: 'SAV-015', name: 'every kind of mark, cross-file references and texts', metadata: metadata({ marks: FULL_MARKS }), expectedText: FULL_TEXT },
  {
    id: 'SV03', req: 'SAV-015', name: 'detection rounded to 2 decimals as in schema 1', metadata: metadata({ detection: DETECTED }),
    expectedText: `{"schemaVersion":2,"appVersion":"v1.4.0","pageCount":2,${DETECTED_TEXT},${EMPTY_MARKS_TEXT},"aspectRatio":{}}`,
  },
  {
    id: 'SV04', req: 'SAV-015', name: 'only the ratios that are set, portrait first', metadata: metadata({ aspectRatio: { landscape: 1.6, portrait: 0.75 } }),
    expectedText: `{"schemaVersion":2,"appVersion":"v1.4.0","pageCount":2,"detection":null,${EMPTY_MARKS_TEXT},"aspectRatio":{"portrait":0.75,"landscape":1.6}}`,
  },
  {
    id: 'SV05', req: 'SAV-017', name: 'a value that says schema 1 is written as schema 2', metadata: metadata({ schemaVersion: 1 }),
    expectedText: `{"schemaVersion":2,"appVersion":"v1.4.0","pageCount":2,"detection":null,${EMPTY_MARKS_TEXT},"aspectRatio":{}}`,
  },
  {
    id: 'SV06', req: 'SAV-017', name: 'keys of the input objects do not decide the order, extra keys are not written',
    metadata: metadata({
      marks: marks({ breaks: [{ text: 'turn', at: { system: 1, pageIndex: 0, extra: 1 } as never }], nextJumpId: 2 }),
    }),
    expectedText:
      '{"schemaVersion":2,"appVersion":"v1.4.0","pageCount":2,"detection":null,"marks":{"jumps":[],"bookmarks":[],"stops":[],' +
      '"breaks":[{"at":{"pageIndex":0,"system":1},"text":"turn"}],"start":null,"nextJumpId":2,"nextBookmarkId":1},"aspectRatio":{}}',
  },
];

/** A schema 2 text whose `marks` section is the empty one patched with `patch`. */
const withMarks = (patch: Record<string, unknown>, rest: Record<string, unknown> = {}): string =>
  JSON.stringify({ schemaVersion: 2, appVersion: 'v1.4.0', pageCount: 2, detection: null, marks: { ...EMPTY_SYSTEM_MARKS, ...patch }, aspectRatio: {}, ...rest });
const AT = { pageIndex: 0, system: 1 };
const LATER = { pageIndex: 1, system: 1 };
const JUMP = { id: 1, from: LATER, to: AT, pass: 1 };
const FOREIGN = { file: 'Coda.pdf', pageIndex: 0, system: 1 };
const oneJump = (patch: Record<string, unknown>): string => withMarks({ jumps: [{ ...JUMP, ...patch }], nextJumpId: 2 });
const invalid = (reason: string): ParseResult => ({ kind: 'invalid', reason });
const ok = (value: EmbeddedMetadata): ParseResult => ({ kind: 'ok', value, pendingV1Marks: null });

export const parseV2Cases: ReadonlyArray<{ id: string; req: string; name: string; text: string; expected: ParseResult }> = [
  { id: 'PV01', req: 'SAV-015', name: 'every kind of mark', text: FULL_TEXT, expected: ok(metadata({ marks: FULL_MARKS })) },
  {
    id: 'PV02', req: 'SAV-015', name: 'detection and ratios', text: withMarks({}, { detection: JSON.parse(`{${DETECTED_TEXT}}`).detection, aspectRatio: { portrait: 0.75 } }),
    expected: ok(metadata({
      detection: {
        level: 'standard',
        pages: [
          { pageIndex: 0, width: 595.28, height: 841.89, state: 'done', systems: [r(50.12, 100.46, 495, 121)] },
          { pageIndex: 1, width: 595, height: 842, state: 'failed', systems: [] },
        ],
      },
      aspectRatio: { portrait: 0.75 },
    })),
  },
  { id: 'PV03', req: 'SAV-003', name: 'a newer version', text: withMarks({}, { schemaVersion: 3 }), expected: { kind: 'newer', version: 3 } },
  { id: 'PV04', req: 'SAV-002', name: 'not json', text: '{', expected: invalid('json') },
  { id: 'PV05', req: 'SAV-002', name: 'not an object', text: '[2]', expected: invalid('root') },
  { id: 'PV06', req: 'SAV-002', name: 'no version', text: '{}', expected: invalid('schemaVersion') },
  { id: 'PV07', req: 'SAV-002', name: 'version 0', text: withMarks({}, { schemaVersion: 0 }), expected: invalid('schemaVersion') },
  { id: 'PV08', req: 'SAV-002', name: 'appVersion is checked first', text: withMarks({}, { appVersion: 2, pageCount: -1 }), expected: invalid('appVersion') },
  { id: 'PV09', req: 'SAV-002', name: 'page count', text: withMarks({}, { pageCount: 1.5 }), expected: invalid('pageCount') },
  { id: 'PV10', req: 'SAV-002', name: 'detection level', text: withMarks({}, { detection: { level: 'x', pages: [] } }), expected: invalid('detection.level') },
  { id: 'PV11', req: 'SAV-002', name: 'no marks section', text: withMarks({}, { marks: [] }), expected: invalid('marks') },
  { id: 'PV12', req: 'SAV-002', name: 'jumps is not a list', text: withMarks({ jumps: {} }), expected: invalid('marks.jumps') },
  { id: 'PV13', req: 'SAV-002', name: 'a jump is not an object', text: withMarks({ jumps: [1] }), expected: invalid('marks.jumps[0]') },
  { id: 'PV14', req: 'SAV-002', name: 'jump id 0', text: oneJump({ id: 0 }), expected: invalid('marks.jumps[0].id') },
  { id: 'PV15', req: 'SAV-002', name: 'a jump id used twice', text: withMarks({ jumps: [JUMP, JUMP], nextJumpId: 2 }), expected: invalid('marks.jumps[1].id') },
  { id: 'PV16', req: 'MRK-001', name: 'the start system of a jump is missing', text: oneJump({ from: undefined }), expected: invalid('marks.jumps[0].from') },
  { id: 'PV17', req: 'MRK-001', name: 'a page of this file beyond the page count', text: oneJump({ from: { pageIndex: 2, system: 1 } }), expected: invalid('marks.jumps[0].from.pageIndex') },
  { id: 'PV18', req: 'MRK-001', name: 'system 0', text: oneJump({ to: { pageIndex: 0, system: 0 } }), expected: invalid('marks.jumps[0].to.system') },
  { id: 'PV19', req: 'MRK-012', name: 'an empty file name', text: oneJump({ to: { ...FOREIGN, file: '' } }), expected: invalid('marks.jumps[0].to.file') },
  { id: 'PV20', req: 'MRK-012', name: 'a negative page of another file', text: oneJump({ to: { ...FOREIGN, pageIndex: -1 } }), expected: invalid('marks.jumps[0].to.pageIndex') },
  { id: 'PV21', req: 'SAV-002', name: 'pass 0', text: oneJump({ pass: 0 }), expected: invalid('marks.jumps[0].pass') },
  { id: 'PV22', req: 'SAV-002', name: 'empty jump text', text: oneJump({ text: '' }), expected: invalid('marks.jumps[0].text') },
  {
    id: 'PV23', req: 'MRK-012', name: 'a bookmark target without a file name is not a cross-file reference',
    text: withMarks({ bookmarks: [{ id: 1, at: AT, ref: LATER }], nextBookmarkId: 2 }), expected: invalid('marks.bookmarks[0].ref.file'),
  },
  {
    id: 'PV24', req: 'SAV-002', name: 'a bookmark id used twice',
    text: withMarks({ bookmarks: [{ id: 1, at: AT }, { id: 1, at: LATER }], nextBookmarkId: 2 }), expected: invalid('marks.bookmarks[1].id'),
  },
  { id: 'PV25', req: 'SAV-002', name: 'stop text of the wrong type', text: withMarks({ stops: [{ at: AT, text: 5 }] }), expected: invalid('marks.stops[0].text') },
  { id: 'PV26', req: 'SAV-002', name: 'stops out of print order', text: withMarks({ stops: [{ at: LATER }, { at: AT }] }), expected: invalid('marks.stops') },
  { id: 'PV27', req: 'SAV-002', name: 'two breaks on one system', text: withMarks({ breaks: [{ at: AT }, { at: AT }] }), expected: invalid('marks.breaks') },
  { id: 'PV28', req: 'SAV-002', name: 'the start key is missing', text: withMarks({ start: undefined }), expected: invalid('marks.start') },
  { id: 'PV29', req: 'SAV-002', name: 'the start mark has no system', text: withMarks({ start: {} }), expected: invalid('marks.start.at') },
  { id: 'PV30', req: 'SAV-002', name: 'next jump id not above the ids', text: withMarks({ jumps: [JUMP], nextJumpId: 1 }), expected: invalid('marks.nextJumpId') },
  { id: 'PV31', req: 'SAV-002', name: 'next bookmark id 0', text: withMarks({ nextBookmarkId: 0 }), expected: invalid('marks.nextBookmarkId') },
  { id: 'PV32', req: 'SAV-002', name: 'ratio out of range', text: withMarks({}, { aspectRatio: { landscape: 9 } }), expected: invalid('aspectRatio.landscape') },
  {
    id: 'PV33', req: 'SAV-015, MRK-001', name: 'marks without effect are legal: a missing system and a jump onto its own place',
    text: withMarks({ jumps: [{ id: 1, from: AT, to: { pageIndex: 0, system: 2 }, pass: 1 }], stops: [{ at: { pageIndex: 1, system: 99 } }], nextJumpId: 2 }),
    expected: ok(metadata({
      marks: marks({ jumps: [{ id: 1, from: AT, to: { pageIndex: 0, system: 2 }, pass: 1 }], stops: [{ at: { pageIndex: 1, system: 99 } }], nextJumpId: 2 }),
    })),
  },
  {
    id: 'PV34', req: 'SAV-015', name: 'unknown keys are ignored',
    text: withMarks({ extra: 1, breaks: [{ at: { ...AT, extra: 2 }, extra: 3 }] }, { extra: 4 }),
    expected: ok(metadata({ marks: marks({ breaks: [{ at: AT }] }) })),
  },
];

/** A schema 1 text. */
const v1 = (v1Marks: Record<string, unknown>, rest: Record<string, unknown> = {}): string =>
  JSON.stringify({
    schemaVersion: 1, appVersion: 'v1.0.0', pageCount: 3, detection: null,
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1, ...v1Marks }, aspectRatio: {}, ...rest,
  });
const RECT = [50, 100, 495, 120];
const page = (pageIndex: number, systems: number, state = 'done') => ({
  pageIndex, width: 595, height: 842, state, systems: Array.from({ length: systems }, () => RECT),
});
const detection = (...pages: ReturnType<typeof page>[]) => ({ level: 'fine', pages });
const parsedPage = (pageIndex: number, systems: number, state: 'done' | 'failed' = 'done') => ({
  pageIndex, width: 595, height: 842, state, systems: Array.from({ length: systems }, () => r(50, 100, 495, 120)),
});
const upgraded = (patch: Partial<EmbeddedMetadata>): EmbeddedMetadata => metadata({ appVersion: 'v1.0.0', pageCount: 3, ...patch });

const V1_JUMPS = [{ id: 1, origin: 3, target: 0, pass: 1 }];

export const parseV1Cases: ReadonlyArray<{ id: string; req: string; name: string; text: string; expected: ParseResult }> = [
  {
    id: 'PU01', req: 'SAV-016, SAV-003', name: 'marks are migrated with the page counts of the detection',
    text: v1({ jumps: V1_JUMPS, breaks: [1], stops: [2], nextJumpId: 2 }, { detection: detection(page(0, 2), page(1, 0), page(2, 2)), aspectRatio: { portrait: 0.8 } }),
    expected: ok(upgraded({
      detection: { level: 'fine', pages: [parsedPage(0, 2), parsedPage(1, 0), parsedPage(2, 2)] },
      marks: marks({
        jumps: [{ id: 1, from: { pageIndex: 2, system: 1 }, to: { pageIndex: 0, system: 1 }, pass: 1 }],
        breaks: [{ at: { pageIndex: 0, system: 1 } }],
        stops: [{ at: { pageIndex: 0, system: 2 } }],
        nextJumpId: 2,
      }),
      aspectRatio: { portrait: 0.8 },
    })),
  },
  {
    id: 'PU02', req: 'SAV-016', name: 'the page list order does not matter, the page index does',
    text: v1({ stops: [2] }, { detection: detection(page(2, 3), page(0, 1), page(1, 1)) }),
    expected: ok(upgraded({
      detection: { level: 'fine', pages: [parsedPage(2, 3), parsedPage(0, 1), parsedPage(1, 1)] },
      marks: marks({ stops: [{ at: { pageIndex: 1, system: 1 } }] }),
    })),
  },
  {
    id: 'PU03', req: 'SAV-016', name: 'a failed page has no systems',
    text: v1({ breaks: [2] }, { detection: detection(page(0, 1), page(1, 0, 'failed'), page(2, 2)) }),
    expected: ok(upgraded({
      detection: { level: 'fine', pages: [parsedPage(0, 1), parsedPage(1, 0, 'failed'), parsedPage(2, 2)] },
      marks: marks({ breaks: [{ at: { pageIndex: 2, system: 1 } }] }),
    })),
  },
  {
    id: 'PU04', req: 'SAV-016', name: 'a jump from gap 0 becomes the start mark',
    text: v1({ jumps: [{ id: 1, origin: 0, target: 1, pass: 1 }], nextJumpId: 2 }, { detection: detection(page(0, 1), page(1, 1), page(2, 1)) }),
    expected: ok(upgraded({
      detection: { level: 'fine', pages: [parsedPage(0, 1), parsedPage(1, 1), parsedPage(2, 1)] },
      marks: marks({ start: { at: { pageIndex: 1, system: 1 } }, nextJumpId: 2 }),
    })),
  },
  {
    id: 'PU05', req: 'SAV-016', name: 'a page list that does not cover the file gives no marks',
    text: v1({ stops: [1] }, { detection: detection(page(0, 2)) }),
    expected: ok(upgraded({ detection: { level: 'fine', pages: [parsedPage(0, 2)] } })),
  },
  {
    id: 'PU06', req: 'SAV-016, SAV-003', name: 'without detection the jumps wait',
    text: v1({ jumps: V1_JUMPS, nextJumpId: 2 }),
    expected: { kind: 'ok', value: upgraded({}), pendingV1Marks: { jumps: V1_JUMPS, breaks: [], stops: [], nextJumpId: 2 } },
  },
  {
    id: 'PU07', req: 'SAV-016', name: 'a single break waits too',
    text: v1({ breaks: [4] }),
    expected: { kind: 'ok', value: upgraded({}), pendingV1Marks: { jumps: [], breaks: [4], stops: [], nextJumpId: 1 } },
  },
  {
    id: 'PU08', req: 'SAV-016', name: 'a single stop waits too',
    text: v1({ stops: [4] }),
    expected: { kind: 'ok', value: upgraded({}), pendingV1Marks: { jumps: [], breaks: [], stops: [4], nextJumpId: 1 } },
  },
  {
    id: 'PU09', req: 'SAV-016', name: 'nothing waits without marks; the next jump id is kept',
    text: v1({ nextJumpId: 5 }),
    expected: ok(upgraded({ marks: marks({ nextJumpId: 5 }) })),
  },
  { id: 'PU10', req: 'SAV-003', name: 'invalid schema 1 data keeps its schema 1 reason', text: v1({ breaks: [2, 1] }), expected: invalid('marks.breaks') },
];

export const reconcileV2Cases: ReadonlyArray<{ id: string; req: string; name: string; metadata: EmbeddedMetadata; pageCount: number; kept: boolean }> = [
  { id: 'RV1', req: 'SAV-005', name: 'same page count', metadata: metadata({ detection: DETECTED }), pageCount: 2, kept: true },
  { id: 'RV2', req: 'SAV-005', name: 'another page count', metadata: metadata(), pageCount: 3, kept: false },
  { id: 'RV3', req: 'SAV-005', name: 'the detection does not list every page', metadata: metadata({ pageCount: 3, detection: DETECTED }), pageCount: 3, kept: false },
];
