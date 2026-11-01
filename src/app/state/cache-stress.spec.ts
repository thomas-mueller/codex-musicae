import { TestBed } from '@angular/core/testing';

import { DEVICE_INFO } from '../ports/device-info';
import { ok } from '../ports/result';
import { BitmapCache } from './bitmap-cache';
import { CLOCK } from './clock';
import { DocumentStore } from './document.store';
import { RegionRenderer } from './region-renderer';
import { fakeBitmap } from './testing/fake-bitmap';
import type { FakeBitmap } from './testing/fake-bitmap';
import { FakeClock } from './testing/fake-clock';
import { fakeRenderer } from './testing/fake-renderer';
import type { FakeHandle } from './testing/fake-renderer';

const REGIONS = 400;
const BITMAP_SIDE = 700;
const TABS = 3;

describe('bitmap cache under load', () => {
  it('NFR-004 NFR-009 never exceeds its budget and closes every bitmap exactly once', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: CLOCK, useValue: new FakeClock() },
        { provide: DEVICE_INFO, useValue: { deviceMemoryGb: () => 1, devicePixelRatio: () => 1, prefersReducedMotion: () => false, screenSize: () => ({ width: 1280, height: 800 }) } },
      ],
    });
    const cache = TestBed.inject(BitmapCache);
    const regions = TestBed.inject(RegionRenderer);
    const created: FakeBitmap[] = [];
    const docs: DocumentStore[] = [];
    for (let t = 0; t < TABS; t++) {
      const renderer = fakeRenderer();
      const doc = new DocumentStore(`t${t}`, renderer);
      await doc.load(new Uint8Array([1]));
      (renderer.handles[0] as FakeHandle).renderRegion.mockImplementation(() => {
        const bitmap = fakeBitmap(BITMAP_SIDE, BITMAP_SIDE);
        created.push(bitmap);
        return Promise.resolve(ok(bitmap));
      });
      docs.push(doc);
    }
    const signal = new AbortController().signal;
    for (let i = 0; i < REGIONS; i++) {
      const doc = docs[i % TABS] as DocumentStore;
      await regions.renderRegionCached(
        doc,
        { pageIndex: 0, region: { x: i, y: 0, width: BITMAP_SIDE, height: BITMAP_SIDE }, scale: 1 },
        signal,
      );
      expect(cache.totalBytes).toBeLessThanOrEqual(cache.budgetBytes);
      if (i % (REGIONS / TABS) === 0) {
        cache.releaseTab(doc.tabId);
      }
    }
    cache.clear();
    expect(cache.totalBytes).toBe(0);
    expect(created.length).toBeGreaterThan(REGIONS / 2);
    for (const bitmap of created) {
      expect(bitmap.close).toHaveBeenCalledTimes(1);
    }
  });
});
