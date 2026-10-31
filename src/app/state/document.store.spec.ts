import { TUNABLES } from '../../config/tunables';
import { EMPTY_MARKS } from '../core';
import { generatePlayingOrderCases, systemNumbersCases, forcedBreaksCases } from '../core/fixtures/playing-order.cases';
import { DocumentStore } from './document.store';
import { fakeRenderer } from './testing/fake-renderer';

describe('DocumentStore', () => {
  it('FIL-005 starts loading and becomes ready with page infos', async () => {
    const renderer = fakeRenderer();
    const doc = new DocumentStore('t1', renderer);
    expect(doc.status()).toBe('loading');
    await doc.load(new Uint8Array([1]));
    expect(doc.status()).toBe('ready');
    expect(doc.pageInfos().map((p) => p.pageIndex)).toEqual([0, 1]);
    expect(doc.handle()).toBe(renderer.handles[0]);
  });

  for (const code of ['invalid', 'encrypted', 'empty'] as const) {
    it(`FIL-009 ${code} document ends in error state with its code`, async () => {
      const doc = new DocumentStore('t1', fakeRenderer(code));
      await doc.load(new Uint8Array([0]));
      expect(doc.status()).toBe('error');
      expect(doc.errorCode()).toBe(code);
      expect(doc.handle()).toBeNull();
    });
  }

  it('FIL-009 dispose destroys the handle once', async () => {
    const renderer = fakeRenderer();
    const doc = new DocumentStore('t1', renderer);
    await doc.load(new Uint8Array([1]));
    await doc.dispose();
    await doc.dispose();
    expect(renderer.handles[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(doc.handle()).toBeNull();
  });

  it('ORG-006 zoom and scroll default to fit-width at the top and are kept per document', () => {
    const a = new DocumentStore('a', fakeRenderer());
    const b = new DocumentStore('b', fakeRenderer());
    expect(a.orgZoom()).toBe(1);
    expect(a.orgScroll()).toEqual({ x: 0, y: 0 });
    a.orgZoom.set(2);
    a.orgScroll.set({ x: 5, y: 700 });
    expect(b.orgZoom()).toBe(1);
    expect(b.orgScroll()).toEqual({ x: 0, y: 0 });
    expect(a.orgScroll()).toEqual({ x: 5, y: 700 });
  });

  describe('marks (M11 S1)', () => {
    /** A document whose detection holds `n` systems, one per page strip of height 100 on a single page. */
    function docWithSystems(n: number): DocumentStore {
      const doc = new DocumentStore('m', fakeRenderer());
      doc.detection.reset(1);
      const systems = Array.from({ length: n }, (_, i) => ({ x: 0, y: i * 100 + 10, width: 100, height: 80 }));
      doc.detection.finish(0, 'done', { pageIndex: 0, width: 100, height: n * 100, systems });
      return doc;
    }

    it('ORG-017 starts empty and accepts several jumps with the same origin and pass', () => {
      const doc = docWithSystems(4);
      expect(doc.marks()).toEqual(EMPTY_MARKS);
      expect(doc.addJump({ origin: 2, target: 0, pass: 1 })).toBe(1);
      expect(doc.addJump({ origin: 2, target: 3, pass: 1 })).toBe(2);
      expect(doc.marks().jumps.map((j) => j.id)).toEqual([1, 2]);
      expect(doc.lastRejected()).toBeNull();
    });

    it('ORG-024 deleting is immediate and ids are not reused', () => {
      const doc = docWithSystems(4);
      doc.addJump({ origin: 2, target: 0, pass: 1 });
      doc.toggleBreak(2);
      doc.clearJunction(2);
      expect(doc.marks().jumps).toEqual([]);
      expect(doc.marks().breaks).toEqual([]);
      expect(doc.addJump({ origin: 1, target: 3, pass: 1 })).toBe(2);
      doc.removeJump(2);
      expect(doc.marks().jumps).toEqual([]);
      expect(doc.marks().nextJumpId).toBe(3);
    });

    it('ORG-017 invalid edits leave the marks unchanged and set lastRejected', () => {
      const doc = docWithSystems(4);
      doc.addJump({ origin: 2, target: 0, pass: 1 });
      const before = doc.marks();
      expect(doc.addJump({ origin: 2, target: 2, pass: 1 })).toBeNull();
      const first = doc.lastRejected();
      expect(first).not.toBeNull();
      doc.updateJump(1, { pass: 0 });
      doc.updateJump(99, { pass: 2 });
      doc.toggleBreak(0);
      doc.toggleStop(4);
      expect(doc.marks()).toBe(before);
      expect(doc.lastRejected()).not.toBe(first);
      doc.clearRejected();
      expect(doc.lastRejected()).toBeNull();
    });

    it('ORG-017 valid toggles and updates change the marks', () => {
      const doc = docWithSystems(4);
      doc.addJump({ origin: 2, target: 0, pass: 1 });
      doc.updateJump(1, { pass: 2 });
      doc.toggleBreak(3);
      doc.toggleBreak(1);
      doc.toggleStop(2);
      expect(doc.marks()).toEqual({
        jumps: [{ origin: 2, target: 0, pass: 2, id: 1 }], breaks: [1, 3], stops: [2], nextJumpId: 2,
      });
      expect(doc.lastRejected()).toBeNull();
    });

    // The store uses the tunable cap, so fixtures with a smaller cap are covered by the core spec only.
    for (const c of generatePlayingOrderCases.filter((f) => f.input.maxLength === TUNABLES.playingOrder.maxLength)) {
      it(`PLY-002 ${c.id}: playingOrder from marks equal to the fixture input`, () => {
        const doc = docWithSystems(c.input.systemCount);
        c.input.jumps.forEach((j) => expect(doc.addJump(j)).not.toBeNull());
        c.input.stops.forEach((j) => doc.toggleStop(j));
        expect(doc.playingOrder().entries).toEqual(c.expected.entries);
      });
    }

    for (const c of systemNumbersCases) {
      it(`PLY-010 ${c.id}: numbers from marks equal to the fixture input`, () => {
        const doc = docWithSystems(c.input.systemCount);
        c.input.jumps.forEach((j) => doc.addJump(j));
        c.input.stops.forEach((j) => doc.toggleStop(j));
        expect(doc.numbers()).toEqual(c.expected);
      });
    }

    for (const c of forcedBreaksCases) {
      it(`PLY-011 ${c.id}: forcedBreakAfter from marks equal to the fixture input`, () => {
        const doc = docWithSystems(c.input.systemCount);
        c.input.jumps.forEach((j) => doc.addJump(j));
        c.input.stops.forEach((j) => doc.toggleStop(j));
        c.breaks.forEach((j) => doc.toggleBreak(j));
        expect(doc.forcedBreakAfter()).toEqual(c.expected);
      });
    }
  });
});
