import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { APP_LIFECYCLE } from '../ports/app-lifecycle';
import { DETECTION_ENGINE } from '../ports/detection-engine';
import type { ExtractionParams } from '../ports/detection-engine';
import type { WorkingRaster } from '../ports/pdf-renderer';
import { ok } from '../ports/result';
import { CLOCK } from './clock';
import { DetectionService } from './detection.service';
import { DocumentStore } from './document.store';
import { fakeBitmap } from './testing/fake-bitmap';
import { FakeClock } from './testing/fake-clock';
import { fakeRenderer } from './testing/fake-renderer';

const PAGES = 2;
const PAGE_WIDTH = 600; // the fake renderer's page size
const PAGE_HEIGHT = 800;
const LEVEL = TUNABLES.detection.levels[TUNABLES.detection.defaultLevel];

const until = async (condition: () => boolean): Promise<void> => {
  for (let i = 0; i < 200 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(condition()).toBe(true);
};

function setup(rasterScale: number | null) {
  const renderer = fakeRenderer('invalid', PAGES);
  const received: ExtractionParams[] = [];
  const engine = {
    extractComponents: vi.fn(async (bitmap: ImageBitmap, _signal: AbortSignal, params: ExtractionParams) => {
      received.push(params);
      bitmap.close();
      return ok({ width: params.target?.width ?? bitmap.width, height: params.target?.height ?? bitmap.height, components: [] });
    }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DETECTION_ENGINE, useValue: engine },
      { provide: APP_LIFECYCLE, useValue: { visible: signal(true), userActive: signal(false), batterySaver: signal<boolean | null>(null), onPause: () => () => undefined } },
      { provide: CLOCK, useValue: new FakeClock() },
    ],
  });
  const service = TestBed.inject(DetectionService);
  const open = async () => {
    const doc = new DocumentStore('t1', renderer);
    await doc.load(new Uint8Array([1]));
    const handle = renderer.handles[0]!;
    const rasters: ImageBitmap[] = [];
    if (rasterScale !== null) {
      handle.renderWorkingRaster = vi.fn(() => {
        const bitmap = fakeBitmap(Math.round(PAGE_WIDTH * rasterScale), Math.round(PAGE_HEIGHT * rasterScale));
        rasters.push(bitmap);
        return Promise.resolve(ok<WorkingRaster>({ bitmap, scale: rasterScale }));
      });
    }
    return { doc, handle, rasters };
  };
  return { service, engine, received, open };
}

describe('Detection from the working raster (NFR-025)', () => {
  it('NFR-025 DET-035 detection takes the working raster and lets the engine reduce it to the level size', async () => {
    const { service, open, received } = setup(LEVEL.renderScale * 2);
    const { doc, handle, rasters } = await open();
    service.start(doc);
    await until(() => doc.detectionComplete());
    expect(handle.renderRegion).not.toHaveBeenCalled();
    expect(rasters).toHaveLength(PAGES);
    expect(received.every((p) => p.target?.width === Math.round(PAGE_WIDTH * LEVEL.renderScale) && p.target?.height === Math.round(PAGE_HEIGHT * LEVEL.renderScale))).toBe(true);
    expect(received[0]).toMatchObject({ blockSize: LEVEL.adaptiveBlockSize, c: LEVEL.adaptiveC });
  });

  it('NFR-025 DET-035 a working raster smaller than the level size is closed and the region is rendered as before', async () => {
    const { service, open, received } = setup(LEVEL.renderScale / 2);
    const { doc, handle, rasters } = await open();
    service.start(doc);
    await until(() => doc.detectionComplete());
    expect(handle.renderRegion).toHaveBeenCalled();
    expect(rasters.every((b) => (b as ImageBitmap & { close: { mock: { calls: unknown[] } } }).close.mock.calls.length === 1)).toBe(true);
    expect(received.every((p) => p.target === undefined)).toBe(true);
  });

  it('NFR-025 DET-035 a renderer without a working raster is used as before', async () => {
    const { service, open, received } = setup(null);
    const { doc, handle } = await open();
    service.start(doc);
    await until(() => doc.detectionComplete());
    expect(handle.renderRegion).toHaveBeenCalled();
    expect(received.every((p) => p.target === undefined)).toBe(true);
  });
});
