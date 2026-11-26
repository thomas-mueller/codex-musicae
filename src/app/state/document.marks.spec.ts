import { EMPTY_SYSTEM_MARKS, migrateMarksV1, parseMetadata, serializeMetadata } from '../core';
import type { EmbeddedMetadata, SystemMarks, V1Marks } from '../core';
import { TUNABLES } from '../../config/tunables';
import { DetectionRun } from './detection-run';
import { DocumentStore } from './document.store';
import { fakeRenderer } from './testing/fake-renderer';

const PAGES = 2;
const PER_PAGE = 2;
const MAX_LENGTH = TUNABLES.playingOrder.maxLength;
const SIZE = { width: 600, height: 800 };
const boxes = (count: number) => Array.from({ length: count }, (_, i) => ({ x: 40, y: 20 + 150 * i, width: 500, height: 100 }));
const detected = (pageIndex: number, count = PER_PAGE) => ({ pageIndex, ...SIZE, systems: boxes(count) });
const at = (pageIndex: number, system: number) => ({ pageIndex, system });
const FOREIGN = { file: 'Coda.pdf', pageIndex: 0, system: 1 };

async function readyDoc(): Promise<DocumentStore> {
  const doc = new DocumentStore('t1', fakeRenderer('invalid', PAGES));
  await doc.load(new Uint8Array([1]));
  return doc;
}

const metadata = (marks: SystemMarks, withDetection = true): EmbeddedMetadata => ({
  schemaVersion: 2,
  appVersion: 'v',
  pageCount: PAGES,
  detection: withDetection ? { level: 'standard', pages: [0, 1].map((i) => ({ ...detected(i), state: 'done' as const })) } : null,
  marks,
  aspectRatio: {},
});

/** Two pages of two systems each, found one page after the other. */
function finish(doc: DocumentStore, counts: readonly number[] = [PER_PAGE, PER_PAGE]): void {
  doc.detection.reset(PAGES);
  counts.forEach((count, i) => doc.detection.finish(i, 'done', detected(i, count)));
}

describe('DocumentStore marks on systems', () => {
  const WITH_START: SystemMarks = { ...EMPTY_SYSTEM_MARKS, start: { at: at(1, 1) } };

  it('PLY-015 the start mark of a file decides the order, the slides and the first position', async () => {
    const doc = await readyDoc();
    doc.hydrateFromMetadata(metadata(WITH_START));
    expect(doc.playingOrder().entries).toEqual([3, 4]);
    expect(doc.numbers()).toEqual([[], [], [1], [2]]);
    expect(doc.position()).toEqual({ entry: 0, system: 3 });
    expect(doc.slides()[0]?.regions[0]?.firstSystem).toBe(3);
  });

  it('PLY-015 marks are placed in the order that begins at the start mark', async () => {
    const doc = await readyDoc();
    doc.hydrateFromMetadata(metadata({ ...WITH_START, breaks: [{ at: at(1, 1) }] }));
    expect(doc.markPositions().breaks.get(3)).toMatchObject({ previous: 1, next: 2 });
    expect(doc.forcedBreakAfter()).toEqual([true]);
  });

  it('SAV-015 marks the chips cannot show survive an edit and are saved', async () => {
    const hidden: SystemMarks = {
      ...EMPTY_SYSTEM_MARKS,
      start: { at: at(0, 2), text: 'Intro' },
      bookmarks: [{ id: 1, at: at(1, 1), ref: FOREIGN }],
      jumps: [{ id: 1, from: at(0, 1), to: FOREIGN, pass: 1 }],
      nextJumpId: 2,
      nextBookmarkId: 2,
    };
    const doc = await readyDoc();
    doc.hydrateFromMetadata(metadata(hidden));
    expect(doc.marks().jumps).toEqual([]);
    doc.toggleBreak(2);
    doc.clearJunction(1);
    const saved = parseMetadata(serializeMetadata(doc.buildMetadata('v')), MAX_LENGTH);
    expect(saved.kind === 'ok' ? saved.value.marks : null).toStrictEqual({ ...hidden, breaks: [{ at: at(0, 2) }] });
  });

  it('SAV-015 marks saved during a detection are kept and apply when their systems are found', async () => {
    const doc = await readyDoc();
    doc.hydrateFromMetadata(metadata({ ...EMPTY_SYSTEM_MARKS, stops: [{ at: at(1, 1) }] }, false));
    expect(doc.marks().stops).toEqual([]);
    finish(doc);
    expect(doc.marks().stops).toEqual([3]);
    expect(doc.marksPending()).toBe(false);
  });
});

describe('DocumentStore while V1 marks wait for detection', () => {
  const V1: V1Marks = { jumps: [{ id: 1, origin: 3, target: 0, pass: 1 }], breaks: [1], stops: [], nextJumpId: 2 };
  const MIGRATED = migrateMarksV1(V1, [PER_PAGE, PER_PAGE], MAX_LENGTH);

  async function waitingDoc(): Promise<DocumentStore> {
    const doc = await readyDoc();
    doc.hydrateFromMetadata(metadata(EMPTY_SYSTEM_MARKS, false), V1);
    doc.detection.reset(PAGES);
    doc.detection.finish(0, 'done', detected(0));
    return doc;
  }

  it('SAV-016 the marks wait while a page is still to be detected', async () => {
    const doc = await waitingDoc();
    expect(doc.marksPending()).toBe(true);
    expect(doc.marks().jumps).toEqual([]);
    expect(doc.lastRejected()).toBeNull();
  });

  const edits: ReadonlyArray<[string, (doc: DocumentStore) => unknown]> = [
    ['adding a jump', (doc) => doc.addJump({ origin: 2, target: 0, pass: 1 })],
    ['removing a jump', (doc) => doc.removeJump(1)],
    ['changing a jump', (doc) => doc.updateJump(1, { pass: 2 })],
    ['toggling a break', (doc) => doc.toggleBreak(1)],
    ['toggling a stop', (doc) => doc.toggleStop(1)],
    ['clearing a bar', (doc) => doc.clearJunction(1)],
  ];
  for (const [name, edit] of edits) {
    it(`SAV-016 ${name} is rejected meanwhile`, async () => {
      const doc = await waitingDoc();
      edit(doc);
      expect(doc.lastRejected()).not.toBeNull();
      expect(doc.systemMarks()).toStrictEqual(EMPTY_SYSTEM_MARKS);
      expect(doc.marksPending()).toBe(true);
    });
  }

  it('SAV-016 drawing works meanwhile', async () => {
    const doc = await waitingDoc();
    doc.addStroke({ id: 'a', pageIndex: 0, points: [{ x: 1, y: 1 }], color: '#000000', widthPt: 1, opacity: 1, multiply: false });
    expect(doc.strokes()).toHaveLength(1);
    expect(doc.lastRejected()).toBeNull();
  });

  it('SAV-016 they are migrated when the detection finishes, and can then be edited', async () => {
    const doc = await waitingDoc();
    doc.detection.finish(1, 'done', detected(1));
    expect(doc.marksPending()).toBe(false);
    expect(doc.systemMarks()).toStrictEqual(MIGRATED);
    expect(doc.marks().jumps).toEqual([{ id: 1, origin: 3, target: 0, pass: 1 }]);
    doc.toggleStop(2);
    expect(doc.lastRejected()).toBeNull();
    expect(doc.marks().stops).toEqual([2]);
    expect(doc.marks().breaks).toEqual([1]);
  });

  it('SAV-016 migrated marks stay while a re-run is going on', async () => {
    const doc = await waitingDoc();
    doc.detection.finish(1, 'done', detected(1));
    doc.candidate.set(new DetectionRun());
    expect(doc.marksPending()).toBe(false);
    expect(doc.systemMarks()).toStrictEqual(MIGRATED);
  });

  it('SAV-016 a detection without any system keeps them waiting', async () => {
    const doc = await readyDoc();
    doc.hydrateFromMetadata(metadata(EMPTY_SYSTEM_MARKS, false), V1);
    doc.detection.reset(PAGES);
    doc.detection.finish(0, 'failed', null);
    doc.detection.finish(1, 'done', detected(1, 0));
    expect(doc.marksPending()).toBe(true);
  });

  it('SAV-016 opening other data ends the wait', async () => {
    const doc = await waitingDoc();
    doc.hydrateFromMetadata(metadata(EMPTY_SYSTEM_MARKS, false));
    expect(doc.marksPending()).toBe(false);
  });
});
