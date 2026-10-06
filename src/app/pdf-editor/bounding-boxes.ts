import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { CV } from '@techstark/opencv-js';

export interface BoundingBox {
  page: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

const DETECTION_SCALE = 300 / 72;
let openCvPromise: Promise<CV> | undefined;

function getOpenCv(): Promise<CV> {
  if (!openCvPromise) {
    const root = globalThis as typeof globalThis & { cv?: unknown };
    const loadScript = root.cv
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/assets/opencv/opencv.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Unable to load OpenCV.'));
          document.head.appendChild(script);
        });

    openCvPromise = loadScript.then(async () => {
      let module = root.cv as (CV & { onRuntimeInitialized?: () => void }) | Promise<CV>;
      if (module instanceof Promise) {
        module = await module;
      }

      const cv = module as CV & { onRuntimeInitialized?: () => void };
      if (cv.Mat) {
        return cv;
      }

      return new Promise<CV>((resolve) => {
        cv.onRuntimeInitialized = () => resolve(cv);
      });
    });
  }

  return openCvPromise;
}

/** Detects normalized content bounds for a single PDF page. */
export async function detectBoundingBoxesOnPage(
  page: PDFPageProxy,
  pageNumber: number,
): Promise<BoundingBox[]> {
  const cv = await getOpenCv();
  const viewport = page.getViewport({ scale: DETECTION_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas rendering is unavailable for bounding-box detection.');
  }

  await page.render({ canvas, canvasContext: context, viewport }).promise;

  let source: InstanceType<CV['Mat']> | undefined;
  let gray: InstanceType<CV['Mat']> | undefined;
  let binary: InstanceType<CV['Mat']> | undefined;
  let labels: InstanceType<CV['Mat']> | undefined;
  let stats: InstanceType<CV['Mat']> | undefined;
  let centroids: InstanceType<CV['Mat']> | undefined;

  try {
    source = cv.imread(canvas);
    gray = new cv.Mat();
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);

    binary = new cv.Mat();
    cv.adaptiveThreshold(
      gray,
      binary,
      255,
      cv.ADAPTIVE_THRESH_MEAN_C,
      cv.THRESH_BINARY_INV,
      31,
      15,
    );

    labels = new cv.Mat();
    stats = new cv.Mat();
    centroids = new cv.Mat();
    cv.connectedComponentsWithStats(binary, labels, stats, centroids, 4, cv.CV_32S);

    const areas: number[] = [];
    for (let i = 1; i < stats.rows; i += 1) {
      areas.push(stats.intAt(i, cv.CC_STAT_AREA));
    }
    areas.sort((a, b) => b - a);

    if (areas.length === 0) {
      return [];
    }

    let largestGapIndex = 0;
    let largestGap = -1;
    for (let i = 0; i < areas.length - 1; i += 1) {
      const gap = areas[i] - areas[i + 1];
      if (gap > largestGap) {
        largestGap = gap;
        largestGapIndex = i + 1;
      }
    }
    // A single component has no gap to split, so retain it instead of cutting it off.
    const selectionThreshold = areas.length === 1 ? 0 : areas[largestGapIndex];
    const boxes: BoundingBox[] = [];

    for (let i = 1; i < stats.rows; i += 1) {
      if (stats.intAt(i, cv.CC_STAT_AREA) <= selectionThreshold) {
        continue;
      }

      const x = stats.intAt(i, cv.CC_STAT_LEFT);
      const y = stats.intAt(i, cv.CC_STAT_TOP);
      const width = stats.intAt(i, cv.CC_STAT_WIDTH);
      const height = stats.intAt(i, cv.CC_STAT_HEIGHT);
      boxes.push({
        page: pageNumber,
        xMin: x / canvas.width,
        yMin: y / canvas.height,
        xMax: (x + width) / canvas.width,
        yMax: (y + height) / canvas.height,
      });
    }

    return boxes;
  } finally {
    source?.delete();
    gray?.delete();
    binary?.delete();
    labels?.delete();
    stats?.delete();
    centroids?.delete();
  }
}

/** Detects boxes on every page, one at a time to limit temporary memory use. */
export async function detectBoundingBoxesInDocument(
  documentProxy: PDFDocumentProxy,
): Promise<BoundingBox[]> {
  const boxes: BoundingBox[] = [];
  for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
    const page = await documentProxy.getPage(pageNumber);
    boxes.push(...(await detectBoundingBoxesOnPage(page, pageNumber)));
  }
  return boxes;
}

/** Draws the normalized boxes for one page into a rendered page canvas. */
export function drawBoundingBoxes(
  context: CanvasRenderingContext2D,
  pageNumber: number,
  boxes: readonly BoundingBox[],
  canvasWidth: number,
  canvasHeight: number,
  padding = 0,
): void {
  context.save();
  const originalLineWidth = Math.max(1, Math.min(canvasWidth, canvasHeight) * 0.0025);
  const yPadding = padding * (canvasWidth / canvasHeight);

  for (const box of boxes) {
    if (box.page !== pageNumber) {
      continue;
    }

    const x = box.xMin * canvasWidth;
    const y = box.yMin * canvasHeight;
    const width = (box.xMax - box.xMin) * canvasWidth;
    const height = (box.yMax - box.yMin) * canvasHeight;

    if (padding > 0) {
      const paddedX = Math.max(0, x - padding * canvasWidth);
      const paddedY = Math.max(0, y - yPadding * canvasHeight);
      const paddedRight = Math.min(canvasWidth, x + width + padding * canvasWidth);
      const paddedBottom = Math.min(canvasHeight, y + height + yPadding * canvasHeight);
      context.fillStyle = 'rgb(229 57 53 / 25%)';
      // Paint only the padding ring so the original box interior stays transparent.
      context.fillRect(paddedX, paddedY, paddedRight - paddedX, y - paddedY);
      context.fillRect(paddedX, y + height, paddedRight - paddedX, paddedBottom - (y + height));
      context.fillRect(paddedX, y, x - paddedX, height);
      context.fillRect(x + width, y, paddedRight - (x + width), height);
    }

    context.strokeStyle = '#e53935';
    context.lineWidth = originalLineWidth;
    context.strokeRect(x, y, width, height);
  }

  context.restore();
}

export function expandBoundingBox(box: BoundingBox, padding: number): BoundingBox {
  return {
    ...box,
    xMin: Math.max(0, box.xMin - padding),
    yMin: Math.max(0, box.yMin - padding),
    xMax: Math.min(1, box.xMax + padding),
    yMax: Math.min(1, box.yMax + padding),
  };
}
