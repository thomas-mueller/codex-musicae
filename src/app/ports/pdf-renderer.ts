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
}

export interface PdfDocumentHandle {
  readonly pageCount: number;
  getPageInfo(pageIndex: number): Promise<Result<PdfPageInfo, 'unknown'>>;
  /** Renders `region` at `scale`; the caller owns the bitmap and must `close()` it. Honors `signal`. */
  renderRegion(req: RenderRequest, signal: AbortSignal): Promise<Result<ImageBitmap, PdfRenderError>>;
  destroy(): Promise<void>;
}

export interface PdfRenderer {
  open(bytes: Uint8Array): Promise<Result<PdfDocumentHandle, PdfOpenError>>;
}

export const PDF_RENDERER = new InjectionToken<PdfRenderer>('PdfRenderer');
