import { describe, expect, it } from 'vitest';

import { migrateCases } from './fixtures/migrate-v1.cases';
import { migrateMarksV1 } from './migrate-v1';
import type { V1Marks } from './migrate-v1';
import { derivePlayingOrderInput, forcedBreaks, generatePlayingOrder, isValidJump, isValidMarkJunction } from './playing-order';
import type { PlayingOrderInput } from './playing-order';
import { frozen } from '../../testing/deep-freeze';
import { caseTitle } from '../../testing/expect-close-deep';

const MAX_LENGTH = 20000;

/** What a performer notices: the systems played and where a slide must end. */
function played(input: PlayingOrderInput, breaks: readonly number[]): { entries: readonly number[]; forced: boolean[] } {
  const order = generatePlayingOrder(input);
  return { entries: order.entries, forced: forcedBreaks(order, new Set(breaks)) };
}

/** The V1 order of the valid V1 items. */
function playedByV1(v1: V1Marks, systemCount: number) {
  const valid = (junction: number) => isValidMarkJunction(junction, systemCount);
  const jumps = v1.jumps.filter((jump) => isValidJump(jump, systemCount));
  return played({ systemCount, jumps, stops: v1.stops.filter(valid), maxLength: MAX_LENGTH }, v1.breaks.filter(valid));
}

describe('migrateMarksV1', () => {
  for (const c of migrateCases) {
    it(caseTitle(c, 'SAV-016'), () => {
      expect(migrateMarksV1(frozen(c.v1), frozen(c.counts), MAX_LENGTH)).toStrictEqual(c.expected);
    });

    it(`SAV-016 ${c.id}: the migrated playing order ${c.samePlayingOrder ? 'equals' : 'differs from'} the V1 order`, () => {
      const migrated = migrateMarksV1(frozen(c.v1), c.counts, MAX_LENGTH);
      const input = derivePlayingOrderInput(migrated, c.counts, MAX_LENGTH);
      const after = played(input, input.breaks);
      const before = playedByV1(c.v1, input.systemCount);
      if (c.samePlayingOrder) {
        expect(after).toEqual(before);
      } else {
        expect(after).not.toEqual(before);
      }
    });
  }
});
