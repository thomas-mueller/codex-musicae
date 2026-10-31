import { inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { cacheBudgetFor, LruByteCache } from '../core';
import { DEVICE_INFO } from '../ports/device-info';
import { ResourceGovernor } from './resource-governor';

const BYTES_PER_PIXEL = 4;
/** Key separator: every key starts with `${tabId}|`. */
const TAB_SEPARATOR = '|';

/**
 * NFR-004, NFR-009: byte-budget LRU of rendered bitmaps, shared by all tabs. The cache owns its bitmaps and
 * closes every one that leaves it. A bitmap too large for the budget is closed at once (`set` returns false)
 * and counts as a memory failure for the governor (NFR-010).
 */
@Injectable({ providedIn: 'root' })
export class BitmapCache {
  private readonly governor = inject(ResourceGovernor);
  readonly budgetBytes = cacheBudgetFor(
    inject(DEVICE_INFO).deviceMemoryGb(),
    TUNABLES.resources.cacheBudgetByDeviceMemoryGb,
    TUNABLES.resources.cacheBudgetDefaultBytes,
  );
  private readonly cache = new LruByteCache<ImageBitmap>(this.budgetBytes, (_key, bitmap, reason) => {
    bitmap.close();
    if (reason === 'rejected') {
      this.governor.reportFailure();
    }
  });

  get totalBytes(): number {
    return this.cache.totalBytes;
  }

  get(key: string): ImageBitmap | undefined {
    return this.cache.get(key);
  }

  /** Returns false when the bitmap was rejected (and closed). */
  set(key: string, bitmap: ImageBitmap): boolean {
    this.cache.set(key, bitmap, bitmap.width * bitmap.height * BYTES_PER_PIXEL);
    return this.cache.peek(key) === bitmap;
  }

  /** NFR-009: frees every bitmap of one tab. */
  releaseTab(tabId: string): void {
    const prefix = tabId + TAB_SEPARATOR;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
