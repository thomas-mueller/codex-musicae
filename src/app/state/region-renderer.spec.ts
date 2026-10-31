import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { DEVICE_INFO } from '../ports/device-info';
import { err, ok } from '../ports/result';
import { BitmapCache } from './bitmap-cache';
import { CLOCK } from './clock';
import { DocumentStore } from './document.store';
import { RegionRenderer } from './region-renderer';
import { ResourceGovernor } from './resource-governor';
import { fakeBitmap } from './testing/fake-bitmap';
import { FakeClock } from './testing/fake-clock';
import { fakeRenderer } from './testing/fake-renderer';
import type { FakeHandle } from './testing/fake-renderer';

const REGION = { x: 0, y: 0, width: 100, height: 50 };
const R = TUNABLES.resources;

async function setup(dpr = 1) {
  TestBed.configureTestingModule({
    providers: [
      { provide: CLOCK, useValue: new FakeClock() },
      { provide: DEVICE_INFO, useValue: { deviceMemoryGb: () => 4, devicePixelRatio: () => dpr } },
    ],
  });
  const renderer = fakeRenderer();
  const doc = new DocumentStore('t1', renderer);
  await doc.load(new Uint8Array([1]));
  const handle = renderer.handles[0] as FakeHandle;
  return {
    doc,
    handle,
    regions: TestBed.inject(RegionRenderer),
    cache: TestBed.inject(BitmapCache),
    governor: TestBed.inject(ResourceGovernor),
  };
}

const signal = (): AbortSignal => new AbortController().signal;
const scaleOf = (handle: FakeHandle, call = 0): number => handle.renderRegion.mock.calls[call]?.[0].scale ?? NaN;

describe('RegionRenderer.renderRegionCached', () => {
  it('NFR-004 renders once and serves the second request from the cache', async () => {
    const { doc, handle, regions } = await setup();
    const first = await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 1 }, signal());
    const second = await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 1 }, signal());
    expect(handle.renderRegion).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('NFR-004 different regions or scales are different cache entries', async () => {
    const { doc, handle, regions } = await setup();
    await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 1 }, signal());
    await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 2 }, signal());
    await regions.renderRegionCached(doc, { pageIndex: 1, region: REGION, scale: 1 }, signal());
    expect(handle.renderRegion).toHaveBeenCalledTimes(3);
  });

  it('NFR-005 multiplies by the device pixel ratio up to the cap', async () => {
    const { doc, handle, regions } = await setup(R.devicePixelRatioCap + 1);
    await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 1 }, signal());
    expect(scaleOf(handle)).toBe(R.devicePixelRatioCap);
  });

  it('NFR-006 caps the scale so the canvas stays within the pixel cap', async () => {
    const { doc, handle, regions } = await setup();
    const big = { x: 0, y: 0, width: 4000, height: 4000 };
    await regions.renderRegionCached(doc, { pageIndex: 0, region: big, scale: 4 }, signal());
    expect(big.width * scaleOf(handle) * big.height * scaleOf(handle)).toBeLessThanOrEqual(R.maxCanvasPixels + 1);
  });

  it('NFR-010 renders at the low-resolution factor once the governor reached level 2', async () => {
    const { doc, handle, regions, governor } = await setup();
    governor.reportFailure();
    (TestBed.inject(CLOCK) as FakeClock).advance(R.governorEscalateCooldownMs);
    governor.reportFailure();
    await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 1 }, signal());
    expect(scaleOf(handle)).toBe(R.governorLowResFactor);
  });

  it('NFR-010 retries once at a smaller scale after out-of-memory and reports the failure', async () => {
    const { doc, handle, regions, governor } = await setup();
    handle.renderRegion.mockResolvedValueOnce(err('out-of-memory'));
    const result = await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 2 }, signal());
    expect(result.ok).toBe(true);
    expect(handle.renderRegion).toHaveBeenCalledTimes(2);
    expect(scaleOf(handle, 1)).toBeCloseTo(2 * R.governorLowResFactor);
    expect(governor.level()).toBe(1);
  });

  it('NFR-010 gives up after the second out-of-memory', async () => {
    const { doc, handle, regions } = await setup();
    handle.renderRegion.mockResolvedValue(err('out-of-memory'));
    const result = await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 1 }, signal());
    expect(result).toEqual(err('out-of-memory'));
    expect(handle.renderRegion).toHaveBeenCalledTimes(2);
  });

  it('NFR-008 passes a cancelled render through without retry or caching', async () => {
    const { doc, handle, regions, cache } = await setup();
    handle.renderRegion.mockResolvedValueOnce(err('cancelled'));
    const result = await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 1 }, signal());
    expect(result).toEqual(err('cancelled'));
    expect(handle.renderRegion).toHaveBeenCalledTimes(1);
    expect(cache.totalBytes).toBe(0);
  });

  it('NFR-008 closes a bitmap that arrives after the signal aborted', async () => {
    const { doc, handle, regions, cache } = await setup();
    const controller = new AbortController();
    const bitmap = fakeBitmap();
    handle.renderRegion.mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve(ok(bitmap));
    });
    const result = await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 1 }, controller.signal);
    expect(result).toEqual(err('cancelled'));
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(cache.totalBytes).toBe(0);
  });

  it('NFR-010 a bitmap rejected by the cache counts as out-of-memory and is retried smaller', async () => {
    const { doc, handle, regions, cache } = await setup();
    const side = Math.ceil(Math.sqrt(cache.budgetBytes / 4)) + 1;
    const huge = fakeBitmap(side, side);
    handle.renderRegion.mockResolvedValueOnce(ok(huge));
    const result = await regions.renderRegionCached(doc, { pageIndex: 0, region: REGION, scale: 1 }, signal());
    expect(huge.close).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(handle.renderRegion).toHaveBeenCalledTimes(2);
  });

  it('FIL-009 returns an error when the document has no handle', async () => {
    const { regions } = await setup();
    const failed = new DocumentStore('t2', fakeRenderer('invalid'));
    await failed.load(new Uint8Array([0]));
    expect(await regions.renderRegionCached(failed, { pageIndex: 0, region: REGION, scale: 1 }, signal())).toEqual(
      err('unknown'),
    );
  });
});
