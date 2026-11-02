import type { Locator, Page } from '@playwright/test';

export interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** RGBA pixels of a screenshot of `clip`, one pixel per CSS pixel whatever the device pixel ratio, decoded in the page. */
export async function readPixels(page: Page, clip: Clip): Promise<{ width: number; height: number; data: number[] }> {
  const png = await page.screenshot({ clip, scale: 'css' });
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, data: Array.from(context.getImageData(0, 0, bitmap.width, bitmap.height).data) };
  }, png.toString('base64'));
}

export async function pixelAt(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const { data } = await readPixels(page, { x: Math.floor(x), y: Math.floor(y), width: 1, height: 1 });
  return [data[0]!, data[1]!, data[2]!];
}

const WHITE = 255;
const RGBA = 4;
const GREEN = 1;
const BLUE = 2;

/** The first column inside `clip` that has `run` pure-white pixels in a row (and `margin` white columns on both sides): page coordinates of its top. */
export async function findWhiteRun(page: Page, clip: Clip, run: number, margin: number): Promise<{ x: number; y: number } | null> {
  const { width, height, data } = await readPixels(page, clip);
  const white = (x: number, y: number): boolean => {
    const i = (y * width + x) * RGBA;
    return data[i] === WHITE && data[i + GREEN] === WHITE && data[i + BLUE] === WHITE;
  };
  for (let x = margin; x < width - margin; x++) {
    let streak = 0;
    for (let y = 0; y < height; y++) {
      let clear = true;
      for (let dx = -margin; dx <= margin && clear; dx++) {
        clear = white(x + dx, y);
      }
      streak = clear ? streak + 1 : 0;
      if (streak >= run) {
        return { x: clip.x + x, y: clip.y + y - run + 1 };
      }
    }
  }
  return null;
}

/** Number of canvas pixels (alpha > 0) near `rgb`. */
export function inkedPixelsNear(canvas: Locator, rgb: readonly number[], tolerance: number): Promise<number> {
  return canvas.evaluate(
    (element: HTMLCanvasElement, { color, delta, stride, alphaOffset }: { color: number[]; delta: number; stride: number; alphaOffset: number }) => {
      const context = element.getContext('2d');
      if (!context) {
        return 0;
      }
      const data = context.getImageData(0, 0, element.width, element.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += stride) {
        if (data[i + alphaOffset]! > 0 && color.every((v, k) => Math.abs(data[i + k]! - v) <= delta)) {
          count++;
        }
      }
      return count;
    },
    { color: [...rgb], delta: tolerance, stride: RGBA, alphaOffset: BLUE + 1 },
  );
}
