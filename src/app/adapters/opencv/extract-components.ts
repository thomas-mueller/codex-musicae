import { TUNABLES } from '../../../config/tunables';
import type { Rect } from '../../core/geometry';

/** A deletable OpenCV object. */
export interface CvDeletable {
  delete(): void;
}

/** The part of an OpenCV.js `Mat` that extraction uses. */
export interface CvMat extends CvDeletable {
  intAt(row: number, col: number): number;
}

/** The part of the OpenCV.js namespace that extraction uses (lets unit tests inject a fake). */
export interface CvLike {
  readonly COLOR_RGBA2GRAY: number;
  readonly THRESH_BINARY_INV: number;
  readonly THRESH_OTSU: number;
  Mat: new () => CvMat;
  matFromImageData(imageData: ImageData): CvMat;
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  threshold(src: CvMat, dst: CvMat, thresh: number, maxval: number, type: number): number;
  connectedComponentsWithStats(image: CvMat, labels: CvMat, stats: CvMat, centroids: CvMat, connectivity: number): number;
}

/**
 * DET-004: Otsu binarization (ink = foreground) and the bounding rectangle of every connected component in
 * bitmap pixels; component 0 is the background, i.e. the whole page. NFR-011: every Mat is deleted in `finally`.
 */
export function extractComponentsWith(cv: CvLike, imageData: ImageData): Rect[] {
  const mats: CvDeletable[] = [];
  const own = <T extends CvDeletable>(mat: T): T => {
    mats.push(mat);
    return mat;
  };
  try {
    const src = own(cv.matFromImageData(imageData));
    const gray = own(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const bin = own(new cv.Mat());
    cv.threshold(gray, bin, TUNABLES.detection.binaryThreshold, TUNABLES.detection.binaryMaxValue, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);
    const labels = own(new cv.Mat());
    const stats = own(new cv.Mat());
    const centroids = own(new cv.Mat());
    const count = cv.connectedComponentsWithStats(bin, labels, stats, centroids, TUNABLES.detection.connectivity);
    const col = TUNABLES.detection.ccStat;
    const rects: Rect[] = [];
    for (let i = 0; i < count; i++) {
      rects.push({ x: stats.intAt(i, col.left), y: stats.intAt(i, col.top), width: stats.intAt(i, col.width), height: stats.intAt(i, col.height) });
    }
    return rects;
  } finally {
    for (const mat of mats) mat.delete();
  }
}
