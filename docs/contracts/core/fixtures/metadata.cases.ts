/**
 * Fixtures: core/metadata
 * Requirements: SAV-002..SAV-005, DET-023
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference-3.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { Rect } from '../geometry';
import type { EmbeddedMetadata, ParseResult } from '../metadata';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** serializeMetadata(metadata) must equal expectedText exactly (key order, arrays for rectangles, 2-decimal rounding). */
export const serializeCases: ReadonlyArray<{ id: string; req: string; name: string; metadata: EmbeddedMetadata; expectedText: string }> = [
  {
    id: 'SM1',
    req: 'SAV-004',
    name: 'full document',
    metadata: {
      schemaVersion: 1,
      appVersion: 'v1.15.0-3-g3f2a9c1',
      pageCount: 2,
      detection: {
        level: 'standard',
        pages: [
          {
            pageIndex: 0,
            width: 595,
            height: 842,
            state: 'done',
            systems: [r(50, 100, 495, 120.5), r(50, 280, 495, 120.5)],
          },
          { pageIndex: 1, width: 595, height: 842, state: 'failed', systems: [] },
        ],
      },
      marks: {
        jumps: [{ id: 1, origin: 2, target: 0, pass: 1 }, { id: 3, origin: 0, target: 1, pass: 2 }],
        breaks: [1, 2],
        stops: [1],
        nextJumpId: 4,
      },
      aspectRatio: { portrait: 0.75, landscape: 1.78 },
    },
    expectedText: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
  },
  {
    id: 'SM2',
    req: 'SAV-004',
    name: 'minimal: detection null, empty marks, no ratios',
    metadata: {
      schemaVersion: 1,
      appVersion: 'unknown',
      pageCount: 0,
      detection: null,
      marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
      aspectRatio: {  },
    },
    expectedText: '{"schemaVersion":1,"appVersion":"unknown","pageCount":0,"detection":null,"marks":{"jumps":[],"breaks":[],"stops":[],"nextJumpId":1},"aspectRatio":{}}',
  },
  {
    id: 'SM3',
    req: 'SAV-004',
    name: 'only one ratio present',
    metadata: {
      schemaVersion: 1,
      appVersion: 'unknown',
      pageCount: 3,
      detection: null,
      marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
      aspectRatio: { landscape: 1.6 },
    },
    expectedText: '{"schemaVersion":1,"appVersion":"unknown","pageCount":3,"detection":null,"marks":{"jumps":[],"breaks":[],"stops":[],"nextJumpId":1},"aspectRatio":{"landscape":1.6}}',
  },
  {
    id: 'SM4',
    req: 'SAV-004',
    name: 'numbers are rounded to 2 decimals',
    metadata: {
      schemaVersion: 1,
      appVersion: 'unknown',
      pageCount: 1,
      detection: {
        level: 'fine',
        pages: [
          {
            pageIndex: 0,
            width: 595.2756,
            height: 841.8898,
            state: 'done',
            systems: [r(50.123, 100.456, 495.001, 120.999)],
          },
        ],
      },
      marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
      aspectRatio: {  },
    },
    expectedText: '{"schemaVersion":1,"appVersion":"unknown","pageCount":1,"detection":{"level":"fine","pages":[{"pageIndex":0,"width":595.28,"height":841.89,"state":"done","systems":[[50.12,100.46,495,121]]}]},"marks":{"jumps":[],"breaks":[],"stops":[],"nextJumpId":1},"aspectRatio":{}}',
  },
];

export const parseCases: ReadonlyArray<{ id: string; req: string; name: string; text: string; expected: ParseResult }> = [
  {
    id: 'PM01',
    req: 'SAV-002, SAV-003',
    name: 'not json',
    text: 'xyz',
    expected: { kind: 'invalid', reason: 'json' },
  },
  {
    id: 'PM02',
    req: 'SAV-002, SAV-003',
    name: 'array instead of object',
    text: '[]',
    expected: { kind: 'invalid', reason: 'root' },
  },
  {
    id: 'PM03',
    req: 'SAV-002, SAV-003',
    name: 'missing schemaVersion',
    text: '{}',
    expected: { kind: 'invalid', reason: 'schemaVersion' },
  },
  {
    id: 'PM04',
    req: 'SAV-002, SAV-003',
    name: 'newer version',
    text: '{"schemaVersion":2,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'newer', version: 2 },
  },
  {
    id: 'PM05',
    req: 'SAV-002, SAV-003',
    name: 'negative pageCount',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":-1,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'pageCount' },
  },
  {
    id: 'PM06',
    req: 'SAV-002, SAV-003',
    name: 'unknown level',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"x","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'detection.level' },
  },
  {
    id: 'PM07',
    req: 'SAV-002, SAV-003',
    name: 'jump pass 0',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":0},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'marks.jumps[0].pass' },
  },
  {
    id: 'PM08',
    req: 'SAV-002, SAV-003',
    name: 'breaks not ascending',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[3,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'marks.breaks' },
  },
  {
    id: 'PM09',
    req: 'SAV-002, SAV-003',
    name: 'nextJumpId not above the largest id',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":3},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'marks.nextJumpId' },
  },
  {
    id: 'PM10',
    req: 'SAV-002, SAV-003',
    name: 'ratio out of range',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":3,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'aspectRatio.portrait' },
  },
  {
    id: 'PM11',
    req: 'SAV-002, SAV-003',
    name: 'page index not below pageCount',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":2,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'detection.pages[0].pageIndex' },
  },
  {
    id: 'PM12',
    req: 'SAV-002, SAV-003',
    name: 'rectangle with 3 numbers',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[1,2,3],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'detection.pages[0].systems[0]' },
  },
  {
    id: 'PM13',
    req: 'SAV-002, SAV-003',
    name: 'missing marks',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'marks' },
  },
  {
    id: 'PM14',
    req: 'SAV-002, SAV-003',
    name: 'schemaVersion 0',
    text: '{"schemaVersion":0,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'schemaVersion' },
  },
  {
    id: 'PM15',
    req: 'SAV-002, SAV-003',
    name: 'appVersion not a string',
    text: '{"schemaVersion":1,"appVersion":5,"pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'appVersion' },
  },
  {
    id: 'PM16',
    req: 'SAV-002, SAV-003',
    name: 'valid full document round-trips',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: {
      kind: 'ok',
      value: {
        schemaVersion: 1,
        appVersion: 'v1.15.0-3-g3f2a9c1',
        pageCount: 2,
        detection: {
          level: 'standard',
          pages: [
            {
              pageIndex: 0,
              width: 595,
              height: 842,
              state: 'done',
              systems: [r(50, 100, 495, 120.5), r(50, 280, 495, 120.5)],
            },
            { pageIndex: 1, width: 595, height: 842, state: 'failed', systems: [] },
          ],
        },
        marks: {
          jumps: [{ id: 1, origin: 2, target: 0, pass: 1 }, { id: 3, origin: 0, target: 1, pass: 2 }],
          breaks: [1, 2],
          stops: [1],
          nextJumpId: 4,
        },
        aspectRatio: { portrait: 0.75, landscape: 1.78 },
      },
    },
  },
  {
    id: 'PM17',
    req: 'SAV-002, SAV-003',
    name: 'valid minimal document round-trips',
    text: '{"schemaVersion":1,"appVersion":"unknown","pageCount":0,"detection":null,"marks":{"jumps":[],"breaks":[],"stops":[],"nextJumpId":1},"aspectRatio":{}}',
    expected: {
      kind: 'ok',
      value: {
        schemaVersion: 1,
        appVersion: 'unknown',
        pageCount: 0,
        detection: null,
        marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
        aspectRatio: {  },
      },
    },
  },
  {
    id: 'PM18',
    req: 'SAV-002, SAV-003',
    name: 'rectangle with zero height',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,0]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'detection.pages[0].systems[1]' },
  },
  {
    id: 'PM19',
    req: 'SAV-002, SAV-003',
    name: 'missing detection key',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'detection' },
  },
  {
    id: 'PM20',
    req: 'SAV-002, SAV-003',
    name: 'stops with a duplicate',
    text: '{"schemaVersion":1,"appVersion":"v1.15.0-3-g3f2a9c1","pageCount":2,"detection":{"level":"standard","pages":[{"pageIndex":0,"width":595,"height":842,"state":"done","systems":[[50,100,495,120.5],[50,280,495,120.5]]},{"pageIndex":1,"width":595,"height":842,"state":"failed","systems":[]}]},"marks":{"jumps":[{"id":1,"origin":2,"target":0,"pass":1},{"id":3,"origin":0,"target":1,"pass":2}],"breaks":[1,2],"stops":[1,1],"nextJumpId":4},"aspectRatio":{"portrait":0.75,"landscape":1.78}}',
    expected: { kind: 'invalid', reason: 'marks.stops' },
  },
];

export const reconcileCases: ReadonlyArray<{ id: string; req: string; name: string; metadata: EmbeddedMetadata; pageCount: number; expected: EmbeddedMetadata | null }> = [
  {
    id: 'RM1',
    req: 'SAV-005',
    name: 'same page count',
    metadata: {
      schemaVersion: 1,
      appVersion: 'v1.15.0-3-g3f2a9c1',
      pageCount: 2,
      detection: {
        level: 'standard',
        pages: [
          {
            pageIndex: 0,
            width: 595,
            height: 842,
            state: 'done',
            systems: [r(50, 100, 495, 120.5), r(50, 280, 495, 120.5)],
          },
          { pageIndex: 1, width: 595, height: 842, state: 'failed', systems: [] },
        ],
      },
      marks: {
        jumps: [{ id: 1, origin: 2, target: 0, pass: 1 }, { id: 3, origin: 0, target: 1, pass: 2 }],
        breaks: [1, 2],
        stops: [1],
        nextJumpId: 4,
      },
      aspectRatio: { portrait: 0.75, landscape: 1.78 },
    },
    pageCount: 2,
    expected: {
      schemaVersion: 1,
      appVersion: 'v1.15.0-3-g3f2a9c1',
      pageCount: 2,
      detection: {
        level: 'standard',
        pages: [
          {
            pageIndex: 0,
            width: 595,
            height: 842,
            state: 'done',
            systems: [r(50, 100, 495, 120.5), r(50, 280, 495, 120.5)],
          },
          { pageIndex: 1, width: 595, height: 842, state: 'failed', systems: [] },
        ],
      },
      marks: {
        jumps: [{ id: 1, origin: 2, target: 0, pass: 1 }, { id: 3, origin: 0, target: 1, pass: 2 }],
        breaks: [1, 2],
        stops: [1],
        nextJumpId: 4,
      },
      aspectRatio: { portrait: 0.75, landscape: 1.78 },
    },
  },
  {
    id: 'RM2',
    req: 'SAV-005',
    name: 'different page count',
    metadata: {
      schemaVersion: 1,
      appVersion: 'v1.15.0-3-g3f2a9c1',
      pageCount: 2,
      detection: {
        level: 'standard',
        pages: [
          {
            pageIndex: 0,
            width: 595,
            height: 842,
            state: 'done',
            systems: [r(50, 100, 495, 120.5), r(50, 280, 495, 120.5)],
          },
          { pageIndex: 1, width: 595, height: 842, state: 'failed', systems: [] },
        ],
      },
      marks: {
        jumps: [{ id: 1, origin: 2, target: 0, pass: 1 }, { id: 3, origin: 0, target: 1, pass: 2 }],
        breaks: [1, 2],
        stops: [1],
        nextJumpId: 4,
      },
      aspectRatio: { portrait: 0.75, landscape: 1.78 },
    },
    pageCount: 3,
    expected: null,
  },
  {
    id: 'RM3',
    req: 'SAV-005',
    name: 'detection page list shorter than pageCount',
    metadata: {
      schemaVersion: 1,
      appVersion: 'v1.15.0-3-g3f2a9c1',
      pageCount: 3,
      detection: {
        level: 'standard',
        pages: [
          {
            pageIndex: 0,
            width: 595,
            height: 842,
            state: 'done',
            systems: [r(50, 100, 495, 120.5), r(50, 280, 495, 120.5)],
          },
          { pageIndex: 1, width: 595, height: 842, state: 'failed', systems: [] },
        ],
      },
      marks: {
        jumps: [{ id: 1, origin: 2, target: 0, pass: 1 }, { id: 3, origin: 0, target: 1, pass: 2 }],
        breaks: [1, 2],
        stops: [1],
        nextJumpId: 4,
      },
      aspectRatio: { portrait: 0.75, landscape: 1.78 },
    },
    pageCount: 3,
    expected: null,
  },
  {
    id: 'RM4',
    req: 'SAV-005',
    name: 'no detection, same count',
    metadata: {
      schemaVersion: 1,
      appVersion: 'unknown',
      pageCount: 0,
      detection: null,
      marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
      aspectRatio: {  },
    },
    pageCount: 0,
    expected: {
      schemaVersion: 1,
      appVersion: 'unknown',
      pageCount: 0,
      detection: null,
      marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
      aspectRatio: {  },
    },
  },
];
