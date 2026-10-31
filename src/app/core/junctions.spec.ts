import { describe, expect, it } from 'vitest';

import { barsOfJunctionCases, junctionCases } from './fixtures/junctions.cases';
import { junctionLabelCases, labelBars } from './fixtures/junction-labels.cases';
import { barsOfJunction, computeBars, flattenSystems, junctionCount, junctionLabel } from './junctions';
import { expectCloseDeep } from '../../testing/expect-close-deep';

describe('junctions', () => {
  for (const c of junctionCases) {
    it(`${c.req} ${c.id}: ${c.name} (flattenSystems)`, () => {
      expectCloseDeep(flattenSystems(c.pages), c.systems);
    });
    it(`${c.req} ${c.id}: ${c.name} (junctionCount)`, () => {
      expectCloseDeep(junctionCount(c.pages), c.count);
    });
    it(`${c.req} ${c.id}: ${c.name} (computeBars)`, () => {
      expectCloseDeep(computeBars(c.pages), c.bars);
    });
  }
});

describe('barsOfJunction', () => {
  for (const c of barsOfJunctionCases) {
    it(`ORG-008 ${c.id}: junction ${c.junction} of ${c.from}`, () => {
      const source = junctionCases.find((j) => j.id === c.from);
      if (!source) {
        throw new Error(`fixture ${c.from} missing`);
      }
      expectCloseDeep(barsOfJunction(source.bars, c.junction), c.expected);
    });
  }
});

describe('junctionLabel', () => {
  for (const c of junctionLabelCases) {
    it(`${c.req} ${c.id}: junction ${c.junction}`, () => {
      expect(junctionLabel(labelBars, c.junction)).toEqual(c.expected);
    });
  }
});
