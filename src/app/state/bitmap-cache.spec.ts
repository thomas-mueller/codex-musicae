import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { DEVICE_INFO } from '../ports/device-info';
import { BitmapCache } from './bitmap-cache';
import { ResourceGovernor } from './resource-governor';
import { fakeBitmap } from './testing/fake-bitmap';

function setup(memoryGb: number | null = 1) {
  TestBed.configureTestingModule({
    providers: [{ provide: DEVICE_INFO, useValue: { deviceMemoryGb: () => memoryGb ?? undefined, devicePixelRatio: () => 1 } }],
  });
  return { cache: TestBed.inject(BitmapCache), governor: TestBed.inject(ResourceGovernor) };
}

const SIDE_FOR_BYTES = (bytes: number): number => Math.floor(Math.sqrt(bytes / 4));

describe('BitmapCache', () => {
  it('NFR-004 takes its budget from the device memory bucket', () => {
    expect(setup(4).cache.budgetBytes).toBe(TUNABLES.resources.cacheBudgetByDeviceMemoryGb[4]);
  });

  it('NFR-004 uses the default budget when the memory is unknown', () => {
    expect(setup(null).cache.budgetBytes).toBe(TUNABLES.resources.cacheBudgetDefaultBytes);
  });

  it('NFR-004 counts width*height*4 bytes per bitmap', () => {
    const { cache } = setup();
    cache.set('t1|a', fakeBitmap(10, 20));
    expect(cache.totalBytes).toBe(800);
  });

  it('NFR-004 closes evicted bitmaps and keeps the cache within the budget', () => {
    const { cache } = setup();
    const side = SIDE_FOR_BYTES(cache.budgetBytes / 2) - 1;
    const bitmaps = [fakeBitmap(side, side), fakeBitmap(side, side), fakeBitmap(side, side)];
    bitmaps.forEach((b, i) => cache.set(`t1|${i}`, b));
    expect(bitmaps[0]?.close).toHaveBeenCalledTimes(1);
    expect(bitmaps[2]?.close).not.toHaveBeenCalled();
    expect(cache.totalBytes).toBeLessThanOrEqual(cache.budgetBytes);
  });

  it('NFR-004 closes a replaced bitmap', () => {
    const { cache } = setup();
    const first = fakeBitmap();
    cache.set('t1|a', first);
    cache.set('t1|a', fakeBitmap());
    expect(first.close).toHaveBeenCalledTimes(1);
  });

  it('NFR-009 releaseTab closes and removes only that tab\'s bitmaps', () => {
    const { cache } = setup();
    const a = fakeBitmap();
    const b = fakeBitmap();
    const other = fakeBitmap();
    cache.set('t1|a', a);
    cache.set('t1|b', b);
    cache.set('t10|a', other);
    cache.releaseTab('t1');
    expect(a.close).toHaveBeenCalledTimes(1);
    expect(b.close).toHaveBeenCalledTimes(1);
    expect(other.close).not.toHaveBeenCalled();
    expect(cache.get('t10|a')).toBe(other);
    expect(cache.get('t1|a')).toBeUndefined();
  });

  it('NFR-010 a bitmap above the budget is closed, rejected and reported to the governor', () => {
    const { cache, governor } = setup();
    const huge = fakeBitmap(SIDE_FOR_BYTES(cache.budgetBytes) + 10, SIDE_FOR_BYTES(cache.budgetBytes) + 10);
    expect(cache.set('t1|huge', huge)).toBe(false);
    expect(huge.close).toHaveBeenCalledTimes(1);
    expect(cache.totalBytes).toBe(0);
    expect(governor.level()).toBe(1);
  });

  it('NFR-009 clear closes everything', () => {
    const { cache } = setup();
    const a = fakeBitmap();
    cache.set('t1|a', a);
    cache.clear();
    expect(a.close).toHaveBeenCalledTimes(1);
    expect(cache.totalBytes).toBe(0);
  });
});
