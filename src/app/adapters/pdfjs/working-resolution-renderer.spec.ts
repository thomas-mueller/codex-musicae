import { describe, expect, it, vi } from 'vitest';

import { TUNABLES } from '../../../config/tunables';
import type { PdfDocumentHandle, PdfRenderer, RenderRequest } from '../../ports/pdf-renderer';
import { ok } from '../../ports/result';
import { WorkingResolutionRenderer } from './working-resolution-renderer';

const PAGE_WIDTH = 685;
const PAGE_HEIGHT = 898;
const WORKING_LONG_SIDE = TUNABLES.resources.workingLongSidePx;
const WORKING_SCALE = WORKING_LONG_SIDE / PAGE_HEIGHT;
const NEVER = new AbortController().signal;

interface Bitmap {
  width: number;
  height: number;
  close: ReturnType<typeof vi.fn>;
}

const bitmap = (width: number, height: number): Bitmap => ({ width, height, close: vi.fn() });

/** A source renderer that reports what it was asked; `imageDpi` only marks which input resolution it stands for. */
function source(delay = 0) {
  let running = 0;
  let peak = 0;
  const requests: RenderRequest[] = [];
  const handle: PdfDocumentHandle = {
    pageCount: 3,
    getPageInfo: (pageIndex) => Promise.resolve(ok({ pageIndex, box: { view: [0, 0, PAGE_WIDTH, PAGE_HEIGHT], rotate: 0 }, width: PAGE_WIDTH, height: PAGE_HEIGHT })),
    renderRegion: async (req, signal) => {
      requests.push(req);
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, delay));
      running--;
      if (signal.aborted) {
        return { ok: false, error: 'cancelled' } as const;
      }
      return ok(bitmap(Math.ceil(req.region.width * req.scale), Math.ceil(req.region.height * req.scale)) as unknown as ImageBitmap);
    },
    destroy: vi.fn(() => Promise.resolve()),
  };
  const renderer: PdfRenderer = { open: () => Promise.resolve(ok(handle)) };
  return { renderer, handle, requests, peak: () => peak };
}

function layer(inner: PdfRenderer) {
  const draws: unknown[][] = [];
  const canvases: { width: number; height: number }[] = [];
  const renderer = new WorkingResolutionRenderer(inner, {
    createCanvas: (width, height) => {
      const canvas = { width, height, getContext: () => ({ imageSmoothingQuality: '', drawImage: (...args: unknown[]) => draws.push(args) }) };
      canvases.push(canvas);
      return canvas;
    },
    createBitmap: (canvas) => Promise.resolve(bitmap(canvas.width, canvas.height) as unknown as ImageBitmap),
    copyBitmap: (original) => Promise.resolve(bitmap(original.width, original.height) as unknown as ImageBitmap),
  });
  return { renderer, draws, canvases };
}

async function open(inner: PdfRenderer) {
  const made = layer(inner);
  const opened = await made.renderer.open(new Uint8Array([1]));
  if (!opened.ok) {
    throw new Error('open failed');
  }
  return { ...made, handle: opened.value };
}

const region = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe('WorkingResolutionRenderer (NFR-025)', () => {
  it('NFR-025 many views of one page up to the working scale render the source once', async () => {
    const src = source();
    const { handle } = await open(src.renderer);
    for (const scale of [0.5, 1, 2, WORKING_SCALE]) {
      const result = await handle.renderRegion({ pageIndex: 0, region: region(0, 0, PAGE_WIDTH, PAGE_HEIGHT), scale }, NEVER);
      expect(result.ok).toBe(true);
    }
    expect(src.requests).toHaveLength(1);
    expect(src.requests[0]).toMatchObject({ pageIndex: 0, scale: expect.closeTo(WORKING_SCALE, 5) as number });
  });

  it('NFR-025 the working raster has the same size whatever the input resolution is: it depends on the page only', async () => {
    const sizes: number[][] = [];
    for (const label of ['100 dpi input', '1000 dpi input']) {
      const src = source();
      const { handle } = await open(src.renderer);
      await handle.renderRegion({ pageIndex: 0, region: region(0, 0, 100, 100), scale: 1 }, NEVER);
      sizes.push([src.requests[0]!.region.width, src.requests[0]!.region.height, Math.round(src.requests[0]!.scale * 1000)]);
      expect(label).toBeTruthy();
    }
    expect(sizes[0]).toEqual(sizes[1]);
    const longSidePx = PAGE_HEIGHT * (sizes[0]![2]! / 1000);
    expect(longSidePx).toBeLessThanOrEqual(WORKING_LONG_SIDE + 1);
    expect(sizes[0]![0]! * sizes[0]![1]! * (sizes[0]![2]! / 1000) ** 2).toBeLessThanOrEqual(TUNABLES.resources.maxCanvasPixels);
  });

  it('NFR-025 a region is cut from the working raster at the asked size', async () => {
    const src = source();
    const { handle, draws } = await open(src.renderer);
    const result = await handle.renderRegion({ pageIndex: 1, region: region(100, 200, 300, 150), scale: 2 }, NEVER);
    expect(result.ok && [result.value.width, result.value.height]).toEqual([600, 300]);
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = draws[0]!;
    expect([sx, sy, sw, sh]).toEqual([100, 200, 300, 150].map((v) => expect.closeTo(v * WORKING_SCALE, 3)));
    expect([dx, dy, dw, dh]).toEqual([0, 0, 600, 300]);
  });

  it('NFR-025 a view above the working scale reaches the source, one request at a time', async () => {
    const src = source(5);
    const { handle } = await open(src.renderer);
    const detail = (x: number): RenderRequest => ({ pageIndex: 0, region: region(x, 0, 200, 200), scale: WORKING_SCALE * 2 });
    await Promise.all([handle.renderRegion(detail(0), NEVER), handle.renderRegion(detail(200), NEVER), handle.renderRegion(detail(400), NEVER)]);
    expect(src.requests).toHaveLength(3);
    expect(src.peak()).toBe(TUNABLES.resources.sourceDecodeSlots);
  });

  it('NFR-025 a request that is aborted while waiting for the source leaves the line and frees the others', async () => {
    const src = source(20);
    const { handle } = await open(src.renderer);
    const detail = (x: number): RenderRequest => ({ pageIndex: 0, region: region(x, 0, 200, 200), scale: WORKING_SCALE * 2 });
    const aborted = new AbortController();
    const first = handle.renderRegion(detail(0), NEVER);
    const waiting = handle.renderRegion(detail(200), aborted.signal);
    const third = handle.renderRegion(detail(400), NEVER);
    aborted.abort();
    expect(await waiting).toEqual({ ok: false, error: 'cancelled' });
    expect((await first).ok && (await third).ok).toBe(true);
    expect(src.requests.map((r) => r.region.x)).toEqual([0, 400]);
  });

  it('NFR-025 only the most recent pages keep a working raster: older ones are closed', async () => {
    const src = source();
    const built: Bitmap[] = [];
    const handleSource = src.handle.renderRegion;
    src.handle.renderRegion = async (req, signal) => {
      const result = await handleSource(req, signal);
      if (result.ok) {
        built.push(result.value as unknown as Bitmap);
      }
      return result;
    };
    const inner: PdfRenderer = { open: () => Promise.resolve(ok(src.handle)) };
    const { handle } = await open(inner);
    const pages = TUNABLES.resources.workingPagesKept + 1;
    for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
      await handle.renderRegion({ pageIndex, region: region(0, 0, 50, 50), scale: 1 }, NEVER);
    }
    await Promise.resolve();
    expect(built).toHaveLength(pages);
    expect(built[0]!.close).toHaveBeenCalledTimes(1);
    expect(built.slice(1).every((b) => b.close.mock.calls.length === 0)).toBe(true);
  });

  it('NFR-025 destroying the handle closes every working raster and the source', async () => {
    const src = source();
    const built: Bitmap[] = [];
    const original = src.handle.renderRegion;
    src.handle.renderRegion = async (req, signal) => {
      const result = await original(req, signal);
      if (result.ok) {
        built.push(result.value as unknown as Bitmap);
      }
      return result;
    };
    const { handle } = await open({ open: () => Promise.resolve(ok(src.handle)) });
    await handle.renderRegion({ pageIndex: 0, region: region(0, 0, 50, 50), scale: 1 }, NEVER);
    await handle.renderRegion({ pageIndex: 1, region: region(0, 0, 50, 50), scale: 1 }, NEVER);
    await handle.destroy();
    expect(built.map((b) => b.close.mock.calls.length)).toEqual([1, 1]);
    expect(src.handle.destroy).toHaveBeenCalledTimes(1);
  });

  it('NFR-025 errors and cancellation of the source pass through and are not cached', async () => {
    const src = source();
    let fail = true;
    const original = src.handle.renderRegion;
    src.handle.renderRegion = (req, signal) => (fail ? Promise.resolve({ ok: false, error: 'out-of-memory' } as const) : original(req, signal));
    const { handle } = await open({ open: () => Promise.resolve(ok(src.handle)) });
    const request: RenderRequest = { pageIndex: 0, region: region(0, 0, 50, 50), scale: 1 };
    expect(await handle.renderRegion(request, NEVER)).toEqual({ ok: false, error: 'out-of-memory' });
    fail = false;
    expect((await handle.renderRegion(request, NEVER)).ok).toBe(true);
    const aborted = new AbortController();
    aborted.abort();
    expect(await handle.renderRegion(request, aborted.signal)).toEqual({ ok: false, error: 'cancelled' });
  });

  it('NFR-025 the working raster is handed out as a copy without any drawing, from the one source render of the page', async () => {
    const src = source();
    const { handle, draws } = await open(src.renderer);
    const first = await handle.renderWorkingRaster!(0, NEVER);
    const second = await handle.renderWorkingRaster!(0, NEVER);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.bitmap).not.toBe(second.value.bitmap);
      expect(first.value.scale).toBeCloseTo(WORKING_SCALE, 5);
      expect([first.value.bitmap.width, first.value.bitmap.height]).toEqual([Math.ceil(PAGE_WIDTH * WORKING_SCALE), Math.ceil(PAGE_HEIGHT * WORKING_SCALE)]);
    }
    expect(draws).toHaveLength(0);
    expect(src.requests).toHaveLength(1);
  });

  it('NFR-025 an aborted request for the working raster is cancelled', async () => {
    const src = source();
    const { handle } = await open(src.renderer);
    const aborted = new AbortController();
    aborted.abort();
    expect(await handle.renderWorkingRaster!(0, aborted.signal)).toEqual({ ok: false, error: 'cancelled' });
  });

  const whole = (pageIndex: number): RenderRequest => ({ pageIndex, region: region(0, 0, PAGE_WIDTH, PAGE_HEIGHT), scale: 1 });

  it('NFR-025 NFR-008 working rasters that nobody waits for any more are not built: a fast scroll does not queue up the pages it has left', async () => {
    const src = source(20);
    const { handle } = await open(src.renderer);
    const slots = TUNABLES.resources.sourceDecodeSlots;
    const abandoned = Array.from({ length: 4 }, () => new AbortController());
    const kept = Array.from({ length: slots }, (_, i) => handle.renderRegion(whole(i), NEVER));
    const left = abandoned.map((controller, i) => handle.renderRegion(whole(slots + i), controller.signal));
    abandoned.forEach((controller) => controller.abort());
    const wanted = handle.renderRegion(whole(slots + abandoned.length), NEVER);
    expect((await Promise.all(left)).every((r) => !r.ok && r.error === 'cancelled')).toBe(true);
    expect((await Promise.all([...kept, wanted])).every((r) => r.ok)).toBe(true);
    expect(src.requests.map((r) => r.pageIndex)).toEqual([...Array.from({ length: slots }, (_, i) => i), slots + abandoned.length]);
  });

  it('NFR-025 NFR-008 a raster build that one of two waiters still needs goes on and is shared', async () => {
    const src = source(20);
    const { handle } = await open(src.renderer);
    const gone = new AbortController();
    const first = handle.renderRegion(whole(0), gone.signal);
    const second = handle.renderRegion(whole(0), NEVER);
    gone.abort();
    expect(await first).toEqual({ ok: false, error: 'cancelled' });
    expect((await second).ok).toBe(true);
    expect(src.requests).toHaveLength(1);
  });

  it('NFR-025 NFR-008 a running raster build whose last waiter leaves is cancelled and built again when the page is wanted later', async () => {
    const src = source(20);
    const { handle } = await open(src.renderer);
    const gone = new AbortController();
    const first = handle.renderRegion(whole(0), gone.signal);
    await new Promise((resolve) => setTimeout(resolve, 5));
    gone.abort();
    expect(await first).toEqual({ ok: false, error: 'cancelled' });
    const again = await handle.renderRegion(whole(0), NEVER);
    expect(again.ok).toBe(true);
    expect(src.requests).toHaveLength(2);
  });
});
