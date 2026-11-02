import { vi } from 'vitest';

import type { InkStroke, PlacedStroke } from '../../core';
import { drawPlaced } from './ink-draw';
import type { InkContext } from './ink-draw';

function fake() {
  const calls: string[] = [];
  const context = {
    lineCap: 'butt',
    lineJoin: 'miter',
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    beginPath: vi.fn(() => calls.push('begin')),
    moveTo: vi.fn((x: number, y: number) => calls.push(`M${x},${y}`)),
    lineTo: vi.fn((x: number, y: number) => calls.push(`L${x},${y}`)),
    quadraticCurveTo: vi.fn((cx: number, cy: number, x: number, y: number) => calls.push(`Q${cx},${cy},${x},${y}`)),
    stroke: vi.fn(() => calls.push('stroke')),
  };
  return { context: context as unknown as InkContext & typeof context, calls };
}

function placed(id: string, points: Array<[number, number]>, over: Partial<InkStroke> = {}): PlacedStroke {
  const stroke: InkStroke = { id, pageIndex: 0, points: [], color: '#D32F2F', widthPt: 3, opacity: 1, multiply: false, ...over };
  return { stroke, points: points.map(([x, y]) => ({ x, y })), bounds: { x: 0, y: 0, width: 1, height: 1 } };
}

const NONE: ReadonlySet<string> = new Set();

describe('drawPlaced', () => {
  it('ANN-012 draws with round caps and joins at widthPt × pxPerUnit in the stroke color', () => {
    const { context } = fake();
    drawPlaced(context, [placed('a', [[0, 0], [1, 1]])], { x: 0, y: 0 }, 2, 'pen', NONE);
    expect(context.lineCap).toBe('round');
    expect(context.lineJoin).toBe('round');
    expect(context.strokeStyle).toBe('#D32F2F');
    expect(context.lineWidth).toBe(6);
  });

  it('ANN-012 a line is smoothed with quadratic curves through the midpoints and ends on the last point', () => {
    const { context, calls } = fake();
    drawPlaced(context, [placed('a', [[0, 0], [10, 0], [10, 10], [20, 10]])], { x: 0, y: 0 }, 1, 'pen', NONE);
    expect(calls).toEqual(['begin', 'M0,0', 'Q10,0,10,5', 'Q10,10,15,10', 'L20,10', 'stroke']);
  });

  it('ANN-012 two points are a straight segment, two equal points a dot', () => {
    const { context, calls } = fake();
    drawPlaced(context, [placed('a', [[3, 4], [3, 4]])], { x: 0, y: 0 }, 1, 'pen', NONE);
    expect(calls).toEqual(['begin', 'M3,4', 'L3,4', 'stroke']);
  });

  it('NFR-002 points are relative to the canvas origin and scaled to pixels', () => {
    const { context, calls } = fake();
    drawPlaced(context, [placed('a', [[110, 220], [120, 230]])], { x: 100, y: 200 }, 4, 'pen', NONE);
    expect(calls).toEqual(['begin', 'M40,80', 'L80,120', 'stroke']);
  });

  it('ANN-004 the highlighter uses its opacity and multiply and is drawn only on the highlighter canvas', () => {
    const { context } = fake();
    const pen = placed('p', [[0, 0], [1, 1]]);
    const marker = placed('h', [[0, 0], [1, 1]], { opacity: 0.35, multiply: true, color: '#FDD835' });
    const seen: Array<[string, number, string]> = [];
    context.stroke.mockImplementation(() => seen.push([context.strokeStyle as string, context.globalAlpha, context.globalCompositeOperation]));
    drawPlaced(context, [pen, marker], { x: 0, y: 0 }, 1, 'highlighter', NONE);
    expect(seen).toEqual([['#FDD835', 0.35, 'multiply']]);
    seen.length = 0;
    drawPlaced(context, [pen, marker], { x: 0, y: 0 }, 1, 'pen', NONE);
    expect(seen).toEqual([['#D32F2F', 1, 'source-over']]);
    expect(context.globalAlpha).toBe(1);
    expect(context.globalCompositeOperation).toBe('source-over');
  });

  it('ANN-005 hidden strokes are skipped', () => {
    const { context } = fake();
    drawPlaced(context, [placed('a', [[0, 0], [1, 1]]), placed('b', [[2, 2], [3, 3]])], { x: 0, y: 0 }, 1, 'pen', new Set(['a']));
    expect(context.stroke).toHaveBeenCalledTimes(1);
    expect(context.moveTo).toHaveBeenCalledWith(2, 2);
  });
});
