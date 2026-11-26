import { describe, expect, it } from 'vitest';

import { parseV1Cases, parseV2Cases, reconcileV2Cases, serializeV2Cases } from './fixtures/metadata-v2.cases';
import { migrateCases } from './fixtures/migrate-v1.cases';
import { parseMetadata as parseSchema1, serializeMetadata as serializeSchema1 } from './metadata';
import { CURRENT_SCHEMA_VERSION, parseMetadata, reconcileMetadata, serializeMetadata } from './metadata-v2';
import { derivePlayingOrderInput, forcedBreaks, generatePlayingOrder, isValidJump, isValidMarkJunction } from './playing-order';
import type { PlayingOrderInput } from './playing-order';
import { frozen } from '../../testing/deep-freeze';
import { caseTitle } from '../../testing/expect-close-deep';

const MAX_LENGTH = 20000;

describe('serializeMetadata (schema 2)', () => {
  for (const c of serializeV2Cases) {
    it(caseTitle(c, 'SAV-015'), () => {
      expect(serializeMetadata(frozen(c.metadata))).toBe(c.expectedText);
    });
  }

  it('SAV-003 a reader of schema 1 ignores schema 2 data as newer', () => {
    const [full] = serializeV2Cases.filter((c) => c.id === 'SV02');
    expect(full).toBeDefined();
    const text = serializeMetadata(full?.metadata as Parameters<typeof serializeMetadata>[0]);
    expect(parseSchema1(text)).toEqual({ kind: 'newer', version: CURRENT_SCHEMA_VERSION });
  });
});

// `toStrictEqual`: an absent `text` or `ref` is not the same as the key with `undefined`.
describe('parseMetadata (schema 2)', () => {
  for (const c of [...parseV2Cases, ...parseV1Cases]) {
    it(caseTitle(c, 'SAV-002'), () => {
      expect(parseMetadata(c.text, MAX_LENGTH)).toStrictEqual(c.expected);
    });
  }
});

describe('reconcileMetadata (schema 2)', () => {
  for (const c of reconcileV2Cases) {
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
      const pages = c.counts.map((count, pageIndex) => ({
        pageIndex, width: 595, height: 842, state: 'done' as const,
        systems: Array.from({ length: count }, (_, i) => ({ x: 40, y: 10 + 50 * i, width: 500, height: 40 })),
      }));
      const text = serializeSchema1({
        schemaVersion: 1, appVersion: 'v1.0.0', pageCount: pages.length, detection: { level: 'standard', pages },
        marks: c.v1, aspectRatio: {},
      });
      const parsed = parseMetadata(text, MAX_LENGTH);
      if (c.id === NOT_A_SCHEMA_1_FILE) {
        expect(parsed).toEqual(parseSchema1(text));
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
