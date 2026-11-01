import { describe, expect, it } from 'vitest';

import {
  addJumpCases, junctionCases, jumpColorCases, reconcileCases, removeJumpCases, toggleCases, updateJumpCases,
} from './fixtures/edits.cases';
import {
  addJump, clearJunction, jumpColorIndex, jumpsAtJunction, junctionHasItems, reconcileAfterRedetection, removeJump,
  toggleBreak, toggleStop, updateJump,
} from './edits';
import type { DocMarks } from './edits';
import { caseTitle } from '../../testing/expect-close-deep';

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
      expect(addJump(deepFreeze(structuredClone(c.marks)), c.jump, c.systemCount)).toEqual(c.expected);
    });
  }
});

describe('removeJump', () => {
  for (const c of removeJumpCases) {
    it(caseTitle(c, 'ORG-024'), () => {
      expect(removeJump(deepFreeze(structuredClone(c.marks)), c.jumpId)).toEqual(c.expected);
    });
  }
});

describe('updateJump', () => {
  for (const c of updateJumpCases) {
    it(caseTitle(c, 'ORG-016'), () => {
      expect(updateJump(deepFreeze(structuredClone(c.marks)), c.jumpId, c.patch, c.systemCount)).toEqual(c.expected);
    });
  }
});

describe('toggleBreak / toggleStop', () => {
  for (const c of toggleCases) {
    it(caseTitle(c, 'ORG-013'), () => {
      const marks = deepFreeze(structuredClone(c.marks));
      const fn = c.kind === 'break' ? toggleBreak : toggleStop;
      expect(fn(marks, c.junction, c.systemCount)).toEqual(c.expected);
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
      const marks: DocMarks = deepFreeze(structuredClone(c.marks));
      expect(clearJunction(marks, c.junction)).toEqual(c.cleared);
    });
  }
});

describe('reconcileAfterRedetection', () => {
  for (const c of reconcileCases) {
    it(caseTitle(c, 'DET-015'), () => {
      expect(reconcileAfterRedetection(c.marks, c.oldCount, c.newCount)).toEqual(c.expected);
    });
  }
});

describe('jumpColorIndex', () => {
  for (const c of jumpColorCases) {
    it(`${c.req} ${c.id}: id ${c.jumpId} of ${c.paletteSize}`, () => {
      expect(jumpColorIndex(c.jumpId, c.paletteSize)).toBe(c.expected);
    });
  }
});
