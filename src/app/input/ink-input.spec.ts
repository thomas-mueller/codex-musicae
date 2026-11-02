import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { TUNABLES } from '../../config/tunables';
import { provideTestPorts } from '../../testing/provide-test-ports';
import type { Point, Rect } from '../core';
import { synComposition } from '../core/fixtures/annotation.cases';
import type { DocumentStore } from '../state/document.store';
import { SessionStore } from '../state/session.store';
import { SlideNavStore } from '../state/slide-nav.store';
import { ToolSettingsStore } from '../state/tool-settings.store';
import { UiStore } from '../state/ui.store';
import { InkInput } from './ink-input';
import type { InkSurface } from './ink-input';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));
const STAGE: Rect = { x: 0, y: 0, width: 800, height: 600 };

async function setup() {
  TestBed.configureTestingModule({ providers: provideTestPorts() });
  const session = TestBed.inject(SessionStore);
  await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
  await settle();
  const doc = session.activeDocument() as DocumentStore;
  doc.detection.reset(2);
  const systems = [0, 1, 2].map((i) => ({ x: 50, y: 50 + i * 250, width: 500, height: 150 }));
  for (const pageIndex of [0, 1]) {
    doc.detection.finish(pageIndex, 'done', { pageIndex, width: 600, height: 800, systems });
  }
  const ui = TestBed.inject(UiStore);
  ui.hasDocument.set(true);
  ui.setTool('pen');
  const nav = TestBed.inject(SlideNavStore);
  nav.stage.set({ width: STAGE.width, height: STAGE.height });
  const live = { begin: vi.fn(), add: vi.fn(), clear: vi.fn() };
  const hideStrokes = vi.fn();
  const surface: InkSurface = { composition: () => synComposition, live, hideStrokes };
  const ink = TestBed.inject(InkInput);
  ink.attach(surface);
  /** Client position that shows slide point `p` (view at fit). */
  const clientOf = (p: Point): Point => {
    const scale = nav.displayScale();
    return { x: STAGE.width / 2 + (p.x - synComposition.width / 2) * scale, y: STAGE.height / 2 + (p.y - synComposition.height / 2) * scale };
  };
  const pageHeight = doc.pageInfos()[0]!.box.view[3];
  return { doc, ui, ink, live, surface, hideStrokes, nav, clientOf, pageHeight, strokes: () => doc.strokes() };
}

describe('InkInput', () => {
  it('ANN-009 a stroke belongs to the page of the region where it started and is stored in that page user space', async () => {
    const { ink, doc, clientOf, pageHeight } = await setup();
    expect(ink.begin(clientOf({ x: 50, y: 20 }), STAGE)).toBe(true);
    ink.move([clientOf({ x: 60, y: 30 }), clientOf({ x: 70, y: 40 })]);
    ink.end();
    const [stroke] = doc.strokes();
    expect(stroke?.pageIndex).toBe(0);
    expect(stroke?.points[0]?.x).toBeCloseTo(50, 6);
    expect(stroke?.points[0]?.y).toBeCloseTo(pageHeight - 20, 6);
    expect(stroke?.points.at(-1)?.y).toBeCloseTo(pageHeight - 40, 6);
  });

  it('ANN-009 ANN-010 a stroke started on filler belongs to the filler page and keeps its translation over other regions and beyond the page', async () => {
    const { ink, doc, clientOf, pageHeight } = await setup();
    // (50, 130) lies on the filler of page 1: translation (-10, +40); then over the region of page 0 and outside the slide.
    ink.begin(clientOf({ x: 50, y: 130 }), STAGE);
    ink.move([clientOf({ x: 50, y: 10 }), clientOf({ x: 400, y: 10 })]);
    ink.end();
    const stroke = doc.strokes()[0]!;
    expect(stroke.pageIndex).toBe(1);
    expect(stroke.points[0]?.x).toBeCloseTo(60, 6);
    expect(stroke.points[0]?.y).toBeCloseTo(pageHeight - 90, 6);
    expect(stroke.points[1]?.y).toBeCloseTo(pageHeight - (10 - 40), 6); // over the region, still the filler's translation
    expect(stroke.points.at(-1)?.x).toBeCloseTo(410, 6); // beyond the page edge
  });

  it('ANN-010 a gesture that starts on canvas grey is ignored: no stroke, no events, nothing drawn', async () => {
    const { ink, doc, live, clientOf } = await setup();
    const events: string[] = [];
    doc.changes.subscribe((e) => events.push(e.type));
    expect(ink.begin(clientOf({ x: 150, y: 20 }), STAGE)).toBe(false);
    ink.move([clientOf({ x: 50, y: 20 })]);
    ink.end();
    expect(doc.strokes()).toEqual([]);
    expect(events).toEqual([]);
    expect(live.begin).not.toHaveBeenCalled();
  });

  it('ANN-008 without a tool nothing is drawn', async () => {
    const { ink, ui, clientOf } = await setup();
    ui.setTool(null);
    expect(ink.begin(clientOf({ x: 50, y: 20 }), STAGE)).toBe(false);
  });

  it('ANN-011 consecutive duplicate points are skipped', async () => {
    const { ink, live, clientOf } = await setup();
    const p = clientOf({ x: 50, y: 20 });
    ink.begin(p, STAGE);
    ink.move([p, p, clientOf({ x: 60, y: 20 }), clientOf({ x: 60, y: 20 })]);
    const drawn = live.add.mock.calls.flatMap(([points]) => points as Point[]);
    expect(drawn).toHaveLength(2);
    ink.cancel();
  });

  it('ANN-011 the live layer gets the slide-space points and the tool style; the finished stroke is simplified and committed once', async () => {
    const { ink, doc, live, clientOf } = await setup();
    const settings = TestBed.inject(ToolSettingsStore);
    ink.begin(clientOf({ x: 10, y: 10 }), STAGE);
    expect(live.begin).toHaveBeenCalledWith(settings.style('pen'));
    const line = Array.from({ length: 20 }, (_, i) => clientOf({ x: 10 + i, y: 10 }));
    ink.move(line);
    ink.end();
    expect(doc.strokes()).toHaveLength(1);
    expect(doc.strokes()[0]?.points).toHaveLength(2); // a straight line collapses to its ends (T:annotation.simplifyEpsilonPt)
    expect(doc.history().undo).toHaveLength(1);
    expect(live.clear).toHaveBeenCalled();
    expect(TUNABLES.annotation.simplifyEpsilonPt).toBeGreaterThan(0);
  });

  it('ANN-011 the stroke takes the style of the active tool, with the highlighter opacity and multiply', async () => {
    const { ink, ui, doc, clientOf } = await setup();
    ui.setTool('highlighter');
    ink.begin(clientOf({ x: 10, y: 10 }), STAGE);
    ink.move([clientOf({ x: 40, y: 30 })]);
    ink.end();
    expect(doc.strokes()[0]).toMatchObject({ opacity: TUNABLES.annotation.highlighterOpacity, multiply: true, widthPt: TUNABLES.annotation.highlighterWidthsPt[TUNABLES.annotation.defaultHighlighter.widthIndex] });
  });

  it('ANN-011 a tap makes a dot of two equal points', async () => {
    const { ink, doc, clientOf } = await setup();
    ink.begin(clientOf({ x: 30, y: 30 }), STAGE);
    ink.end();
    const points = doc.strokes()[0]!.points;
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual(points[1]);
  });

  it('ANN-011 each stroke gets its own id', async () => {
    const { ink, doc, clientOf } = await setup();
    for (let i = 0; i < 2; i++) {
      ink.begin(clientOf({ x: 30, y: 30 }), STAGE);
      ink.move([clientOf({ x: 40 + i, y: 50 })]);
      ink.end();
    }
    expect(new Set(doc.strokes().map((s) => s.id)).size).toBe(2);
  });

  it('ANN-011 cancel discards the stroke: nothing added, no undo step, live layer cleared, stroke end reported', async () => {
    const { ink, doc, live, clientOf } = await setup();
    const events: string[] = [];
    doc.changes.subscribe((e) => events.push(e.type));
    ink.begin(clientOf({ x: 30, y: 30 }), STAGE);
    ink.move([clientOf({ x: 40, y: 50 })]);
    ink.cancel();
    expect(doc.strokes()).toEqual([]);
    expect(doc.history().undo).toEqual([]);
    expect(live.clear).toHaveBeenCalled();
    expect(events).toEqual(['strokeStart', 'strokeEnd']);
  });

  it('ANN-013 strokeStart and strokeEnd bracket the stroke, and the commit comes in between', async () => {
    const { ink, doc, clientOf } = await setup();
    const events: string[] = [];
    doc.changes.subscribe((e) => events.push(e.type));
    ink.begin(clientOf({ x: 30, y: 30 }), STAGE);
    ink.move([clientOf({ x: 40, y: 50 })]);
    ink.end();
    expect(events).toEqual(['strokeStart', 'change', 'strokeEnd']);
  });

  it('ANN-011 detaching the surface cancels a running stroke', async () => {
    const { ink, doc, surface, clientOf } = await setup();
    const detach = ink.attach(surface);
    ink.begin(clientOf({ x: 30, y: 30 }), STAGE);
    detach();
    ink.end();
    expect(doc.strokes()).toEqual([]);
  });

  it('ANN-011 a 200-point stroke causes at most 2 change-detection ticks', async () => {
    const { ink, clientOf } = await setup();
    const fixtureLike = TestBed.inject(ApplicationRef);
    await fixtureLike.whenStable();
    const tick = vi.spyOn(fixtureLike, 'tick');
    ink.begin(clientOf({ x: 10, y: 10 }), STAGE);
    for (let i = 0; i < 200; i++) {
      ink.move([clientOf({ x: 10 + i * 0.4, y: 10 + (i % 7) })]);
    }
    ink.end();
    await fixtureLike.whenStable();
    await settle();
    expect(tick.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('InkInput eraser (M14 S4)', () => {
  /** A stroke along slide y = 20 (page 0, placements at dy 0 and dy 120) from x = 40 to x = 60. */
  async function withStroke() {
    const t = await setup();
    t.ui.setTool('eraser');
    const stroke = {
      id: 's1',
      pageIndex: 0,
      points: [{ x: 40, y: t.pageHeight - 20 }, { x: 60, y: t.pageHeight - 20 }],
      color: TUNABLES.colors.penPresets[0] as string,
      widthPt: 2,
      opacity: 1,
      multiply: false,
    };
    t.doc.addStroke(stroke);
    return { ...t, stroke };
  }

  it('ANN-005 a stroke within the hit radius disappears at once and is erased by one undoable step on release', async () => {
    const { ink, doc, hideStrokes, clientOf } = await withStroke();
    expect(ink.begin(clientOf({ x: 50, y: 20 }), STAGE)).toBe(true);
    expect(hideStrokes).toHaveBeenLastCalledWith(new Set(['s1']));
    expect(doc.strokes()).toHaveLength(1); // still in the model until the release
    ink.end();
    expect(doc.strokes()).toEqual([]);
    expect(hideStrokes).toHaveBeenLastCalledWith(new Set());
    doc.undo();
    expect(doc.strokes().map((s) => s.id)).toEqual(['s1']);
  });

  it('ANN-005 several strokes touched in one gesture are one undo step', async () => {
    const { ink, doc, pageHeight, clientOf, stroke } = await withStroke();
    doc.addStroke({ ...stroke, id: 's2', points: [{ x: 40, y: pageHeight - 60 }, { x: 60, y: pageHeight - 60 }] });
    ink.begin(clientOf({ x: 50, y: 20 }), STAGE);
    ink.move([clientOf({ x: 50, y: 40 }), clientOf({ x: 50, y: 60 })]);
    ink.end();
    expect(doc.strokes()).toEqual([]);
    expect(doc.history().undo.at(-1)).toMatchObject({ kind: 'erase' });
    doc.undo();
    expect(doc.strokes().map((s) => s.id).sort()).toEqual(['s1', 's2']);
  });

  it('ANN-005 a gesture that touches nothing makes no action', async () => {
    const { ink, doc, hideStrokes, clientOf } = await withStroke();
    const before = doc.history();
    ink.begin(clientOf({ x: 50, y: 90 }), STAGE);
    ink.move([clientOf({ x: 70, y: 90 })]);
    ink.end();
    expect(hideStrokes).not.toHaveBeenCalledWith(new Set(['s1']));
    expect(doc.history()).toBe(before);
    expect(doc.strokes()).toHaveLength(1);
  });

  it('ANN-012 the stroke is also found at its second placement', async () => {
    const { ink, doc, clientOf } = await withStroke();
    ink.begin(clientOf({ x: 50, y: 140 }), STAGE); // filler-top shows page 0 again, 120 lower
    ink.end();
    expect(doc.strokes()).toEqual([]);
  });

  it('ANN-005 the hit radius is T:annotation.eraserHitRadiusPx on screen: smaller in page units when zoomed', async () => {
    const { ink, doc, nav, hideStrokes, clientOf } = await withStroke();
    const slideDistance = (TUNABLES.annotation.eraserHitRadiusPx / nav.displayScale()) * 0.75;
    // 0.75 of the radius at fit zoom touches the stroke ...
    ink.begin(clientOf({ x: 50, y: 20 + slideDistance }), STAGE);
    expect(hideStrokes).toHaveBeenLastCalledWith(new Set(['s1']));
    ink.cancel();
    expect(doc.strokes()).toHaveLength(1);
    // ... but at zoom 2 the radius is half as large in page units, so it does not.
    doc.slideView.set({ zoom: 2, panX: 0, panY: 0 });
    const scale = nav.displayScale() * 2;
    const client = { x: STAGE.width / 2 + (50 - synComposition.width / 2) * scale, y: STAGE.height / 2 + (20 + slideDistance - synComposition.height / 2) * scale };
    hideStrokes.mockClear();
    ink.begin(client, STAGE);
    expect(hideStrokes).not.toHaveBeenCalled();
    ink.end();
    expect(doc.strokes()).toHaveLength(1);
  });

  it('ANN-005 the gesture may start on the grey and still touches strokes it moves over', async () => {
    const { ink, doc, clientOf } = await withStroke();
    expect(ink.begin(clientOf({ x: 150, y: 20 }), STAGE)).toBe(true);
    ink.move([clientOf({ x: 100, y: 20 }), clientOf({ x: 50, y: 20 })]);
    ink.end();
    expect(doc.strokes()).toEqual([]);
  });

  it('ANN-005 cancel shows the strokes again and changes nothing', async () => {
    const { ink, doc, hideStrokes, clientOf } = await withStroke();
    ink.begin(clientOf({ x: 50, y: 20 }), STAGE);
    ink.cancel();
    expect(hideStrokes).toHaveBeenLastCalledWith(new Set());
    expect(doc.strokes()).toHaveLength(1);
    expect(doc.history().undo).toHaveLength(1);
  });

  it('ANN-013 the eraser gesture is bracketed by stroke start and end, with the erase in between', async () => {
    const { ink, doc, clientOf } = await withStroke();
    const events: string[] = [];
    doc.changes.subscribe((e) => events.push(e.type));
    ink.begin(clientOf({ x: 50, y: 20 }), STAGE);
    ink.end();
    expect(events).toEqual(['strokeStart', 'change', 'strokeEnd']);
  });

  it('ANN-005 the eraser only ever removes strokes of the model', async () => {
    const { ink, doc, live, clientOf } = await withStroke();
    ink.begin(clientOf({ x: 50, y: 20 }), STAGE);
    ink.end();
    expect(live.begin).not.toHaveBeenCalled();
    expect(doc.strokes()).toEqual([]);
  });
});
