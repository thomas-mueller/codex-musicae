import { TUNABLES } from '../../../config/tunables';
import type { PageBox, PageRotation } from '../../core/geometry';
import type {
  PdfDocumentHandle,
  PdfOpenError,
  PdfPageInfo,
  PdfRenderError,
  PdfRenderer,
  RenderRequest,
} from '../../ports/pdf-renderer';
import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';

/** The part of a pdf.js page that the adapter uses (lets unit tests inject a fake). */
export interface PdfjsPage {
  readonly view: readonly [number, number, number, number];
  readonly rotate: number;
  getViewport(options: { scale: number; offsetX?: number; offsetY?: number }): { width: number; height: number };
  render(params: { canvasContext: unknown; canvas: null; viewport: unknown; annotationMode: number }): {
    promise: Promise<void>;
    cancel(): void;
  };
  cleanup(): void;
}

export interface PdfjsDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfjsPage>;
  destroy(): Promise<void>;
}

export interface PdfjsModule {
  readonly GlobalWorkerOptions: { workerSrc: string };
  getDocument(source: Record<string, unknown>): { promise: Promise<PdfjsDocument>; destroy(): Promise<void> };
}

/** Canvas surface the adapter draws on: `OffscreenCanvas` or a detached `<canvas>`. */
interface RenderCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): unknown;
}

interface PdfJsRendererOptions {
  readonly loadModule?: () => Promise<PdfjsModule>;
  readonly createCanvas?: (width: number, height: number) => RenderCanvas;
  readonly createBitmap?: (canvas: RenderCanvas) => Promise<ImageBitmap>;
  /** NFR-026: pages whose pdf.js state stays warm after a render (the composition root resolves it from the device memory). */
  readonly warmPages?: number;
  /** Base for the relative asset paths in `T:pdf`. */
  readonly baseUri?: string;
}

const NAME_PASSWORD = 'PasswordException';
const NAME_CANCELLED = 'RenderingCancelledException';

function errorName(e: unknown): string {
  return e instanceof Error ? e.name : '';
}

function isAllocationFailure(e: unknown): boolean {
  return e instanceof RangeError || (e instanceof DOMException && e.name === 'QuotaExceededError');
}

function defaultCreateCanvas(width: number, height: number): RenderCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height) as unknown as RenderCanvas;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function defaultCreateBitmap(canvas: RenderCanvas): Promise<ImageBitmap> {
  return createImageBitmap(canvas as unknown as ImageBitmapSource);
}

function releaseCanvas(canvas: RenderCanvas): void {
  canvas.width = 0;
  canvas.height = 0;
}

export class PdfJsRenderer implements PdfRenderer {
  private readonly loadModule: () => Promise<PdfjsModule>;
  private readonly createCanvas: (width: number, height: number) => RenderCanvas;
  private readonly createBitmap: (canvas: RenderCanvas) => Promise<ImageBitmap>;
  private readonly baseUri: string;
  private readonly warmPages: number;
  private modulePromise: Promise<PdfjsModule> | null = null;

  constructor(options: PdfJsRendererOptions = {}) {
    this.loadModule = options.loadModule ?? (() => import('pdfjs-dist') as unknown as Promise<PdfjsModule>);
    this.createCanvas = options.createCanvas ?? defaultCreateCanvas;
    this.createBitmap = options.createBitmap ?? defaultCreateBitmap;
    this.baseUri = options.baseUri ?? document.baseURI;
    this.warmPages = options.warmPages ?? TUNABLES.pdf.warmPagesDefault;
  }

  async open(bytes: Uint8Array): Promise<Result<PdfDocumentHandle, PdfOpenError>> {
    let pdfjs: PdfjsModule;
    try {
      pdfjs = await this.module();
    } catch {
      return err('unknown');
    }
    try {
      const task = pdfjs.getDocument({
        data: bytes.slice(),
        cMapUrl: this.url(TUNABLES.pdf.cMapUrl),
        cMapPacked: true,
        standardFontDataUrl: this.url(TUNABLES.pdf.standardFontDataUrl),
        wasmUrl: this.url(TUNABLES.pdf.wasmUrl),
        iccUrl: this.url(TUNABLES.pdf.iccUrl),
        // NFR-025: images larger than this are reduced in the worker; the app never needs more than the working resolution of a page.
        canvasMaxAreaInBytes: TUNABLES.pdf.sourceImageMaxBytes,
      });
      const doc = await task.promise;
      if (doc.numPages === 0) {
        await doc.destroy().catch(() => undefined);
        return err('empty');
      }
      return ok(new PdfJsDocumentHandle(doc, this.createCanvas, this.createBitmap, this.warmPages));
    } catch (e) {
      return err(errorName(e) === NAME_PASSWORD ? 'encrypted' : 'invalid');
    }
  }

  private module(): Promise<PdfjsModule> {
    this.modulePromise ??= this.loadModule().then((m) => {
      m.GlobalWorkerOptions.workerSrc = this.url(TUNABLES.pdf.workerSrc);
      return m;
    });
    return this.modulePromise;
  }

  private url(path: string): string {
    return new URL(path, this.baseUri).href;
  }
}

class PdfJsDocumentHandle implements PdfDocumentHandle {
  readonly pageCount: number;
  /** NFR-026: page numbers (1-based) whose pdf.js state is kept, least recently rendered first. */
  private warm: number[] = [];

  constructor(
    private readonly doc: PdfjsDocument,
    private readonly createCanvas: (width: number, height: number) => RenderCanvas,
    private readonly createBitmap: (canvas: RenderCanvas) => Promise<ImageBitmap>,
    private readonly warmLimit: number,
  ) {
    this.pageCount = doc.numPages;
  }

  async getPageInfo(pageIndex: number): Promise<Result<PdfPageInfo, 'unknown'>> {
    try {
      const page = await this.doc.getPage(pageIndex + 1);
      const [x0, y0, x1, y1] = page.view;
      const box: PageBox = { view: [x0, y0, x1, y1], rotate: page.rotate as PageRotation };
      const viewport = page.getViewport({ scale: 1 });
      if (!this.warm.includes(pageIndex + 1)) {
        page.cleanup();
      }
      return ok({ pageIndex, box, width: viewport.width, height: viewport.height });
    } catch {
      return err('unknown');
    }
  }

  async renderRegion(req: RenderRequest, signal: AbortSignal): Promise<Result<ImageBitmap, PdfRenderError>> {
    if (signal.aborted) {
      return err('cancelled');
    }
    const width = Math.ceil(req.region.width * req.scale);
    const height = Math.ceil(req.region.height * req.scale);
    if (width * height > TUNABLES.resources.maxCanvasPixels) {
      return err('out-of-memory');
    }
    let canvas: RenderCanvas | null = null;
    let onAbort: (() => void) | null = null;
    const pageNumber = req.pageIndex + 1;
    let page: PdfjsPage | null = null;
    try {
      page = await this.doc.getPage(pageNumber);
      if (signal.aborted) {
        return err('cancelled');
      }
      canvas = this.createCanvas(width, height);
      const context = canvas.getContext('2d');
      if (!context) {
        return err('out-of-memory');
      }
      const viewport = page.getViewport({
        scale: req.scale,
        offsetX: -req.region.x * req.scale,
        offsetY: -req.region.y * req.scale,
      });
      const task = page.render({ canvasContext: context, canvas: null, viewport, annotationMode: TUNABLES.pdf.annotationModeDisable });
      onAbort = () => task.cancel();
      signal.addEventListener('abort', onAbort, { once: true });
      await task.promise;
      const bitmap = await this.createBitmap(canvas);
      if (signal.aborted) {
        bitmap.close();
        return err('cancelled');
      }
      this.markWarm(pageNumber, page);
      return ok(bitmap);
    } catch (e) {
      if (page && !this.warm.includes(pageNumber)) {
        page.cleanup(); // a cancelled or failed render of a cold page leaves no pdf.js state behind
      }
      if (signal.aborted || errorName(e) === NAME_CANCELLED) {
        return err('cancelled');
      }
      return err(isAllocationFailure(e) ? 'out-of-memory' : 'unknown');
    } finally {
      if (onAbort) {
        signal.removeEventListener('abort', onAbort);
      }
      if (canvas) {
        releaseCanvas(canvas);
      }
    }
  }

  /**
   * NFR-026: releases the pdf.js state of every warm page.
   * NFR-020: V2-M6 must call it where an inactive tab drops its bitmaps; that needs an optional method on the `PdfDocumentHandle` port.
   */
  releaseWarmPages(): void {
    const pages = this.warm;
    this.warm = [];
    for (const number of pages) {
      void this.cleanupPage(number);
    }
  }

  /** Remembers a rendered page as the most recent warm one; the pages beyond the limit are cleaned up. */
  private markWarm(pageNumber: number, page: PdfjsPage): void {
    if (this.warmLimit <= 0) {
      page.cleanup();
      return;
    }
    this.warm = [...this.warm.filter((n) => n !== pageNumber), pageNumber];
    while (this.warm.length > this.warmLimit) {
      void this.cleanupPage(this.warm.shift()!);
    }
  }

  private async cleanupPage(pageNumber: number): Promise<void> {
    try {
      (await this.doc.getPage(pageNumber)).cleanup();
    } catch {
      // the document is gone or the page cannot be loaded: nothing left to release
    }
  }

  async destroy(): Promise<void> {
    const pages = this.warm;
    this.warm = [];
    await Promise.all(pages.map((n) => this.cleanupPage(n)));
    try {
      await this.doc.destroy();
    } catch {
      // nothing left to release
    }
  }
}
