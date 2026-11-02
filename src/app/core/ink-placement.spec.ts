import { describe, expect, it } from 'vitest';

import type { InkStroke } from './annotation';
import { userPointToSlide } from './annotation';
import { synComposition } from './fixtures/annotation.cases';
import type { PageBox, Point } from './geometry';
import { placeStrokes } from './ink-placement';

const DIGITS = 9;
const BOX: PageBox = { view: [0, 0, 100, 200], rotate: 0 };
const BOX_90: PageBox = { view: [0, 0, 100, 200], rotate: 90 };

/** User-space points of a page of height 200 (rotate 0): display y = 200 - user y. */
function stroke(id: string, pageIndex: number, points: Point[], widthPt = 2): InkStroke {
  return { id, pageIndex, points, color: '#D32F2F', widthPt, opacity: 1, multiply: false };
}

const byPage = (strokes: InkStroke[]) => (pageIndex: number) => strokes.filter((s) => s.pageIndex === pageIndex);

describe('placeStrokes', () => {
  it('ANN-012 a stroke on a page shown twice is placed in each placement', () => {
    // SYN: page 0 is placed at (0,0) and (0,120); display y 20 -> slide y 20 and 140.
    const a = stroke('a', 0, [{ x: 10, y: 180 }, { x: 40, y: 180 }]);
    const placed = placeStrokes(synComposition, byPage([a]), () => BOX);
    expect(placed).toHaveLength(2);
    expect(placed.map((p) => p.stroke.id)).toEqual(['a', 'a']);
    expect(placed.map((p) => p.points[0]?.y)).toEqual([20, 140]);
  });

  it('ANN-012 a stroke on a page shown once is placed once, and other pages are not drawn', () => {
    const b = stroke('b', 1, [{ x: 20, y: 150 }, { x: 30, y: 150 }]); // page 1 placed at (-10, +40)... dy 40, dx -10
    const a = stroke('a', 0, [{ x: 10, y: 180 }, { x: 40, y: 180 }]);
    const placed = placeStrokes(synComposition, byPage([a, b]), () => BOX);
    expect(placed.filter((p) => p.stroke.id === 'b')).toHaveLength(1);
    const only = placeStrokes(synComposition, byPage([b]), () => BOX);
    expect(only.every((p) => p.stroke.pageIndex === 1)).toBe(true);
    expect(placeStrokes(synComposition, byPage([stroke('z', 7, [{ x: 1, y: 1 }, { x: 2, y: 2 }])]), () => BOX)).toEqual([]);
  });

  it('SAV-007 points are mapped with userPointToSlide of the placement', () => {
    const s = stroke('s', 1, [{ x: 20, y: 150 }, { x: 30, y: 140 }]);
    const [placed] = placeStrokes(synComposition, byPage([s]), () => BOX);
    const placement = { pageIndex: 1, dx: -10, dy: 40 };
    s.points.forEach((p, i) => {
      const expected = userPointToSlide(placement, BOX, p);
      expect(placed?.points[i]?.x).toBeCloseTo(expected.x, DIGITS);
      expect(placed?.points[i]?.y).toBeCloseTo(expected.y, DIGITS);
    });
  });

  it('SAV-007 a rotated page is mapped through its box', () => {
    const s = stroke('s', 0, [{ x: 10, y: 20 }, { x: 30, y: 40 }]);
    const [placed] = placeStrokes(synComposition, byPage([s]), () => BOX_90);
    // rotate 90: display = (y - y0, x - x0)
    expect(placed?.points[0]).toEqual({ x: 20, y: 10 });
  });

  it('ANN-009 a stroke whose bounds miss the slide is left out', () => {
    // display y -500 -> far above the slide in both placements
    const away = stroke('away', 0, [{ x: 10, y: 700 }, { x: 40, y: 700 }]);
    expect(placeStrokes(synComposition, byPage([away]), () => BOX)).toEqual([]);
  });

  it('ANN-009 a stroke that only partly overlaps the slide is kept, and the stroke width counts', () => {
    const partly = stroke('partly', 0, [{ x: -50, y: 180 }, { x: 40, y: 180 }]);
    expect(placeStrokes(synComposition, byPage([partly]), () => BOX)).toHaveLength(2);
    const edge = stroke('edge', 0, [{ x: -3, y: 180 }, { x: -2, y: 180 }], 10); // right edge at x = 3 after the margin
    expect(placeStrokes(synComposition, byPage([edge]), () => BOX)).toHaveLength(2);
    const outside = stroke('outside', 0, [{ x: -30, y: 180 }, { x: -20, y: 180 }], 10);
    expect(placeStrokes(synComposition, byPage([outside]), () => BOX)).toEqual([]);
  });

  it('ANN-012 strokes keep their order within a placement; pages without a box are skipped', () => {
    const first = stroke('1', 1, [{ x: 20, y: 150 }, { x: 30, y: 150 }]);
    const second = stroke('2', 1, [{ x: 20, y: 140 }, { x: 30, y: 140 }]);
    const placed = placeStrokes(synComposition, byPage([first, second]), () => BOX);
    expect(placed.map((p) => p.stroke.id)).toEqual(['1', '2']);
    expect(placeStrokes(synComposition, byPage([first]), () => undefined)).toEqual([]);
  });

  it('ANN-012 an empty list gives nothing', () => {
    expect(placeStrokes(synComposition, () => [], () => BOX)).toEqual([]);
  });
});
