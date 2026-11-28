import { TUNABLES } from '../../../config/tunables';
import { BITMAP_BYTES_PER_PIXEL } from '../../core/prefetch-budget';
import { classifyRaster, fitScaleToPixelCap } from '../../core';
import type { RasterVerdict } from '../../core';
import type { PdfDocumentHandle, PdfOpenError, PdfPageInfo, PdfRenderError, PdfRenderer, RenderRequest, WorkingRaster } from '../../ports/pdf-renderer';
import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';

/** Canvas surface the layer draws on: `OffscreenCanvas` or a detached `<canvas>`. */
interface DrawCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): unknown;
}

interface Drawing {
  imageSmoothingQuality: string;
  drawImage(image: ImageBitmap, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
}

/** What the probe needs of a 2d context; a context without `getImageData` (a test double) cannot be judged and counts as fine. */
interface ProbeContext extends Drawing {
  getImageData?(sx: number, sy: number, sw: number, sh: number): { readonly data: ArrayLike<number> };
}

interface WorkingResolutionOptions {
  /** The RGBA samples of a small copy of `bitmap`, or null when they cannot be read (NFR-028). */
  readonly probe?: (bitmap: ImageBitmap) => Promise<ArrayLike<number> | null>;
  readonly createCanvas?: (width: number, height: number) => DrawCanvas;
  readonly createBitmap?: (canvas: DrawCanvas) => Promise<ImageBitmap>;
  readonly copyBitmap?: (bitmap: ImageBitmap) => Promise<ImageBitmap>;
}

const SMOOTHING = 'high';
const SCALE_EPSILON = 1e-9;
const CAP_MARGIN = 0.999; // rounding up of the pixel sizes must stay inside the canvas cap

function defaultCreateCanvas(width: number, height: number): DrawCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height) as unknown as DrawCanvas;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const defaultCreateBitmap = (canvas: DrawCanvas): Promise<ImageBitmap> => createImageBitmap(canvas as unknown as ImageBitmapSource);

interface RendererStats {
  sourceRenders: number;
  directRenders: number;
  lostRasters: number;
  flatRasters: number;
  rasterRetries: number;
}

/** NFR-028: the RGBA samples of a `rasterProbeSize` square copy of the raster (area averaged), or null when they cannot be read. */
async function defaultProbe(createCanvas: (width: number, height: number) => DrawCanvas, bitmap: ImageBitmap): Promise<ArrayLike<number> | null> {
  const size = TUNABLES.resources.rasterProbeSize;
  let canvas: DrawCanvas | null = null;
  try {
    canvas = createCanvas(size, size);
    const context = canvas.getContext('2d') as ProbeContext | null;
    if (!context || typeof context.getImageData !== 'function') {
      return null;
    }
    context.imageSmoothingQuality = SMOOTHING;
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, size, size);
    return context.getImageData(0, 0, size, size).data;
  } catch {
    return null; // unreadable is not the same as lost: the raster is used as before
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/** Lets `slots` tasks run at once; waiters leave the line when their signal aborts. */
class Slots {
  private free: number;
  private readonly waiting: Array<() => void> = [];

  constructor(slots: number) {
    this.free = slots;
  }

  /** Resolves with the release function, or `null` when the signal aborted while waiting. */
  async acquire(signal: AbortSignal): Promise<(() => void) | null> {
    if (signal.aborted) {
      return null;
    }
    if (this.free === 0) {
      const granted = await new Promise<boolean>((resolve) => {
        const entry = (): void => {
          signal.removeEventListener('abort', onAbort);
          resolve(true);
        };
        const onAbort = (): void => {
          const index = this.waiting.indexOf(entry);
          if (index >= 0) {
            this.waiting.splice(index, 1);
          }
          resolve(false);
        };
        signal.addEventListener('abort', onAbort, { once: true });
        this.waiting.push(entry);
      });
      if (!granted) {
        return null;
      }
    } else {
      this.free--;
    }
    return () => {
      const next = this.waiting.shift();
      if (next) {
        next(); // the slot passes on to the next waiter
      } else {
        this.free++;
      }
    };
  }
}

/**
 * NFR-025: rendering never depends on the resolution of the PDF's images. Every page is rendered once, whole, into a working raster whose
 * size depends only on the page size (`T:resources.workingLongSidePx`, capped by `maxCanvasPixels`); views up to that scale (fit views,
 * detection, prefetch, slides) are cut and scaled from the raster. Only regions zoomed beyond it reach the source renderer, one at a time.
 */
export class WorkingResolutionRenderer implements PdfRenderer {
  /**
   * Counts of the calls that reached the source renderer; `directRenders` are the ones beyond the working scale, not raster builds
   * (development debug hook). NFR-028: `lostRasters` and `flatRasters` count what the probe found, `rasterRetries` the rebuilds.
   */
  readonly stats: RendererStats = { sourceRenders: 0, directRenders: 0, lostRasters: 0, flatRasters: 0, rasterRetries: 0 };
  private readonly createCanvas: (width: number, height: number) => DrawCanvas;
  private readonly createBitmap: (canvas: DrawCanvas) => Promise<ImageBitmap>;
  private readonly copyBitmap: (bitmap: ImageBitmap) => Promise<ImageBitmap>;
  private readonly probe: (bitmap: ImageBitmap) => Promise<ArrayLike<number> | null>;

  constructor(
    private readonly source: PdfRenderer,
    options: WorkingResolutionOptions = {},
  ) {
    this.createCanvas = options.createCanvas ?? defaultCreateCanvas;
    this.createBitmap = options.createBitmap ?? defaultCreateBitmap;
    this.copyBitmap = options.copyBitmap ?? ((bitmap) => createImageBitmap(bitmap));
    this.probe = options.probe ?? ((bitmap) => defaultProbe(this.createCanvas, bitmap));
  }

  async open(bytes: Uint8Array): Promise<Result<PdfDocumentHandle, PdfOpenError>> {
    const opened = await this.source.open(bytes);
    return opened.ok ? ok(new WorkingResolutionHandle(opened.value, this.createCanvas, this.createBitmap, this.copyBitmap, this.stats, this.probe)) : opened;
  }
}

/** A working raster being built or built, with the number of requests still waiting for it (NFR-025, NFR-008). */
interface RasterEntry {
  readonly pending: Promise<Result<WorkingRaster, PdfRenderError>>;
  readonly controller: AbortController;
  waiters: number;
  settled: boolean;
  /** The source render has begun: it is not cancelled any more, so a page is not rendered twice (NFR-025). */
  started: boolean;
  /** Size of the built raster; 0 until it is built. */
  bytes: number;
}

class WorkingResolutionHandle implements PdfDocumentHandle {
  readonly pageCount: number;
  private readonly infos = new Map<number, Promise<Result<PdfPageInfo, 'unknown'>>>();
  private readonly rasters = new Map<number, RasterEntry>();
  private readonly slots = new Slots(TUNABLES.resources.sourceDecodeSlots);
  private readonly lifetime = new AbortController();

  constructor(
    private readonly source: PdfDocumentHandle,
    private readonly createCanvas: (width: number, height: number) => DrawCanvas,
    private readonly createBitmap: (canvas: DrawCanvas) => Promise<ImageBitmap>,
    private readonly copyBitmap: (bitmap: ImageBitmap) => Promise<ImageBitmap>,
    private readonly stats: RendererStats,
    private readonly probe: (bitmap: ImageBitmap) => Promise<ArrayLike<number> | null>,
  ) {
    this.pageCount = source.pageCount;
  }

  getPageInfo(pageIndex: number): Promise<Result<PdfPageInfo, 'unknown'>> {
    let info = this.infos.get(pageIndex);
    if (!info) {
      info = this.source.getPageInfo(pageIndex);
      this.infos.set(pageIndex, info);
      void info.then((result) => {
        if (!result.ok) {
          this.infos.delete(pageIndex); // a failed lookup may be retried
        }
      });
    }
    return info;
  }

  async renderRegion(req: RenderRequest, signal: AbortSignal): Promise<Result<ImageBitmap, PdfRenderError>> {
    if (signal.aborted) {
      return err('cancelled');
    }
    const info = await this.getPageInfo(req.pageIndex);
    if (!info.ok) {
      return err('unknown');
    }
    const { width, height } = info.value;
    const workingScale = this.workingScaleOf(width, height);
    if (req.scale > workingScale + SCALE_EPSILON) {
      return this.renderFromSource(req, signal);
    }
    const raster = await this.rasterOf(req.pageIndex, width, height, workingScale, signal);
    if (!raster.ok) {
      return raster;
    }
    if (signal.aborted) {
      return err('cancelled');
    }
    return this.cut(raster.value, req);
  }

  /** The working raster itself (a copy the caller owns): no browser resampling between the source and the caller. */
  async renderWorkingRaster(pageIndex: number, signal: AbortSignal): Promise<Result<WorkingRaster, PdfRenderError>> {
    if (signal.aborted) {
      return err('cancelled');
    }
    const info = await this.getPageInfo(pageIndex);
    if (!info.ok) {
      return err('unknown');
    }
    const { width, height } = info.value;
    const raster = await this.rasterOf(pageIndex, width, height, this.workingScaleOf(width, height), signal);
    if (!raster.ok) {
      return raster;
    }
    if (signal.aborted) {
      return err('cancelled');
    }
    try {
      return ok({ bitmap: await this.copyBitmap(raster.value.bitmap), scale: raster.value.scale });
    } catch (e) {
      return err(e instanceof RangeError || (e instanceof DOMException && e.name === 'QuotaExceededError') ? 'out-of-memory' : 'unknown');
    }
  }

  /**
   * NFR-020: drops every raster and what the source keeps of the pages. A build somebody waits for still finishes, and its
   * raster is closed only after that caller has drawn from it; a later request builds the page again.
   */
  releaseRendered(): void {
    for (const pageIndex of [...this.rasters.keys()]) {
      this.discard(pageIndex);
    }
    this.source.releaseRendered?.();
  }

  renderedBytes(): number {
    return [...this.rasters.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  }

  /**
   * Forgets a raster and closes it once it is built. The close waits for a new task: callers waiting for the build draw
   * from the raster in the microtasks that follow it.
   */
  private discard(pageIndex: number): void {
    const entry = this.rasters.get(pageIndex);
    this.rasters.delete(pageIndex);
    void entry?.pending.then((raster) => {
      if (raster.ok) {
        setTimeout(() => raster.value.bitmap.close());
      }
    });
  }

  async destroy(): Promise<void> {
    this.lifetime.abort();
    const rasters = [...this.rasters.values()];
    this.rasters.clear();
    for (const entry of rasters) {
      const raster = await entry.pending;
      if (raster.ok) {
        raster.value.bitmap.close();
      }
    }
    await this.source.destroy();
  }

  /** The working scale of a page: the long side gets `workingLongSidePx` pixels, never more than the canvas cap allows. */
  private workingScaleOf(width: number, height: number): number {
    const wanted = TUNABLES.resources.workingLongSidePx / Math.max(width, height);
    return fitScaleToPixelCap(width, height, wanted, TUNABLES.resources.maxCanvasPixels * CAP_MARGIN);
  }

  /**
   * The working raster of a page: made once (shared by every waiting request), the oldest ones are released.
   * A build that nobody waits for any more is cancelled while it still queues for a slot (one that already renders is finished, so no page is rendered twice), so the slots serve the pages that are still wanted (the pages a fast scroll has left do not queue up).
   */
  private rasterOf(pageIndex: number, width: number, height: number, scale: number, signal: AbortSignal): Promise<Result<WorkingRaster, PdfRenderError>> {
    if (signal.aborted) {
      return Promise.resolve(err('cancelled')); // nobody waits: do not start (or touch) a build
    }
    let entry = this.rasters.get(pageIndex);
    if (entry) {
      this.rasters.delete(pageIndex); // re-inserted below: most recently used last
    } else {
      entry = this.startBuild(pageIndex, width, height, scale);
    }
    this.rasters.set(pageIndex, entry);
    this.evict();
    return this.waitFor(entry, signal);
  }

  private startBuild(pageIndex: number, width: number, height: number, scale: number): RasterEntry {
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    this.lifetime.signal.addEventListener('abort', abort, { once: true });
    const entry: RasterEntry = {
      controller,
      waiters: 0,
      settled: false,
      started: false,
      bytes: 0,
      pending: this.build(pageIndex, width, height, scale, controller.signal, () => (entry.started = true)).then((result) => {
        entry.settled = true;
        entry.bytes = result.ok ? result.value.bitmap.width * result.value.bitmap.height * BITMAP_BYTES_PER_PIXEL : 0;
        this.lifetime.signal.removeEventListener('abort', abort);
        if (!result.ok && this.rasters.get(pageIndex) === entry) {
          this.rasters.delete(pageIndex); // failures are not cached
        }
        if (result.ok && controller.signal.aborted && this.rasters.get(pageIndex) !== entry) {
          result.value.bitmap.close(); // cancelled while the render finished: nobody owns the bitmap
          return err('cancelled');
        }
        return result;
      }),
    };
    return entry;
  }

  private waitFor(entry: RasterEntry, signal: AbortSignal): Promise<Result<WorkingRaster, PdfRenderError>> {
    if (signal.aborted) {
      return Promise.resolve(err('cancelled'));
    }
    entry.waiters++;
    return new Promise((resolve) => {
      const leave = (): void => {
        entry.waiters--;
        if (entry.waiters === 0 && !entry.settled && !entry.started) {
          entry.controller.abort(); // nobody needs this build any more (one that already renders runs on and stays cached)
          for (const [key, value] of this.rasters) {
            if (value === entry) {
              this.rasters.delete(key);
            }
          }
        }
      };
      const onAbort = (): void => {
        leave();
        resolve(err('cancelled'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      void entry.pending.then((result) => {
        signal.removeEventListener('abort', onAbort);
        if (!signal.aborted) {
          entry.waiters--;
        }
        resolve(result);
      });
    });
  }

  private build(pageIndex: number, width: number, height: number, scale: number, signal: AbortSignal, onStart: () => void): Promise<Result<WorkingRaster, PdfRenderError>> {
    return this.withSlot(signal, async (slotSignal) => {
      onStart();
      const limits = { minAlpha: TUNABLES.resources.rasterMinAlpha, flatTolerance: TUNABLES.resources.rasterFlatTolerance };
      for (let attempt = 0; ; attempt++) {
        if (attempt === 0) {
          this.stats.sourceRenders++; // rebuilds after a lost raster are counted in `rasterRetries`, not as renders of the page (NFR-025)
        }
        const rendered = await this.source.renderRegion({ pageIndex, region: { x: 0, y: 0, width, height }, scale, fresh: attempt > 0 }, slotSignal);
        if (!rendered.ok) {
          return rendered;
        }
        const samples = await this.probe(rendered.value);
        const verdict: RasterVerdict = samples === null ? 'ok' : classifyRaster(samples, limits);
        if (verdict === 'flat') {
          this.stats.flatRasters++; // may be a really white page: counted for diagnosis, accepted as it is
        }
        if (verdict !== 'lost') {
          return ok({ bitmap: rendered.value, scale });
        }
        // NFR-028: a transparent raster is a canvas the browser dropped, never a page: rebuild it, or fail instead of handing it out.
        this.stats.lostRasters++;
        rendered.value.close();
        if (attempt >= TUNABLES.resources.rasterLostRetries || slotSignal.aborted) {
          return slotSignal.aborted ? err('cancelled') : err('out-of-memory');
        }
        this.stats.rasterRetries++;
        this.shed(pageIndex);
        await new Promise((resolve) => setTimeout(resolve, TUNABLES.resources.rasterRetryDelayMs * (attempt + 1))); // let the browser reclaim the canvas
      }
    });
  }

  /** NFR-028: frees the oldest other working raster before a rebuild (memory pressure is the likely cause of a lost canvas). */
  private shed(keep: number): void {
    for (const [key, entry] of this.rasters) {
      if (key === keep) {
        continue;
      }
      this.rasters.delete(key);
      void entry.pending.then((raster) => {
        if (raster.ok) {
          raster.value.bitmap.close();
        }
      });
      return;
    }
  }

  /** Keeps `workingPagesKept` rasters; the least recently used are closed once they are built. */
  private evict(): void {
    while (this.rasters.size > TUNABLES.resources.workingPagesKept) {
      const oldest = this.rasters.keys().next().value as number;
      const entry = this.rasters.get(oldest);
      this.rasters.delete(oldest);
      void entry?.pending.then((raster) => {
        if (raster.ok) {
          raster.value.bitmap.close();
        }
      });
    }
  }

  private async renderFromSource(req: RenderRequest, signal: AbortSignal): Promise<Result<ImageBitmap, PdfRenderError>> {
    return this.withSlot(signal, (slotSignal) => {
      this.stats.sourceRenders++;
      this.stats.directRenders++;
      return this.source.renderRegion(req, slotSignal);
    });
  }

  private async withSlot<T>(signal: AbortSignal, run: (signal: AbortSignal) => Promise<Result<T, PdfRenderError>>): Promise<Result<T, PdfRenderError>> {
    const release = await this.slots.acquire(signal);
    if (!release) {
      return err('cancelled');
    }
    try {
      return await run(signal);
    } finally {
      release();
    }
  }

  /** Draws the part of the working raster that `req.region` covers at `req.scale`. */
  private async cut(raster: WorkingRaster, req: RenderRequest): Promise<Result<ImageBitmap, PdfRenderError>> {
    const width = Math.ceil(req.region.width * req.scale);
    const height = Math.ceil(req.region.height * req.scale);
    if (width * height > TUNABLES.resources.maxCanvasPixels) {
      return err('out-of-memory');
    }
    let canvas: DrawCanvas | null = null;
    try {
      canvas = this.createCanvas(width, height);
      const context = canvas.getContext('2d') as Drawing | null;
      if (!context) {
        return err('out-of-memory');
      }
      context.imageSmoothingQuality = SMOOTHING;
      const k = raster.scale;
      context.drawImage(raster.bitmap, req.region.x * k, req.region.y * k, req.region.width * k, req.region.height * k, 0, 0, width, height);
      return ok(await this.createBitmap(canvas));
    } catch (e) {
      return err(e instanceof RangeError || (e instanceof DOMException && e.name === 'QuotaExceededError') ? 'out-of-memory' : 'unknown');
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  }
}

