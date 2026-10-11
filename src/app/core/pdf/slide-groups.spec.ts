import { describe, expect, it } from 'vitest';
import { buildSlideGroups, expandSlideGroup, fitCanvasToViewport } from './slide-groups';
import { compareMusicSystemsInPdfOrder } from './music-system.model';

const page = [{ width: 100, height: 100 }];

function musicSystems(...rects: Array<[number, number, number, number]>) {
  return rects.map(([xMin, yMin, xMax, yMax]) => ({ page: 1, xMin, yMin, xMax, yMax }));
}

describe('slide crop expansion', () => {
  it('preserves PDF page indices and source order across empty pages', () => {
    const groups = buildSlideGroups([
      { page: 3, xMin: 0.1, yMin: 0.4, xMax: 0.9, yMax: 0.5 },
      { page: 1, xMin: 0.1, yMin: 0.1, xMax: 0.9, yMax: 0.2 },
    ], [
      { width: 100, height: 100 },
      { width: 100, height: 100 },
      { width: 100, height: 100 },
    ], 0, 10);
    expect(groups.flat().map((rect) => [rect.pageIndex, rect.selectedPosition])).toEqual([[0, 1], [2, 2]]);
  });

  it('orders systems in PDF reading order before grouping', () => {
    const systems = [
      { page: 2, xMin: 0.1, yMin: 0.1, xMax: 0.9, yMax: 0.2 },
      { page: 1, xMin: 0.8, yMin: 0.1, xMax: 0.9, yMax: 0.2 },
      { page: 1, xMin: 0.1, yMin: 0.1, xMax: 0.2, yMax: 0.2 },
      { page: 1, xMin: 0.1, yMin: 0.4, xMax: 0.2, yMax: 0.5 },
    ];
    expect([...systems].sort(compareMusicSystemsInPdfOrder)).toEqual([systems[2], systems[1], systems[3], systems[0]]);
  });

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

  it('records one final render geometry for the complete slide', () => {
    const group = expandSlideGroup([
      { pageIndex: 0, xMin: 40, yMin: 10, xMax: 60, yMax: 20 },
      { pageIndex: 0, xMin: 40, yMin: 40, xMax: 60, yMax: 70 },
    ], page, 0.5);
    expect(group.renderWidth).toBe(20);
    expect(group.renderHeight).toBe(40);
    expect(group.renderWidth! / group.renderHeight!).toBe(0.5);
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
    expect(group.topExpansion).toBe(10);
    expect(group.bottomExpansion).toBe(10);
  });

  it('records top-only vertical expansion', () => {
    const group = expandSlideGroup([
      { pageIndex: 0, xMin: 40, yMin: 80, xMax: 60, yMax: 100 },
    ], page, 0.5);
    expect(group.topExpansion).toBe(20);
    expect(group.bottomExpansion).toBe(0);
  });

  it('records bottom-only vertical expansion', () => {
    const group = expandSlideGroup([
      { pageIndex: 0, xMin: 40, yMin: 0, xMax: 60, yMax: 20 },
    ], page, 0.5);
    expect(group.topExpansion).toBe(0);
    expect(group.bottomExpansion).toBe(20);
  });

  it('records only the available expansion when page edges clamp it', () => {
    const group = expandSlideGroup([
      { pageIndex: 0, xMin: 40, yMin: 0, xMax: 60, yMax: 20 },
    ], page, 0.5);
    expect(group.topExpansion).toBe(0);
    expect(group.bottomExpansion).toBe(20);
  });

  it('records no vertical expansion when the crop already matches', () => {
    const group = expandSlideGroup([
      { pageIndex: 0, xMin: 25, yMin: 40, xMax: 75, yMax: 60 },
    ], page, 2.5);
    expect(group.topExpansion).toBe(0);
    expect(group.bottomExpansion).toBe(0);
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

  it.each([
    { viewport: [1200, 600], ratio: 2, expected: [1200, 600] },
    { viewport: [600, 1200], ratio: 0.5, expected: [600, 1200] },
    { viewport: [1200, 600], ratio: 1, expected: [600, 600] },
    { viewport: [600, 1200], ratio: 1, expected: [600, 600] },
  ])('fits ratio $ratio inside viewport $viewport', ({ viewport, ratio, expected }) => {
    const size = fitCanvasToViewport(viewport[0], viewport[1], ratio);
    expect(size.width).toBe(expected[0]);
    expect(size.height).toBe(expected[1]);
    expect(size.width / size.height).toBeCloseTo(ratio);
    expect(size.width).toBeLessThanOrEqual(viewport[0]);
    expect(size.height).toBeLessThanOrEqual(viewport[1]);
  });
});
