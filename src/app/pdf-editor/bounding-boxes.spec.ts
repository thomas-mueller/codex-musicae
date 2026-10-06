import {
  detectBoundingBoxesInDocument,
  detectBoundingBoxesOnPage,
  drawBoundingBoxes,
} from './bounding-boxes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  mats: [] as Array<{ rows: number; intAt: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }>,
  componentRows: [] as number[][],
  componentCount: 0,
}));

class MockMat {
  rows = 0;
  intAt = vi.fn((row: number, column: number) => mockState.componentRows[row]?.[column] ?? 0);
  delete = vi.fn();

  constructor() {
    if (mockState.mats.length % 6 === 4) {
      this.rows = mockState.componentCount;
    }
    mockState.mats.push(this);
  }
}

const mockCv = {
  Mat: MockMat,
  COLOR_RGBA2GRAY: 1,
  ADAPTIVE_THRESH_MEAN_C: 2,
  THRESH_BINARY_INV: 3,
  CV_32S: 4,
  CC_STAT_LEFT: 0,
  CC_STAT_TOP: 1,
  CC_STAT_WIDTH: 2,
  CC_STAT_HEIGHT: 3,
  CC_STAT_AREA: 4,
  imread: vi.fn(() => new MockMat()),
  cvtColor: vi.fn(),
  adaptiveThreshold: vi.fn(),
  connectedComponentsWithStats: vi.fn(),
};

describe('bounding-box helpers', () => {
  beforeEach(() => {
    mockState.mats = [];
    mockState.componentRows = [];
    mockState.componentCount = 0;
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({}),
      }),
      head: { appendChild: vi.fn() },
    });
    vi.stubGlobal('cv', mockCv);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('detects normalized boxes from the largest component-size group', async () => {
    mockState.componentCount = 4;
    mockState.componentRows = [
      [],
      [10, 20, 100, 50, 1000],
      [200, 100, 20, 10, 20],
      [300, 200, 10, 10, 10],
    ];
    const render = vi.fn(() => ({ promise: Promise.resolve() }));
    const page = {
      getViewport: vi.fn(() => ({ width: 400, height: 200 })),
      render,
    } as never;

    const boxes = await detectBoundingBoxesOnPage(page, 2);

    expect(boxes).toEqual([
      { page: 2, xMin: 0.025, yMin: 0.1, xMax: 0.275, yMax: 0.35 },
    ]);
    expect(render).toHaveBeenCalledOnce();
    expect(mockState.mats.every((mat) => mat.delete.mock.calls.length === 1)).toBe(true);
  });

  it('returns no boxes when there are no foreground components', async () => {
    mockState.componentCount = 1;
    const page = {
      getViewport: vi.fn(() => ({ width: 100, height: 100 })),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
    } as never;

    await expect(detectBoundingBoxesOnPage(page, 1)).resolves.toEqual([]);
  });

  it('processes a document sequentially and keeps each page number', async () => {
    mockState.componentCount = 2;
    mockState.componentRows = [[], [10, 10, 20, 20, 100]];
    const page = {
      getViewport: vi.fn(() => ({ width: 100, height: 100 })),
      render: vi.fn(() => ({ promise: Promise.resolve() })),
    };
    const getPage = vi.fn().mockResolvedValue(page);
    const pdfDocument = { numPages: 2, getPage } as never;

    const boxes = await detectBoundingBoxesInDocument(pdfDocument);

    expect(getPage).toHaveBeenNthCalledWith(1, 1);
    expect(getPage).toHaveBeenNthCalledWith(2, 2);
    expect(boxes.map((box) => box.page)).toEqual([1, 2]);
  });

  it('draws only the requested page using canvas-relative coordinates', () => {
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const boxes = [
      { page: 1, xMin: 0.1, yMin: 0.2, xMax: 0.5, yMax: 0.6 },
      { page: 2, xMin: 0, yMin: 0, xMax: 1, yMax: 1 },
    ];

    drawBoundingBoxes(context, 1, boxes, 200, 100);

    expect(context.strokeRect).toHaveBeenCalledExactlyOnceWith(20, 20, 80, 40);
    expect(context.save).toHaveBeenCalledOnce();
    expect(context.restore).toHaveBeenCalledOnce();
  });
});
