import { TUNABLES } from '../../../config/tunables';
import type { ComponentSet, ExtractionParams } from '../../ports/detection-engine';

/** A deletable OpenCV object. */
interface CvDeletable {
  delete(): void;
}

/** The part of an OpenCV.js `Mat` that extraction uses. */
export interface CvMat extends CvDeletable {
  intAt(row: number, col: number): number;
}

/** The part of the OpenCV.js namespace that extraction uses (lets unit tests inject a fake). */
export interface CvLike {
  readonly COLOR_RGBA2GRAY: number;
  readonly INTER_AREA: number;
  readonly ADAPTIVE_THRESH_MEAN_C: number;
  readonly THRESH_BINARY_INV: number;
  readonly CV_32S: number;
  Mat: new () => CvMat;
  Size: new (width: number, height: number) => object;
  matFromImageData(imageData: ImageData): CvMat;
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  resize(src: CvMat, dst: CvMat, size: object, fx: number, fy: number, interpolation: number): void;
  adaptiveThreshold(src: CvMat, dst: CvMat, maxValue: number, method: number, type: number, blockSize: number, c: number): void;
  connectedComponentsWithStats(image: CvMat, labels: CvMat, stats: CvMat, centroids: CvMat, connectivity: number, ltype: number): number;
}

/**
 * DET-004: gray image, adaptive mean threshold (ink = foreground), 4-connected components. Returns
 * bounding rectangle and pixel count of every component in bitmap pixels; label 0 (the background) is skipped.
 * NFR-025: with `params.target` the gray image is first reduced to that size by area averaging (INTER_AREA), the same code in every browser.
 * NFR-011: every Mat is deleted in `finally`.
 */
export function extractComponentsWith(cv: CvLike, imageData: ImageData, params: ExtractionParams): ComponentSet {
  const mats: CvDeletable[] = [];
  const own = <T extends CvDeletable>(mat: T): T => {
    mats.push(mat);
    return mat;
  };
  try {
    const src = own(cv.matFromImageData(imageData));
    const gray = own(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const { target } = params;
    const reduce = target !== undefined && (target.width !== imageData.width || target.height !== imageData.height);
    let image = gray;
    if (reduce) {
      image = own(new cv.Mat());
      cv.resize(gray, image, new cv.Size(target.width, target.height), 0, 0, cv.INTER_AREA);
    }
    const bin = own(new cv.Mat());
    cv.adaptiveThreshold(image, bin, TUNABLES.detection.adaptiveMaxValue, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, params.blockSize, params.c);
    const labels = own(new cv.Mat());
    const stats = own(new cv.Mat());
    const centroids = own(new cv.Mat());
    const count = cv.connectedComponentsWithStats(bin, labels, stats, centroids, TUNABLES.detection.connectivity, cv.CV_32S);
    const col = TUNABLES.detection.ccStat;
    const components: ComponentSet['components'][number][] = [];
    for (let i = 1; i < count; i++) {
      components.push({
        rect: { x: stats.intAt(i, col.left), y: stats.intAt(i, col.top), width: stats.intAt(i, col.width), height: stats.intAt(i, col.height) },
        area: stats.intAt(i, col.area),
      });
    }
    return { width: reduce ? target.width : imageData.width, height: reduce ? target.height : imageData.height, components };
  } finally {
    for (const mat of mats) mat.delete();
  }
}
