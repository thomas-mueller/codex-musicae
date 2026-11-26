import { describe, expect, it } from 'vitest';

import { addMark, EMPTY_SYSTEM_MARKS, removeMarksOfSystem, rerunPage } from './marks';
import type { FileRef, NewMark, SystemMarks, SystemRef } from './marks';
import { serializeMetadata as serializeSchema1 } from './metadata';
import { parseMetadata, serializeMetadata } from './metadata-v2';
import type { EmbeddedMetadata } from './metadata-v2';
import type { V1Marks } from './migrate-v1';
import { derivePlayingOrderInput, forcedBreaks, generatePlayingOrder, isValidJump } from './playing-order';
import type { PlayingOrderInput } from './playing-order';
import { seededRandom } from '../../testing/seeded-random';
import type { SeededRandom } from '../../testing/seeded-random';

const MAX_LENGTH = 20000;
const RUNS = 400;
const FIRST_EDIT_SEED = 0x51a7;
const FIRST_V1_SEED = 0x2c93;
const MAX_PAGES = 5;
const MAX_PER_PAGE = 5;
const MAX_EDITS = 40;
const TEXTS = [undefined, '', 'Segno', ' ', 'a "quote" \\ and ×2 -> 1:1'];

const layout = (random: SeededRandom): number[] => Array.from({ length: 1 + random.below(MAX_PAGES) }, () => random.below(MAX_PER_PAGE + 1));

const asMetadata = (marks: SystemMarks, pageCount: number): EmbeddedMetadata => ({
  schemaVersion: 2, appVersion: 'v', pageCount, detection: null, marks, aspectRatio: {},
});

function reread(text: string) {
  const parsed = parseMetadata(text, MAX_LENGTH);
  if (parsed.kind !== 'ok') {
    throw new Error(`not readable: ${JSON.stringify(parsed)} in ${text}`);
  }
  return parsed;
}

/** A system of the layout, now and then one that does not exist (the edit is then rejected). */
function anySystem(random: SeededRandom, counts: readonly number[]): SystemRef {
  const pageIndex = random.below(counts.length);
  return { pageIndex, system: 1 + random.below((counts[pageIndex] ?? 0) + 1) };
}

const otherFile = (random: SeededRandom): FileRef => ({ file: `part ${random.below(3)}.pdf`, pageIndex: random.below(9), system: 1 + random.below(9) });

function newMark(random: SeededRandom, counts: readonly number[]): NewMark {
  const text = TEXTS[random.below(TEXTS.length)];
  const withText = text === undefined ? {} : { text };
  const at = anySystem(random, counts);
  switch (random.below(5)) {
    case 0:
      return { kind: 'jump', from: at, to: random.chance(0.2) ? otherFile(random) : anySystem(random, counts), pass: 1 + random.below(3), ...withText };
    case 1:
      return { kind: 'bookmark', at, ...(random.chance(0.4) ? { ref: otherFile(random) } : {}), ...withText };
    case 2:
      return { kind: 'start', at, ...withText };
    case 3:
      return { kind: 'stop', at, ...withText };
    default:
      return { kind: 'break', at, ...withText };
  }
}

/** Random marks, with systems being deleted and pages being rerun in between. */
function editedMarks(random: SeededRandom): { marks: SystemMarks; counts: number[] } {
  const counts = layout(random);
  let marks = EMPTY_SYSTEM_MARKS;
  for (let edit = random.below(MAX_EDITS); edit > 0; edit--) {
    const pageIndex = random.below(counts.length);
    const count = counts[pageIndex] ?? 0;
    if (random.chance(0.08) && count > 0) {
      marks = removeMarksOfSystem(marks, { pageIndex, system: 1 + random.below(count) });
      counts[pageIndex] = count - 1;
    } else if (random.chance(0.04)) {
      const rerun = random.below(MAX_PER_PAGE + 1);
      marks = rerunPage(marks, pageIndex, count, rerun);
      counts[pageIndex] = rerun;
    } else {
      marks = addMark(marks, newMark(random, counts), counts) ?? marks;
    }
  }
  return { marks, counts };
}

describe('schema 2 round trip over random mark edits', () => {
  it(`SAV-015 MRK-013 MRK-014 ${RUNS} seeded edit sequences are read back unchanged`, () => {
    let marked = 0;
    for (let seed = FIRST_EDIT_SEED; seed < FIRST_EDIT_SEED + RUNS; seed++) {
      const { marks, counts } = editedMarks(seededRandom(seed));
      const parsed = reread(serializeMetadata(asMetadata(marks, counts.length)));
      expect(parsed.value.marks, `seed ${seed}`).toStrictEqual(marks);
      marked += marks.jumps.length > 0 && marks.stops.length + marks.breaks.length > 0 ? 1 : 0;
    }
    // guards against a generator that no longer produces anything worth reading back
    expect(marked).toBeGreaterThan(RUNS / 4);
  });
});

/** V1 marks as the V1 app could store them: any valid jumps, breaks and stops at the inner junctions. */
function v1Marks(random: SeededRandom, n: number): V1Marks {
  const jumps = Array.from({ length: random.below(6) }, (_, i) => ({
    id: i + 1, origin: random.below(n + 1), target: random.below(n + 1), pass: 1 + random.below(3),
  })).filter((jump) => isValidJump(jump, n));
  const inner = (): number[] => Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1).filter(() => random.chance(0.12));
  return { jumps, breaks: inner(), stops: inner().slice(0, 2), nextJumpId: 7 };
}

function played(input: PlayingOrderInput, breaks: readonly number[]) {
  const order = generatePlayingOrder(input);
  return { entries: order.entries, forced: forcedBreaks(order, new Set(breaks)) };
}

function playedFrom(marks: SystemMarks, counts: readonly number[]) {
  const input = derivePlayingOrderInput(marks, counts, MAX_LENGTH);
  return played(input, input.breaks);
}

describe('schema 1 to schema 2 over random V1 marks', () => {
  it(`SAV-016 PLY-014 ${RUNS} seeded V1 files keep the migrated playing order through a save`, () => {
    let withoutEdges = 0;
    for (let seed = FIRST_V1_SEED; seed < FIRST_V1_SEED + RUNS; seed++) {
      const random = seededRandom(seed);
      const counts = layout(random);
      const n = counts.reduce((sum, count) => sum + count, 0);
      const old = v1Marks(random, n);
      const pages = counts.map((count, pageIndex) => ({
        pageIndex, width: 595, height: 842, state: 'done' as const,
        systems: Array.from({ length: count }, (_, i) => ({ x: 40, y: 10 + 50 * i, width: 500, height: 40 })),
      }));
      const first = reread(serializeSchema1({
        schemaVersion: 1, appVersion: 'v', pageCount: counts.length, detection: { level: 'standard', pages }, marks: old, aspectRatio: {},
      }));
      const second = reread(serializeMetadata(first.value));
      expect(second.value, `seed ${seed}`).toStrictEqual(first.value);
      expect(playedFrom(second.value.marks, counts), `seed ${seed}`).toEqual(playedFrom(first.value.marks, counts));
      if (old.jumps.every((jump) => jump.origin > 0 && jump.target < n)) {
        withoutEdges++;
        const before = played({ systemCount: n, jumps: old.jumps, stops: old.stops, maxLength: MAX_LENGTH }, old.breaks);
        expect(playedFrom(second.value.marks, counts), `seed ${seed}`).toEqual(before);
      }
    }
    expect(withoutEdges).toBeGreaterThan(RUNS / 10);
  });
});
