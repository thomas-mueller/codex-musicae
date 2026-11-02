import { vi } from 'vitest';

import { FrameScheduler, LiveStrokeRenderer } from './live-stroke-renderer';

const PX_PER_UNIT = 2;
const PEN = { color: '#D32F2F', widthPt: 3, opacity: 1, multiply: false };
const HIGHLIGHTER = { color: '#FDD835', widthPt: 14, opacity: 0.35, multiply: true };

function setup() {
  const context = {
    lineCap: '',
    lineJoin: '',
    strokeStyle: '',
    lineWidth: 0,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
  };
  const canvas = { width: 0, height: 0, style: {} as Record<string, string>, getContext: () => context } as unknown as HTMLCanvasElement;
  let callback: (() => void) | null = null;
  const frames: FrameScheduler = {
    request: vi.fn((cb: () => void) => {
      callback = cb;
      return 1;
    }),
    cancel: vi.fn(() => {
      callback = null;
    }),
  };
  const renderer = new LiveStrokeRenderer(canvas, frames);
  renderer.resize(200, 100, '100px', '50px', PX_PER_UNIT);
  return { canvas, context, frames, renderer, runFrame: () => callback?.() };
}

describe('LiveStrokeRenderer', () => {
  it('ANN-011 uses the size of the slide canvas', () => {
    const { canvas } = setup();
    expect([canvas.width, canvas.height, canvas.style.width, canvas.style.height]).toEqual([200, 100, '100px', '50px']);
  });

  it('ANN-011 draws with round caps and joins at widthPt × pxPerUnit', () => {
    const { context, renderer } = setup();
    renderer.begin(PEN);
    expect(context.lineCap).toBe('round');
    expect(context.lineJoin).toBe('round');
    expect(context.strokeStyle).toBe(PEN.color);
    expect(context.lineWidth).toBe(PEN.widthPt * PX_PER_UNIT);
  });

  it('ANN-011 many points in a frame cost one draw call; nothing is drawn before the frame', () => {
    const { context, frames, renderer, runFrame } = setup();
    renderer.begin(PEN);
    renderer.add([{ x: 1, y: 1 }]);
    renderer.add([{ x: 2, y: 2 }, { x: 3, y: 3 }]);
    expect(frames.request).toHaveBeenCalledTimes(1);
    expect(context.stroke).not.toHaveBeenCalled();
    runFrame();
    expect(context.stroke).toHaveBeenCalledTimes(1);
    expect(context.moveTo).toHaveBeenCalledWith(2, 2);
    expect(context.lineTo.mock.calls).toEqual([[2, 2], [4, 4], [6, 6]]);
  });

  it('ANN-011 the next frame draws only the new segments, continuing from the last point', () => {
    const { context, renderer, runFrame } = setup();
    renderer.begin(PEN);
    renderer.add([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    runFrame();
    context.moveTo.mockClear();
    context.lineTo.mockClear();
    renderer.add([{ x: 3, y: 3 }]);
    runFrame();
    expect(context.moveTo.mock.calls).toEqual([[4, 4]]);
    expect(context.lineTo.mock.calls).toEqual([[6, 6]]);
  });

  it('ANN-011 a frame without new points draws nothing', () => {
    const { context, frames, renderer } = setup();
    renderer.begin(PEN);
    expect(frames.request).not.toHaveBeenCalled();
    renderer.add([]);
    expect(frames.request).not.toHaveBeenCalled();
    expect(context.stroke).not.toHaveBeenCalled();
  });

  it('ANN-004 the highlighter is opaque on the canvas and gets CSS opacity and multiply', () => {
    const { canvas, context, renderer } = setup();
    renderer.begin(HIGHLIGHTER);
    expect(canvas.style.opacity).toBe(String(HIGHLIGHTER.opacity));
    expect(canvas.style.mixBlendMode).toBe('multiply');
    expect(context.strokeStyle).toBe(HIGHLIGHTER.color);
    renderer.begin(PEN);
    expect(canvas.style.opacity).toBe('1');
    expect(canvas.style.mixBlendMode).toBe('normal');
  });

  it('ANN-011 clear wipes the canvas, drops queued points and cancels the frame', () => {
    const { canvas, context, frames, renderer, runFrame } = setup();
    renderer.begin(PEN);
    renderer.add([{ x: 1, y: 1 }]);
    renderer.clear();
    runFrame();
    expect(frames.cancel).toHaveBeenCalled();
    expect(context.stroke).not.toHaveBeenCalled();
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 200, 100);
    expect(canvas.style.opacity).toBe('');
  });
});
