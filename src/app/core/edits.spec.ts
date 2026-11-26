import {
  addJumpCases, junctionCases, jumpColorCases, MIXED_MARKS, MIXED_VIEW, removeJumpCases, toggleCases, updateJumpCases, VIEW_COUNTS,
} from './fixtures/edits.cases';
import {
  addJump, clearJunction, jumpColorIndex, jumpsAtJunction, junctionHasItems, junctionView, removeJump, toggleBreak, toggleStop,
  updateJump,
} from './edits';
import type { DocMarks } from './edits';
import { EMPTY_SYSTEM_MARKS } from './marks';
import type { SystemMarks } from './marks';
import { caseTitle } from '../../testing/expect-close-deep';

/** All systems on one page: junction k is the right side of system k and the left side of system k+1. */
const ONE_PAGE = (systemCount: number): number[] => [systemCount];
const FOUR = ONE_PAGE(4);

function onSystems(marks: DocMarks): SystemMarks {
  const system = (k: number) => ({ pageIndex: 0, system: k });
  return {
    ...EMPTY_SYSTEM_MARKS,
    jumps: marks.jumps.map((j) => ({ id: j.id, from: system(j.origin), to: system(j.target + 1), pass: j.pass })),
    breaks: marks.breaks.map((k) => ({ at: system(k) })),
    stops: marks.stops.map((k) => ({ at: system(k) })),
    nextJumpId: marks.nextJumpId,
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('addJump', () => {
  for (const c of addJumpCases) {
    it(caseTitle(c, 'ORG-015'), () => {
      const counts = ONE_PAGE(c.systemCount);
      const result = addJump(deepFreeze(onSystems(c.marks)), c.jump, counts);
      expect(result === null ? null : junctionView(result, counts)).toEqual(c.expected);
    });
  }
});

describe('removeJump', () => {
  for (const c of removeJumpCases) {
    it(caseTitle(c, 'ORG-024'), () => {
      expect(junctionView(removeJump(deepFreeze(onSystems(c.marks)), c.jumpId), FOUR)).toEqual(c.expected);
    });
  }
});

describe('updateJump', () => {
  for (const c of updateJumpCases) {
    it(caseTitle(c, 'ORG-016'), () => {
      const counts = ONE_PAGE(c.systemCount);
      const result = updateJump(deepFreeze(onSystems(c.marks)), c.jumpId, c.patch, counts);
      expect(result === null ? null : junctionView(result, counts)).toEqual(c.expected);
    });
  }

  it('ORG-020 keeps the user text of the jump', () => {
    const result = updateJump(deepFreeze(structuredClone(MIXED_MARKS)), 1, { pass: 2 }, VIEW_COUNTS);
    expect(result?.jumps[0]).toStrictEqual({ ...MIXED_MARKS.jumps[0], pass: 2 });
  });
});

describe('toggleBreak / toggleStop', () => {
  for (const c of toggleCases) {
    it(caseTitle(c, 'ORG-013'), () => {
      const counts = ONE_PAGE(c.systemCount);
      const fn = c.kind === 'break' ? toggleBreak : toggleStop;
      expect(junctionView(fn(deepFreeze(onSystems(c.marks)), c.junction, counts), counts)).toEqual(c.expected);
    });
  }
});

describe('junction queries and clearJunction', () => {
  for (const c of junctionCases) {
    it(`${c.req} ${c.id}: jumpsAtJunction`, () => {
      expect(jumpsAtJunction(c.marks, c.junction)).toEqual(c.atJunction);
    });
    it(`${c.req} ${c.id}: junctionHasItems`, () => {
      expect(junctionHasItems(c.marks, c.junction)).toBe(c.hasItems);
    });
    it(`${c.req} ${c.id}: clearJunction (ORG-024)`, () => {
      expect(junctionView(clearJunction(deepFreeze(onSystems(c.marks)), c.junction, FOUR), FOUR)).toEqual(c.cleared);
    });
  }
});

describe('junctionView and the marks it does not show', () => {
  it('MRK-001 shows right sides as junction k, left sides as junction k-1, and nothing without a V1 form', () => {
    expect(junctionView(deepFreeze(structuredClone(MIXED_MARKS)), VIEW_COUNTS)).toStrictEqual(MIXED_VIEW);
  });

  const marks = (): SystemMarks => deepFreeze(structuredClone(MIXED_MARKS));
  const edits: ReadonlyArray<[string, () => SystemMarks | null]> = [
    ['addJump', () => addJump(marks(), { origin: 4, target: 1, pass: 1 }, VIEW_COUNTS)],
    ['removeJump', () => removeJump(marks(), 1)],
    ['updateJump', () => updateJump(marks(), 1, { target: 2 }, VIEW_COUNTS)],
    ['toggleBreak', () => toggleBreak(marks(), 2, VIEW_COUNTS)],
    ['toggleStop', () => toggleStop(marks(), 3, VIEW_COUNTS)],
    ...[0, 1, 2, 3, 4, 5].map((k): [string, () => SystemMarks] => [`clearJunction ${k}`, () => clearJunction(marks(), k, VIEW_COUNTS)]),
  ];
  for (const [name, edit] of edits) {
    it(`MRK-013 ${name} keeps the start mark, bookmarks, cross-file jumps and marks without effect`, () => {
      const result = edit();
      expect(result).not.toBeNull();
      expect(result?.start).toStrictEqual(MIXED_MARKS.start);
      expect(result?.bookmarks).toStrictEqual(MIXED_MARKS.bookmarks);
      expect(result?.jumps.filter((j) => [2, 3, 4].includes(j.id))).toStrictEqual(MIXED_MARKS.jumps.slice(1));
      expect(result?.stops).toContainEqual(MIXED_MARKS.stops[1]);
      expect(result?.breaks).toContainEqual(MIXED_MARKS.breaks[1]);
    });
  }

  it('MRK-001 a chip edit lands on the matching system sides across pages', () => {
    const added = addJump(EMPTY_SYSTEM_MARKS, { origin: 3, target: 3, pass: 1 }, VIEW_COUNTS);
    expect(added).toBeNull(); // the target is the system directly after the start: the same junction
    const jump = addJump(EMPTY_SYSTEM_MARKS, { origin: 4, target: 1, pass: 1 }, VIEW_COUNTS);
    expect(jump?.jumps).toStrictEqual([{ id: 1, from: { pageIndex: 2, system: 1 }, to: { pageIndex: 0, system: 2 }, pass: 1 }]);
    expect(toggleStop(EMPTY_SYSTEM_MARKS, 3, VIEW_COUNTS).stops).toStrictEqual([{ at: { pageIndex: 0, system: 3 } }]);
  });
});

describe('jumpColorIndex', () => {
  for (const c of jumpColorCases) {
    it(`${c.req} ${c.id}: id ${c.jumpId} of ${c.paletteSize}`, () => {
      expect(jumpColorIndex(c.jumpId, c.paletteSize)).toBe(c.expected);
    });
  }
});
