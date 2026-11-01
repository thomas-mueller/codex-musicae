import * as Comlink from 'comlink';

import type { Rect } from '../../core/geometry';
import type { DetectionEngine, DetectionError } from '../../ports/detection-engine';
import { err } from '../../ports/result';
import type { Result } from '../../ports/result';
import { mapDetectionError } from './map-error';
import type { DetectionWorkerApi } from './detection-worker-api';

/** Creates the one dedicated detection worker (DET-002) and its Comlink proxy. */
export function createDetectionWorkerApi(): DetectionWorkerApi {
  const worker = new Worker(new URL('../workers/detection.worker', import.meta.url), { type: 'module' });
  return Comlink.wrap<DetectionWorkerApi>(worker);
}

/** Main-thread proxy of the OpenCV worker. The worker is created on first use. */
export class OpenCvDetectionEngine implements DetectionEngine {
  private worker: DetectionWorkerApi | null = null;
  private nextTaskId = 0;

  constructor(private readonly createWorkerApi: () => DetectionWorkerApi = createDetectionWorkerApi) {}

  extractComponents(bitmap: ImageBitmap, signal: AbortSignal): Promise<Result<readonly Rect[], DetectionError>> {
    if (signal.aborted) {
      bitmap.close();
      return Promise.resolve(err('cancelled'));
    }
    const worker = (this.worker ??= this.createWorkerApi());
    const taskId = this.nextTaskId++;
    return new Promise((resolve) => {
      const onAbort = (): void => {
        void worker.cancel(taskId).catch(() => undefined);
        resolve(err('cancelled'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      worker.extract(Comlink.transfer(bitmap, [bitmap]), taskId).then(
        (result) => resolve(result),
        (thrown: unknown) => {
          const { error, detail } = mapDetectionError(thrown);
          resolve(err(error, detail));
        },
      ).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }
}
