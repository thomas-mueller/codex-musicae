# OpenCV adapters

Implementation of the `DetectionEngine` port (`src/app/ports/detection-engine.ts`) with OpenCV.js in one dedicated worker (DET-002).

- `extract-components.ts` — the detection pipeline (DET-004): RGBA → gray → `adaptiveThreshold` (mean, `THRESH_BINARY_INV`, block size and C of the level) → 4-connected `connectedComponentsWithStats`; returns bounding rectangle and pixel area of every component except the background, with the bitmap size. Every `Mat` is freed in `finally` (NFR-011).
- `opencv-detection-engine.ts` — main-thread proxy (Comlink), cancellation, error mapping (`map-error.ts`).
- `../workers/detection.worker.ts` — the worker; OpenCV.js is loaded from our own assets on first use (NFR-012).

The selection of the systems among the components is pure and lives in `core/system-selection.ts`; `state/detection.service.ts` connects the two.
