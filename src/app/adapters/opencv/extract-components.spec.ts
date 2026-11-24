import { describe, expect, it } from 'vitest';

import { extractComponentsWith } from './extract-components';
import type { CvLike, CvMat } from './extract-components';

interface FakeMat extends CvMat {
  deleted: number;
}

// columns: left, top, width, height, area (cv.CC_STAT_*)
const STATS = [
  [0, 0, 100, 200, 19000], // label 0: the background
  [10, 20, 80, 30, 900],
  [10, 120, 80, 40, 1100],
];
const PARAMS = { blockSize: 31, c: 15 };

function fakeCv(failAt?: 'components') {
  const mats: FakeMat[] = [];
  class Mat implements FakeMat {
    deleted = 0;
    constructor() {
      mats.push(this);
    }
    intAt(row: number, col: number): number {
      return STATS[row]?.[col] ?? -1;
    }
    delete(): void {
      this.deleted++;
    }
  }
  const calls: { adaptive?: unknown[]; components?: unknown[]; resize?: unknown[] } = {};
  const cv: CvLike = {
    COLOR_RGBA2GRAY: 11,
    INTER_AREA: 3,
    ADAPTIVE_THRESH_MEAN_C: 1,
    THRESH_BINARY_INV: 1,
    CV_32S: 4,
    Mat,
    Size: class {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}
    },
    matFromImageData: () => new Mat(),
    cvtColor: () => undefined,
    resize: (...args: unknown[]) => {
      calls.resize = args.slice(2);
    },
    adaptiveThreshold: (...args: unknown[]) => {
      calls.adaptive = args.slice(2);
    },
    connectedComponentsWithStats: (...args: unknown[]) => {
      calls.components = args.slice(4);
      if (failAt === 'components') throw new RangeError('boom');
      return STATS.length;
    },
  };
  return { cv, mats, calls };
}

const imageData = { width: 100, height: 200 } as ImageData;

describe('extractComponentsWith', () => {
  it('DET-004 returns rectangle and pixel area of every component except the background, and the bitmap size', () => {
    const { cv } = fakeCv();
    expect(extractComponentsWith(cv, imageData, PARAMS)).toEqual({
      width: 100,
      height: 200,
      components: [
        { rect: { x: 10, y: 20, width: 80, height: 30 }, area: 900 },
        { rect: { x: 10, y: 120, width: 80, height: 40 }, area: 1100 },
      ],
    });
  });

  it('DET-004 binarizes with the level\'s adaptive mean threshold (block size, C) and 4-connected components', () => {
    const { cv, calls } = fakeCv();
    extractComponentsWith(cv, imageData, PARAMS);
    expect(calls.adaptive).toEqual([255, 1, 1, 31, 15]); // maxValue, ADAPTIVE_THRESH_MEAN_C, THRESH_BINARY_INV, blockSize, C
    expect(calls.components).toEqual([4, 4]); // connectivity 4, CV_32S
  });

  it('NFR-011 deletes every Mat exactly once after a normal run', () => {
    const { cv, mats } = fakeCv();
    extractComponentsWith(cv, imageData, PARAMS);
    expect(mats.length).toBe(6);
    expect(mats.map((m) => m.deleted)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('NFR-011 deletes every Mat exactly once when connectedComponentsWithStats throws', () => {
    const { cv, mats } = fakeCv('components');
    expect(() => extractComponentsWith(cv, imageData, PARAMS)).toThrow(RangeError);
    expect(mats.length).toBe(6);
    expect(mats.map((m) => m.deleted)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('NFR-025 DET-035 with a target size the gray image is reduced by area averaging before the threshold and the target size is returned', () => {
    const { cv, calls, mats } = fakeCv();
    const set = extractComponentsWith(cv, imageData, { ...PARAMS, target: { width: 50, height: 100 } });
    expect(calls.resize).toEqual([{ width: 50, height: 100 }, 0, 0, 3]); // size, fx, fy, INTER_AREA
    expect([set.width, set.height]).toEqual([50, 100]);
    expect(mats).toHaveLength(7);
    expect(mats.map((m) => m.deleted)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it('NFR-025 DET-035 a target equal to the bitmap size is not resized', () => {
    const { cv, calls } = fakeCv();
    const set = extractComponentsWith(cv, imageData, { ...PARAMS, target: { width: 100, height: 200 } });
    expect(calls.resize).toBeUndefined();
    expect([set.width, set.height]).toEqual([100, 200]);
  });
});
