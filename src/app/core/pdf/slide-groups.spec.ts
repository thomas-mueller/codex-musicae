import { describe, expect, it } from 'vitest';
import { buildSlideGroups, expandSlideGroup } from './slide-groups';

const page = [{ width: 100, height: 100 }];

function musicSystems(...rects: Array<[number, number, number, number]>) {
  return rects.map(([xMin, yMin, xMax, yMax]) => ({ page: 1, xMin, yMin, xMax, yMax }));
}

describe('slide crop expansion', () => {
  it('expands a narrow crop horizontally to the requested aspect ratio', () => {
    const [group] = buildSlideGroups(musicSystems([0.4, 0.4, 0.6, 0.6]), page, 0, 2);
    expect(group[0]).toMatchObject({ xMin: 30, xMax: 70, yMin: 40, yMax: 60 });
  });

  it('expands vertically when the crop is too wide', () => {
    const [group] = buildSlideGroups(musicSystems([0.4, 0.4, 0.6, 0.6]), page, 0, 0.5);
    expect(group[0]).toMatchObject({ xMin: 40, xMax: 60, yMin: 30, yMax: 70 });
  });

  it('clamps expansion at the page edges', () => {
    const [group] = buildSlideGroups(musicSystems([0, 0, 0.2, 0.2]), page, 0, 2);
    expect(group[0]).toMatchObject({ xMin: 0, xMax: 40, yMin: 0, yMax: 20 });
  });

  it('expands a multi-box slide without changing internal vertical spacing', () => {
    const group = expandSlideGroup([
      { pageIndex: 0, xMin: 40, yMin: 10, xMax: 60, yMax: 20 },
      { pageIndex: 0, xMin: 40, yMin: 40, xMax: 60, yMax: 50 },
    ], page, 2);
    expect(group).toHaveLength(2);
    expect(group.map((rect) => [rect.xMin, rect.xMax])).toEqual([[30, 70], [30, 70]]);
    expect(group[1].yMin - group[0].yMax).toBe(20);
    expect(group.crop).toEqual({ xMin: 30, yMin: 10, xMax: 70, yMax: 50 });
  });

  it('uses one shared horizontal crop for music systems with different centers', () => {
    const group = expandSlideGroup([
      { pageIndex: 0, xMin: 10, yMin: 10, xMax: 30, yMax: 20 },
      { pageIndex: 0, xMin: 50, yMin: 40, xMax: 70, yMax: 50 },
    ], page, 4);
    expect(group.map((rect) => [rect.xMin, rect.xMax])).toEqual([[0, 80], [0, 80]]);
  });

  it('expands a multi-box composition vertically on both outer sides', () => {
    const group = expandSlideGroup([
      { pageIndex: 0, xMin: 40, yMin: 10, xMax: 60, yMax: 20 },
      { pageIndex: 0, xMin: 40, yMin: 40, xMax: 60, yMax: 50 },
    ], page, 0.5);
    expect(group.map((rect) => [rect.yMin, rect.yMax])).toEqual([[0, 20], [40, 60]]);
  });

  it('splits vertical expansion evenly before using an edge fallback', () => {
    const group = expandSlideGroup([
      { pageIndex: 0, xMin: 40, yMin: 30, xMax: 60, yMax: 40 },
      { pageIndex: 1, xMin: 40, yMin: 40, xMax: 60, yMax: 50 },
    ], [
      { width: 100, height: 100 },
      { width: 100, height: 100 },
    ], 0.5);
    expect(group.map((rect) => [rect.yMin, rect.yMax])).toEqual([[20, 40], [40, 60]]);
  });

  it('leaves an already matching crop unchanged', () => {
    const [group] = buildSlideGroups(musicSystems([0.3, 0.4, 0.7, 0.6]), page, 0, 2);
    expect(group[0]).toMatchObject({ xMin: 30, xMax: 70, yMin: 40, yMax: 60 });
  });
});
