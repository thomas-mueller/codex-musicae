import { TUNABLES } from '../../../config/tunables';
import { fitScaleToPixelCap } from '../../core/geometry';
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

interface WorkingResolutionOptions {
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
  /** Counts of the calls that reached the source renderer (shown by the development debug hook). */
  readonly stats = { sourceRenders: 0 };
  private readonly createCanvas: (width: number, height: number) => DrawCanvas;
  private readonly createBitmap: (canvas: DrawCanvas) => Promise<ImageBitmap>;
  private readonly copyBitmap: (bitmap: ImageBitmap) => Promise<ImageBitmap>;

  constructor(
    private readonly source: PdfRenderer,
    options: WorkingResolutionOptions = {},
  ) {
    this.createCanvas = options.createCanvas ?? defaultCreateCanvas;
    this.createBitmap = options.createBitmap ?? defaultCreateBitmap;
    this.copyBitmap = options.copyBitmap ?? ((bitmap) => createImageBitmap(bitmap));
  }

  async open(bytes: Uint8Array): Promise<Result<PdfDocumentHandle, PdfOpenError>> {
    const opened = await this.source.open(bytes);
    return opened.ok ? ok(new WorkingResolutionHandle(opened.value, this.createCanvas, this.createBitmap, this.copyBitmap, this.stats)) : opened;
  }
}

class WorkingResolutionHandle implements PdfDocumentHandle {
  readonly pageCount: number;
  private readonly infos = new Map<number, Promise<Result<PdfPageInfo, 'unknown'>>>();
  private readonly rasters = new Map<number, Promise<Result<WorkingRaster, PdfRenderError>>>();
  private readonly slots = new Slots(TUNABLES.resources.sourceDecodeSlots);
  private readonly lifetime = new AbortController();

  constructor(
    private readonly source: PdfDocumentHandle,
    private readonly createCanvas: (width: number, height: number) => DrawCanvas,
    private readonly createBitmap: (canvas: DrawCanvas) => Promise<ImageBitmap>,
    private readonly copyBitmap: (bitmap: ImageBitmap) => Promise<ImageBitmap>,
    private readonly stats: { sourceRenders: number },
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

  async destroy(): Promise<void> {
    this.lifetime.abort();
    const rasters = [...this.rasters.values()];
    this.rasters.clear();
    for (const pending of rasters) {
      const raster = await pending;
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

  /** The working raster of a page: made once (shared by every waiting request), the oldest ones are released. */
  private rasterOf(pageIndex: number, width: number, height: number, scale: number, signal: AbortSignal): Promise<Result<WorkingRaster, PdfRenderError>> {
    let pending = this.rasters.get(pageIndex);
    if (pending) {
      this.rasters.delete(pageIndex); // re-inserted below: most recently used last
    } else {
      pending = this.build(pageIndex, width, height, scale).then((result) => {
        if (!result.ok && this.rasters.get(pageIndex) === pending) {
          this.rasters.delete(pageIndex); // failures are not cached
        }
        return result;
      });
    }
    this.rasters.set(pageIndex, pending);
    this.evict();
    return this.waitFor(pending, signal);
  }

  private waitFor<T>(pending: Promise<Result<T, PdfRenderError>>, signal: AbortSignal): Promise<Result<T, PdfRenderError>> {
    if (signal.aborted) {
      return Promise.resolve(err('cancelled'));
    }
    return new Promise((resolve) => {
      const onAbort = (): void => resolve(err('cancelled'));
      signal.addEventListener('abort', onAbort, { once: true });
      void pending.then((result) => {
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      });
    });
  }

  private build(pageIndex: number, width: number, height: number, scale: number): Promise<Result<WorkingRaster, PdfRenderError>> {
    return this.withSlot(this.lifetime.signal, async (signal) => {
      this.stats.sourceRenders++;
      const rendered = await this.source.renderRegion({ pageIndex, region: { x: 0, y: 0, width, height }, scale }, signal);
      return rendered.ok ? ok({ bitmap: rendered.value, scale }) : rendered;
    });
  }

  /** Keeps `workingPagesKept` rasters; the least recently used are closed once they are built. */
  private evict(): void {
    while (this.rasters.size > TUNABLES.resources.workingPagesKept) {
      const oldest = this.rasters.keys().next().value as number;
      const pending = this.rasters.get(oldest);
      this.rasters.delete(oldest);
      void pending?.then((raster) => {
        if (raster.ok) {
          raster.value.bitmap.close();
        }
      });
    }
  }

  private async renderFromSource(req: RenderRequest, signal: AbortSignal): Promise<Result<ImageBitmap, PdfRenderError>> {
    return this.withSlot(signal, (slotSignal) => {
      this.stats.sourceRenders++;
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

