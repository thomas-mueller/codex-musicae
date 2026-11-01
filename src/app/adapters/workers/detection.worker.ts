import * as Comlink from 'comlink';

import { TUNABLES } from '../../../config/tunables';
import type { ComponentSet, DetectionError, ExtractionParams } from '../../ports/detection-engine';
import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';
import type { DetectionWorkerApi } from '../opencv/detection-worker-api';
import { extractComponentsWith } from '../opencv/extract-components';
import type { CvLike } from '../opencv/extract-components';
import { mapDetectionError } from '../opencv/map-error';

let cvPromise: Promise<CvLike> | null = null;
const cancelled = new Set<number>();

/** NFR-012: OpenCV.js is fetched from our own assets on first use. A module worker has no importScripts, so the UMD wrapper is evaluated directly. */
function loadCv(): Promise<CvLike> {
  cvPromise ??= (async () => {
    const response = await fetch(new URL(TUNABLES.detection.opencvAssetPath, self.location.href));
    if (!response.ok) throw new Error(`opencv asset ${response.status}`);
    const code = await response.text();
    const module: { exports: unknown } = { exports: {} };
    new Function('module', 'exports', 'define', code)(module, module.exports, undefined);
    return (await module.exports) as CvLike;
  })();
  cvPromise.catch(() => (cvPromise = null)); // a failed load is retried on the next page
  return cvPromise;
}

function toImageData(bitmap: ImageBitmap): ImageData {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new RangeError('no 2d context');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

const api: DetectionWorkerApi = {
  async extract(bitmap: ImageBitmap, taskId: number, params: ExtractionParams): Promise<Result<ComponentSet, DetectionError>> {
    try {
      const cv = await loadCv();
      if (cancelled.has(taskId)) return err('cancelled');
      const components = extractComponentsWith(cv, toImageData(bitmap), params);
      return cancelled.has(taskId) ? err('cancelled') : ok(components);
    } catch (thrown) {
      const { error, detail } = mapDetectionError(thrown);
      return err(error, detail);
    } finally {
      bitmap.close();
      cancelled.delete(taskId);
    }
  },
  async cancel(taskId: number): Promise<void> {
    cancelled.add(taskId);
  },
};

Comlink.expose(api);
