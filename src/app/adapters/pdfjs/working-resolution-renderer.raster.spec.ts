import { describe, expect, it, vi } from 'vitest';

import { TUNABLES } from '../../../config/tunables';
import type { PdfDocumentHandle, PdfRenderer, RenderRequest } from '../../ports/pdf-renderer';
import { ok } from '../../ports/result';
import { WorkingResolutionRenderer } from './working-resolution-renderer';

const PAGE_WIDTH = 685;
const PAGE_HEIGHT = 898;
const NEVER = new AbortController().signal;
const OPAQUE = 255;
const PIXELS = 16;

const pixels = (rgba: readonly number[]): number[] => Array.from({ length: PIXELS }, () => rgba).flat();
const LOST = pixels([0, 0, 0, 0]);
const WHITE = pixels([255, 255, 255, OPAQUE]);
const INK = [...pixels([255, 255, 255, OPAQUE]).slice(0, -4), 10, 10, 10, OPAQUE];

interface Bitmap {
  width: number;
  height: number;
  close: ReturnType<typeof vi.fn>;
}

/** A renderer whose raster probe answers `reads` in order (the last answer repeats) and that records every bitmap it made. */
async function setup(reads: ReadonlyArray<ArrayLike<number> | null> | ((probeNumber: number) => ArrayLike<number> | null)) {
  const bitmaps: Bitmap[] = [];
  let render = 0;
  const requests: RenderRequest[] = [];
  const handle: PdfDocumentHandle = {
    pageCount: 3,
    getPageInfo: (pageIndex) => Promise.resolve(ok({ pageIndex, box: { view: [0, 0, PAGE_WIDTH, PAGE_HEIGHT], rotate: 0 }, width: PAGE_WIDTH, height: PAGE_HEIGHT })),
    renderRegion: (req) => {
      requests.push(req);
      const bitmap: Bitmap = { width: 10, height: 10, close: vi.fn() };
      bitmaps.push(bitmap);
      render++;
      return Promise.resolve(ok(bitmap as unknown as ImageBitmap));
    },
    destroy: vi.fn(() => Promise.resolve()),
  };
  const source: PdfRenderer = { open: () => Promise.resolve(ok(handle)) };
  const probed: Bitmap[] = [];
  const renderer = new WorkingResolutionRenderer(source, {
    probe: (bitmap) => {
      probed.push(bitmap as unknown as Bitmap);
      return Promise.resolve(typeof reads === 'function' ? reads(probed.length) : (reads[Math.min(probed.length, reads.length) - 1] ?? null));
    },
    createCanvas: (width, height) => ({ width, height, getContext: () => ({ imageSmoothingQuality: '', drawImage: vi.fn() }) }),
    createBitmap: (canvas) => Promise.resolve({ width: canvas.width, height: canvas.height, close: vi.fn() } as unknown as ImageBitmap),
    copyBitmap: (original) => Promise.resolve({ width: original.width, height: original.height, close: vi.fn() } as unknown as ImageBitmap),
  });
  const opened = await renderer.open(new Uint8Array([1]));
  if (!opened.ok) {
    throw new Error('open failed');
  }
  return { renderer, handle: opened.value, bitmaps, requests, renders: () => render };
}

const view = (handle: PdfDocumentHandle, pageIndex = 0) =>
  handle.renderRegion({ pageIndex, region: { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT }, scale: 1 }, NEVER);

describe('WorkingResolutionRenderer: lost working rasters (NFR-028)', () => {
  it('NFR-028 a page with ink is built once and never retried', async () => {
    const { renderer, handle, renders } = await setup([INK]);
    expect((await view(handle)).ok).toBe(true);
    expect(renders()).toBe(1);
    expect(renderer.stats.rasterRetries).toBe(0);
  });

  it('NFR-028 a transparent raster is rebuilt and the good second build is used', async () => {
    const { renderer, handle, renders, bitmaps } = await setup([LOST, INK]);
    expect((await view(handle)).ok).toBe(true);
    expect(renders()).toBe(2);
    expect(bitmaps[0]?.close).toHaveBeenCalledTimes(1); // the lost bitmap is released
    expect(renderer.stats).toMatchObject({ lostRasters: 1, rasterRetries: 1 });
  });

  it('NFR-028 a rebuild starts cold (fresh) while the first build does not', async () => {
    const { handle, requests } = await setup([LOST, INK]);
    await view(handle);
    expect(requests.map((request) => request.fresh)).toEqual([false, true]);
  });

  it('NFR-028 a raster that stays transparent fails with out-of-memory after the configured retries and is not cached', async () => {
    const { renderer, handle, renders, bitmaps } = await setup([LOST]);
    expect(await view(handle)).toMatchObject({ ok: false, error: 'out-of-memory' });
    expect(renders()).toBe(1 + TUNABLES.resources.rasterLostRetries);
    expect(bitmaps.every((bitmap) => bitmap.close.mock.calls.length === 1)).toBe(true);
    expect(renderer.stats.lostRasters).toBe(1 + TUNABLES.resources.rasterLostRetries);
    expect(await view(handle)).toMatchObject({ ok: false }); // a failure is not remembered: the next request builds again
    expect(renders()).toBe(2 * (1 + TUNABLES.resources.rasterLostRetries));
  });

  it('NFR-028 an opaque white page is accepted at once and counted: real pages can be completely white', async () => {
    const { renderer, handle, renders } = await setup([WHITE]);
    expect((await view(handle)).ok).toBe(true);
    expect(renders()).toBe(1);
    expect(renderer.stats).toMatchObject({ flatRasters: 1, lostRasters: 0, rasterRetries: 0 });
  });

  it('NFR-028 retries are not counted as renders of the page', async () => {
    const { renderer, handle } = await setup([LOST, INK]);
    await view(handle);
    expect(renderer.stats.sourceRenders).toBe(1);
    expect(renderer.stats.rasterRetries).toBe(1);
  });

  it('NFR-028 an unreadable probe counts as fine: the raster is used as before', async () => {
    const { handle, renders } = await setup([null]);
    expect((await view(handle)).ok).toBe(true);
    expect(renders()).toBe(1);
  });

  it('NFR-028 requests that wait for the same page share one build, retries included', async () => {
    const { handle, renders } = await setup([LOST, INK]);
    const results = await Promise.all([view(handle), view(handle), view(handle)]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(renders()).toBe(2);
  });

  it('NFR-028 a retry frees the oldest other working raster first', async () => {
    const { handle, bitmaps } = await setup([INK, LOST, INK]);
    await view(handle, 0); // page 0 raster: bitmaps[0]
    await view(handle, 1); // page 1 is lost once: bitmaps[1], retry bitmaps[2]
    expect(bitmaps[0]?.close).toHaveBeenCalled(); // shed before the retry
  });
});
