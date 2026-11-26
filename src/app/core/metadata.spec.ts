import { describe, expect, it } from 'vitest';

import { parseCases, reconcileCases, schema1Cases, serializeCases, upgradeCases } from './fixtures/metadata.cases';
import { migrateCases } from './fixtures/migrate-v1.cases';
import { CURRENT_SCHEMA_VERSION, parseMetadata, reconcileMetadata, serializeMetadata } from './metadata';
import { derivePlayingOrderInput, forcedBreaks, generatePlayingOrder, isValidJump, isValidMarkJunction } from './playing-order';
import type { PlayingOrderInput } from './playing-order';
import { frozen } from '../../testing/deep-freeze';
import { caseTitle } from '../../testing/expect-close-deep';
import { schema1Pages, schema1Text } from '../../testing/schema1-text';

const MAX_LENGTH = 20000;

describe('serializeMetadata', () => {
  for (const c of serializeCases) {
    it(caseTitle(c, 'SAV-015'), () => {
      expect(serializeMetadata(frozen(c.metadata))).toBe(c.expectedText);
    });
  }

  // The shipped V1 app treats every version above its own (1) as newer and then never overwrites the data.
  it('SAV-003 SAV-017 what is written declares a version a schema 1 reader ignores as newer', () => {
    for (const c of serializeCases) {
      const written = JSON.parse(serializeMetadata(c.metadata)) as { schemaVersion: number };
      expect(written.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(written.schemaVersion).toBeGreaterThan(1);
    }
  });
});

// `toStrictEqual`: an absent `text` or `ref` is not the same as the key with `undefined`.
describe('parseMetadata', () => {
  for (const c of [...parseCases, ...upgradeCases, ...schema1Cases]) {
    it(caseTitle(c, 'SAV-002'), () => {
      expect(parseMetadata(c.text, MAX_LENGTH)).toStrictEqual(c.expected);
    });
  }
});

describe('reconcileMetadata', () => {
  for (const c of reconcileCases) {
    it(caseTitle(c, 'SAV-005'), () => {
      const input = frozen(c.metadata);
      expect(reconcileMetadata(input, c.pageCount)).toBe(c.kept ? input : null);
    });
  }
});

/** The systems played and the forced slide ends. */
function played(input: PlayingOrderInput, breaks: readonly number[]): { entries: readonly number[]; forced: boolean[] } {
  const order = generatePlayingOrder(input);
  return { entries: order.entries, forced: forcedBreaks(order, new Set(breaks)) };
}

/** M11 holds items (a pass 0, a break at junction 0) that already make the whole schema 1 data invalid. */
const NOT_A_SCHEMA_1_FILE = 'M11';

/** Every migration case as a complete schema 1 file with detection on its page layout. */
describe('a schema 1 file opens with its marks migrated', () => {
  for (const c of migrateCases) {
    it(`SAV-016 ${c.id}: ${c.name}`, () => {
      const text = schema1Text({ detection: { level: 'standard', pages: schema1Pages(c.counts) }, pageCount: c.counts.length, marks: c.v1 });
      const parsed = parseMetadata(text, MAX_LENGTH);
      if (c.id === NOT_A_SCHEMA_1_FILE) {
        expect(parsed.kind).toBe('invalid');
        return;
      }
      expect(parsed.kind).toBe('ok');
      if (parsed.kind !== 'ok') {
        return;
      }
      expect(parsed.pendingV1Marks).toBeNull();
      expect(parsed.value.marks).toStrictEqual(c.expected);
      if (c.samePlayingOrder) {
        const input = derivePlayingOrderInput(parsed.value.marks, c.counts, MAX_LENGTH);
        const n = input.systemCount;
        const valid = (junction: number) => isValidMarkJunction(junction, n);
        const jumps = c.v1.jumps.filter((jump) => isValidJump(jump, n));
        const before = played({ systemCount: n, jumps, stops: c.v1.stops.filter(valid), maxLength: MAX_LENGTH }, c.v1.breaks.filter(valid));
        expect(played(input, input.breaks)).toEqual(before);
      }
    });
  }
});
