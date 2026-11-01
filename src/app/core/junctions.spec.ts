import { describe, it } from 'vitest';

import { barsOfJunctionCases, junctionCases } from './fixtures/junctions.cases';
import { barsOfJunction, computeBars, flattenSystems, junctionCount } from './junctions';
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
