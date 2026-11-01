import type { ComponentSet, DetectionError, ExtractionParams } from '../../ports/detection-engine';
import type { Result } from '../../ports/result';

/** The API the detection worker exposes through Comlink (also the shape the main-thread proxy calls). */
export interface DetectionWorkerApi {
  /** Takes ownership of `bitmap` (closed in the worker). A cancelled task still frees everything and answers `cancelled`. */
  extract(bitmap: ImageBitmap, taskId: number, params: ExtractionParams): Promise<Result<ComponentSet, DetectionError>>;
  cancel(taskId: number): Promise<void>;
}
