/**
 * Fixtures: core/session
 * Requirements: FIL-011, FIL-013, FIL-014, NFR-015
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference-3.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { SessionSnapshot } from '../session';

export const parseSessionCases: ReadonlyArray<{ id: string; req: string; name: string; raw: unknown; expected: SessionSnapshot | null }> = [
  {
    id: 'SS01',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'valid session',
    raw: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
        {
          ref: { id: 'b', name: 'b.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 1,
    },
    expected: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
        {
          ref: { id: 'b', name: 'b.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 1,
    },
  },
  {
    id: 'SS02',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'wrong version',
    raw: { version: 2, tabs: [] },
    expected: null,
  },
  {
    id: 'SS03',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'not an object',
    raw: 'text',
    expected: null,
  },
  { id: 'SS04', req: 'FIL-011, FIL-013, FIL-014', name: 'null', raw: null, expected: null },
  {
    id: 'SS05',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'tabs missing',
    raw: { version: 1 },
    expected: null,
  },
  {
    id: 'SS06',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'invalid tabs are dropped',
    raw: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
        { ref: { id: '', name: 'x' } },
        { nope: 1 },
        {
          ref: { id: 'c', name: 'c.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 0,
    },
    expected: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
        {
          ref: { id: 'c', name: 'c.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 0,
    },
  },
  {
    id: 'SS07',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'activeIndex clamped high',
    raw: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
        {
          ref: { id: 'b', name: 'b.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 9,
    },
    expected: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
        {
          ref: { id: 'b', name: 'b.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 1,
    },
  },
  {
    id: 'SS08',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'activeIndex clamped low',
    raw: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: -3,
    },
    expected: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 0,
    },
  },
  {
    id: 'SS09',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'activeIndex not a number',
    raw: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 'x',
    },
    expected: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 0,
    },
  },
  {
    id: 'SS10',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'duplicate ref ids keep the first',
    raw: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 9,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 0,
    },
    expected: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 100, lastModified: 5 },
          system: 3,
          orgPage: 2,
          orgOffset: 40.5,
        },
      ],
      activeIndex: 0,
    },
  },
  {
    id: 'SS11',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'bad numbers fall back',
    raw: {
      version: 1,
      tabs: [
        {
          ref: { id: 'a', name: 'a.pdf', size: 'big', lastModified: NaN },
          system: -2,
          orgPage: 1.5,
          orgOffset: -4,
        },
      ],
      activeIndex: 0,
    },
    expected: {
      version: 1,
      tabs: [{ ref: { id: 'a', name: 'a.pdf' }, system: 0, orgPage: 0, orgOffset: 0 }],
      activeIndex: 0,
    },
  },
  {
    id: 'SS12',
    req: 'FIL-011, FIL-013, FIL-014',
    name: 'empty tab list',
    raw: { version: 1, tabs: [], activeIndex: 5 },
    expected: { version: 1, tabs: [], activeIndex: 0 },
  },
];
