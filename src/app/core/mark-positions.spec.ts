import { describe, expect, it } from 'vitest';

import { EMPTY_MARKS } from './edits';
import type { DocMarks } from './edits';
import { generatePlayingOrderCases } from './fixtures/playing-order.cases';
import { markPositions, replayArrivals } from './mark-positions';

const MAX = 20000;
const marks = (over: Partial<DocMarks>): DocMarks => ({ ...EMPTY_MARKS, ...over, nextJumpId: (over.jumps?.length ?? 0) + 1 });

describe('replayArrivals', () => {
  for (const c of generatePlayingOrderCases) {
    it(`PLY-002 ${c.id}: the replay keeps as many systems as the playing order (${c.name})`, () => {
      const jumps = c.input.jumps.map((j, i) => ({ ...j, id: i + 1 }));
      const replay = replayArrivals({ ...EMPTY_MARKS, jumps, stops: [...c.input.stops] }, c.input.systemCount, c.input.maxLength);
      expect(replay.entryCount).toBe(c.expected.entries.length);
    });
  }
});

describe('markPositions', () => {
  it('ORG-018 a jump sits between the system played before and the one played next, as playing-order numbers', () => {
    // 1 2 3 4 | jump 4 -> 0 | 1 2 3 4: the jump fires after the 4th system played, the 5th is the repeated first system.
    const positions = markPositions(marks({ jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }] }), 4, MAX);
    expect(positions.jumps.get(1)).toMatchObject({ previous: 4, next: 5 });
  });

  it('ORG-018 a jump of the second pass is met at the second arrival', () => {
    const positions = markPositions(marks({ jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }, { origin: 2, target: 1, pass: 2, id: 2 }] }), 4, MAX);
    // 1 2 3 4 | 1 2 | -> 1 | 2 ...: the second arrival at 2 is after 6 systems, the next one played is the 7th.
    expect(positions.jumps.get(2)).toMatchObject({ previous: 6, next: 7 });
  });

  it('ORG-018 a jump at the very start has no previous system; a jump to the end has no next one', () => {
    const start = markPositions(marks({ jumps: [{ origin: 0, target: 2, pass: 1, id: 1 }] }), 4, MAX);
    expect(start.jumps.get(1)).toMatchObject({ previous: null, next: 1 });
    const end = markPositions(marks({ jumps: [{ origin: 2, target: 4, pass: 1, id: 1 }] }), 4, MAX);
    expect(end.jumps.get(1)).toMatchObject({ previous: 2, next: null });
  });

  it('ORG-021 a slide break is met where its junction is first arrived at', () => {
    const positions = markPositions(marks({ breaks: [3] }), 4, MAX);
    expect(positions.breaks.get(3)).toMatchObject({ previous: 3, next: 4 });
  });

  it('ORG-021 a stop ends the order after the system played before it and has no next system', () => {
    const positions = markPositions(marks({ stops: [2] }), 4, MAX);
    expect(positions.stops.get(2)).toMatchObject({ previous: 2, next: null });
  });

  it('PLY-008 a stop acts at its last arrival: a repeated junction is passed before it', () => {
    const positions = markPositions(marks({ jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }], stops: [2] }), 4, MAX);
    expect(positions.stops.get(2)).toMatchObject({ previous: 6, next: null }); // 1 2 3 4 1 2 | stop
  });

  it('ORG-021 marks that are never reached are missing: behind a stop, shadowed, never arrived at', () => {
    const positions = markPositions(
      marks({ jumps: [{ origin: 4, target: 3, pass: 1, id: 1 }, { origin: 3, target: 0, pass: 9, id: 2 }], breaks: [3], stops: [2] }),
      4,
      MAX,
    );
    // 1 2 | stop at 2: the jump at 4, the break at 3 and the jump with pass 9 all lie behind it or never fire.
    expect([...positions.jumps.keys()]).toEqual([]);
    expect([...positions.breaks.keys()]).toEqual([]);
    expect(positions.stops.get(2)).toMatchObject({ previous: 2, next: null });
  });

  it('ORG-021 a jump shadowed by an earlier jump with the same origin and pass is not reached', () => {
    const positions = markPositions(marks({ jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }, { origin: 4, target: 2, pass: 1, id: 2 }] }), 4, MAX);
    expect([...positions.jumps.keys()]).toEqual([1]);
  });

  it('ORG-021 the arrival index orders the marks as they are played', () => {
    const positions = markPositions(marks({ jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }], breaks: [3], stops: [] }), 4, MAX);
    expect(positions.breaks.get(3)!.index).toBeLessThan(positions.jumps.get(1)!.index);
  });
});
