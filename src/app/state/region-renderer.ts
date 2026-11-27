import { inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import type { Rect } from '../core';
import { BITMAP_BYTES_PER_PIXEL, fitScaleToPixelCap } from '../core';
import { DEVICE_INFO } from '../ports/device-info';
import type { PdfRenderError } from '../ports/pdf-renderer';
import { err, ok } from '../ports/result';
import type { Result } from '../ports/result';
import { BitmapCache } from './bitmap-cache';
import type { DocumentStore } from './document.store';
import { ResourceGovernor } from './resource-governor';

interface CachedRenderRequest {
  readonly pageIndex: number;
  /** Region of the page in display space. */
  readonly region: Rect;
  /** Wanted bitmap pixels per CSS pixel region point (the zoom); device pixel ratio and caps are applied here. */
  readonly scale: number;
}

const KEY_SEPARATOR = '|';

/**
 * NFR-005, NFR-006, NFR-004: renders a region through the bitmap cache.
 * The returned bitmap is owned by the cache: callers draw it at once and never close it.
 */
@Injectable({ providedIn: 'root' })
export class RegionRenderer {
  private readonly cache = inject(BitmapCache);
  private readonly governor = inject(ResourceGovernor);
  private readonly device = inject(DEVICE_INFO);

  async renderRegionCached(
    doc: DocumentStore,
    request: CachedRenderRequest,
    signal: AbortSignal,
  ): Promise<Result<ImageBitmap, PdfRenderError>> {
    const dpr = Math.min(this.device.devicePixelRatio(), TUNABLES.resources.devicePixelRatioCap);
    const wanted = request.scale * dpr * this.governor.renderScaleFactor();
    const first = await this.attempt(doc, request, this.fit(request.region, wanted), signal);
    if (first.ok || first.error !== 'out-of-memory') {
      return first;
    }
    this.governor.reportFailure();
    const smaller = this.fit(request.region, wanted * TUNABLES.resources.governorLowResFactor);
    return this.attempt(doc, request, smaller, signal);
  }

  /** NFR-027: the bytes the bitmap of `renderRegionCached` for this region and scale takes in the cache (without rendering). */
  estimatedBytes(region: Rect, scale: number): number {
    const dpr = Math.min(this.device.devicePixelRatio(), TUNABLES.resources.devicePixelRatioCap);
    const pxPerUnit = this.fit(region, scale * dpr * this.governor.renderScaleFactor());
    return Math.ceil(region.width * pxPerUnit) * Math.ceil(region.height * pxPerUnit) * BITMAP_BYTES_PER_PIXEL;
  }

  private fit(region: Rect, scale: number): number {
    return fitScaleToPixelCap(region.width, region.height, scale, TUNABLES.resources.maxCanvasPixels);
  }

  private async attempt(
    doc: DocumentStore,
    request: CachedRenderRequest,
    scale: number,
    signal: AbortSignal,
  ): Promise<Result<ImageBitmap, PdfRenderError>> {
    const handle = doc.handle();
    if (!handle) {
      return err('unknown');
    }
    const { pageIndex, region } = request;
    const key = [doc.tabId, pageIndex, region.x, region.y, region.width, region.height, scale].join(KEY_SEPARATOR);
    const cached = this.cache.get(key);
    if (cached) {
      return ok(cached);
    }
    const rendered = await handle.renderRegion({ pageIndex, region, scale }, signal);
    if (!rendered.ok) {
      return rendered;
    }
    // The file may have been closed or left while rendering: never cache a bitmap of a disposed or inactive one (NFR-020).
    if (signal.aborted || doc.handle() !== handle || !doc.shown) {
      rendered.value.close();
      if (!doc.shown) {
        doc.releaseRendered(); // the render may have built a raster after the file was left
      }
      return err('cancelled');
    }
    // A bitmap above the whole budget is closed by the cache and reported to the governor there.
    return this.cache.set(key, rendered.value) ? rendered : err('out-of-memory');
  }
}
