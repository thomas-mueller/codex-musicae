import { describe, expect, it, vi } from 'vitest';

import { err, ok } from '../../ports/result';
import type { ComponentSet } from '../../ports/detection-engine';
import type { DetectionWorkerApi } from './detection-worker-api';
import { OpenCvDetectionEngine } from './opencv-detection-engine';

const PARAMS = { blockSize: 31, c: 15 };
const EMPTY: ComponentSet = { width: 1, height: 1, components: [] };

function fakeBitmap(): ImageBitmap {
  return { width: 1, height: 1, close: vi.fn() } as unknown as ImageBitmap;
}

describe('OpenCvDetectionEngine', () => {
  it('DET-002 creates one worker and reuses it for every page', async () => {
    const api: DetectionWorkerApi = { extract: vi.fn(async () => ok(EMPTY)), cancel: vi.fn(async () => undefined) };
    const create = vi.fn(() => api);
    const engine = new OpenCvDetectionEngine(create);
    const controller = new AbortController();
    await engine.extractComponents(fakeBitmap(), controller.signal, PARAMS);
    await engine.extractComponents(fakeBitmap(), controller.signal, PARAMS);
    expect(create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.extract).mock.calls.map((c) => c[1])).toEqual([0, 1]);
  });

  it('DET-002 returns the worker result', async () => {
    const set: ComponentSet = { width: 10, height: 20, components: [{ rect: { x: 0, y: 0, width: 4, height: 5 }, area: 12 }] };
    const api: DetectionWorkerApi = { extract: async () => ok(set), cancel: async () => undefined };
    const result = await new OpenCvDetectionEngine(() => api).extractComponents(fakeBitmap(), new AbortController().signal, PARAMS);
    expect(result).toEqual(ok(set));
  });

  it('DET-002 answers cancelled and closes the bitmap when already aborted', async () => {
    const create = vi.fn();
    const bitmap = fakeBitmap();
    const controller = new AbortController();
    controller.abort();
    const result = await new OpenCvDetectionEngine(create).extractComponents(bitmap, controller.signal, PARAMS);
    expect(result).toEqual(err('cancelled'));
    expect(bitmap.close).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('DET-002 answers cancelled at once on abort and flags the worker task', async () => {
    const cancel = vi.fn(async () => undefined);
    const api: DetectionWorkerApi = { extract: () => new Promise(() => undefined), cancel };
    const controller = new AbortController();
    const pending = new OpenCvDetectionEngine(() => api).extractComponents(fakeBitmap(), controller.signal, PARAMS);
    controller.abort();
    expect(await pending).toEqual(err('cancelled'));
    expect(cancel).toHaveBeenCalledWith(0);
  });

  it('DET-018 maps a rejected worker call to a typed error', async () => {
    const api: DetectionWorkerApi = { extract: () => Promise.reject(new RangeError('x')), cancel: async () => undefined };
    const result = await new OpenCvDetectionEngine(() => api).extractComponents(fakeBitmap(), new AbortController().signal, PARAMS);
    expect(result).toMatchObject({ ok: false, error: 'out-of-memory' });
  });
});
