import { describe, expect, it } from 'vitest';

import { extractComponentsWith } from './extract-components';
import type { CvLike, CvMat } from './extract-components';

interface FakeMat extends CvMat {
  deleted: number;
}

const STATS = [
  [0, 0, 100, 200], // label 0: the page
  [10, 20, 80, 30],
  [10, 120, 80, 40],
];

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
  const cv: CvLike = {
    COLOR_RGBA2GRAY: 11,
    THRESH_BINARY_INV: 1,
    THRESH_OTSU: 8,
    Mat,
    matFromImageData: () => new Mat(),
    cvtColor: () => undefined,
    threshold: () => 0,
    connectedComponentsWithStats: () => {
      if (failAt === 'components') throw new RangeError('boom');
      return STATS.length;
    },
  };
  return { cv, mats };
}

const imageData = {} as ImageData;

describe('extractComponentsWith', () => {
  it('DET-004 returns the rectangle of every component including the page', () => {
    const { cv } = fakeCv();
    expect(extractComponentsWith(cv, imageData)).toEqual([
      { x: 0, y: 0, width: 100, height: 200 },
      { x: 10, y: 20, width: 80, height: 30 },
      { x: 10, y: 120, width: 80, height: 40 },
    ]);
  });

  it('NFR-011 deletes every Mat exactly once after a normal run', () => {
    const { cv, mats } = fakeCv();
    extractComponentsWith(cv, imageData);
    expect(mats.length).toBe(6);
    expect(mats.map((m) => m.deleted)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('NFR-011 deletes every Mat exactly once when connectedComponentsWithStats throws', () => {
    const { cv, mats } = fakeCv('components');
    expect(() => extractComponentsWith(cv, imageData)).toThrow(RangeError);
    expect(mats.length).toBe(6);
    expect(mats.map((m) => m.deleted)).toEqual([1, 1, 1, 1, 1, 1]);
  });
});
