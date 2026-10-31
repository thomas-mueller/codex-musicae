import { inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import type { Rect } from '../core';
import { fitScaleToPixelCap } from '../core';
import { DEVICE_INFO } from '../ports/device-info';
import type { PdfRenderError } from '../ports/pdf-renderer';
import { err, ok } from '../ports/result';
import type { Result } from '../ports/result';
import { BitmapCache } from './bitmap-cache';
import type { DocumentStore } from './document.store';
import { ResourceGovernor } from './resource-governor';

export interface CachedRenderRequest {
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
    // The tab may have been closed while rendering: never put a bitmap of a disposed document into the cache.
    if (signal.aborted || doc.handle() !== handle) {
      rendered.value.close();
      return err('cancelled');
    }
    // A bitmap above the whole budget is closed by the cache and reported to the governor there.
    return this.cache.set(key, rendered.value) ? rendered : err('out-of-memory');
  }
}
