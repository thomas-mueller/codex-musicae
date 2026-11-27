/** Port PdfRenderer (first used in M8). Implementation: pdf.js. */
import { InjectionToken } from '@angular/core';
import type { PageBox, Rect } from '../core/geometry';
import type { Result } from './result';

export type PdfOpenError = 'invalid' | 'encrypted' | 'empty' | 'unknown';
export type PdfRenderError = 'cancelled' | 'out-of-memory' | 'unknown';

export interface PdfPageInfo {
  readonly pageIndex: number; // 0-based
  readonly box: PageBox;
  /** Page size in display space (scale 1, /Rotate applied). */
  readonly width: number;
  readonly height: number;
}

export interface RenderRequest {
  readonly pageIndex: number;
  /** Region of the page in display space. */
  readonly region: Rect;
  /** Bitmap pixels per display point (already capped by the caller). */
  readonly scale: number;
  /** NFR-028: drop what the renderer kept of this page (decoded images, parsed operators) first, so a second render starts cold. */
  readonly fresh?: boolean;
}

/** The page at the working resolution of the renderer: `scale` bitmap pixels per display point. */
export interface WorkingRaster {
  readonly bitmap: ImageBitmap;
  readonly scale: number;
}

export interface PdfDocumentHandle {
  readonly pageCount: number;
  getPageInfo(pageIndex: number): Promise<Result<PdfPageInfo, 'unknown'>>;
  /** Renders `region` at `scale`; the caller owns the bitmap and must `close()` it. Honors `signal`. */
  renderRegion(req: RenderRequest, signal: AbortSignal): Promise<Result<ImageBitmap, PdfRenderError>>;
  /**
   * NFR-025: the whole page at the renderer's working resolution, without any resampling by the browser; the caller owns the bitmap.
   * Optional: a renderer without a working raster does not offer it and callers render the region they need.
   */
  renderWorkingRaster?(pageIndex: number, signal: AbortSignal): Promise<Result<WorkingRaster, PdfRenderError>>;
  /**
   * NFR-020: frees the rendered data the renderer keeps of this document (page rasters, decoded page content); renders that
   * run are not disturbed and later ones build it again. Optional: a renderer that keeps nothing does not offer it.
   */
  releaseRendered?(): void;
  /** Bytes of the page rasters kept for this document (development debug hook). */
  renderedBytes?(): number;
  destroy(): Promise<void>;
}

export interface PdfRenderer {
  open(bytes: Uint8Array): Promise<Result<PdfDocumentHandle, PdfOpenError>>;
}

export const PDF_RENDERER = new InjectionToken<PdfRenderer>('PdfRenderer');
