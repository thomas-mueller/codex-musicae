import type { MusicSystem } from './pdf/music-system.model';

export interface PageSize { width: number; height: number; }
export interface SlideRect {
  pageIndex: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}
export interface SlideCrop { xMin: number; yMin: number; xMax: number; yMax: number; }
export interface SlideGroup extends Array<SlideRect> { crop?: SlideCrop; }

function overlaps(a: SlideRect, b: SlideRect): boolean {
  return a.xMin < b.xMax && a.xMax > b.xMin && a.yMin < b.yMax && a.yMax > b.yMin;
}

function gap(a: SlideRect, b: SlideRect): number {
  const dx = Math.max(a.xMin - b.xMax, b.xMin - a.xMax, 0);
  const dy = Math.max(a.yMin - b.yMax, b.yMin - a.yMax, 0);
  return Math.hypot(dx, dy);
}

function merge(a: SlideRect, b: SlideRect): void {
  a.xMin = Math.min(a.xMin, b.xMin);
  a.yMin = Math.min(a.yMin, b.yMin);
  a.xMax = Math.max(a.xMax, b.xMax);
  a.yMax = Math.max(a.yMax, b.yMax);
}

function expandAroundCenter(xMin: number, xMax: number, width: number, page: PageSize): { xMin: number; xMax: number } {
  const center = (xMin + xMax) / 2;
  xMin = center - width / 2;
  xMax = center + width / 2;
  if (xMin < 0) { xMax -= xMin; xMin = 0; }
  if (xMax > page.width) { xMin -= xMax - page.width; xMax = page.width; }
  return { xMin: Math.max(0, xMin), xMax: Math.min(page.width, xMax) };
}

export function expandSlideGroup(group: SlideGroup, pageSizes: readonly PageSize[], aspectRatio: number): SlideGroup {
  if (!group.length || aspectRatio <= 0) return group;

  const height = group.reduce((sum, rect) => sum + rect.yMax - rect.yMin, 0);
  const cropXMin = Math.min(...group.map((rect) => rect.xMin));
  const cropXMax = Math.max(...group.map((rect) => rect.xMax));
  const width = cropXMax - cropXMin;
  const expandedWidth = Math.max(width, height * aspectRatio);
  const horizontal = group.map((rect) => {
    const page = pageSizes[rect.pageIndex];
    if (!page) return { ...rect };
    const expanded = expandAroundCenter(cropXMin, cropXMax, expandedWidth, page);
    return { ...rect, xMin: expanded.xMin, xMax: expanded.xMax };
  });
  const actualWidth = Math.max(...horizontal.map((rect) => rect.xMax - rect.xMin));
  const targetHeight = Math.max(height, actualWidth / aspectRatio);
  const expanded: SlideGroup = horizontal.map((rect) => ({ ...rect }));
  let remaining = targetHeight - height;

  // Split the extra height evenly between the outer edges first. Only use a
  // one-sided fallback when one page edge has insufficient whitespace.
  if (remaining > 0) {
    const first = expanded[0];
    const last = expanded[expanded.length - 1];
    const firstPage = pageSizes[first.pageIndex];
    const lastPage = pageSizes[last.pageIndex];
    const topRoom = firstPage ? first.yMin : 0;
    const bottomRoom = lastPage ? lastPage.height - last.yMax : 0;
    const requestedEach = remaining / 2;
    const topAmount = Math.min(topRoom, requestedEach);
    const bottomAmount = Math.min(bottomRoom, requestedEach);
    first.yMin -= topAmount;
    last.yMax += bottomAmount;
    remaining -= topAmount + bottomAmount;

    if (remaining > 0) {
      const extraTop = Math.min(topRoom - topAmount, remaining);
      first.yMin -= extraTop;
      remaining -= extraTop;
    }
    if (remaining > 0) {
      const extraBottom = Math.min(bottomRoom - bottomAmount, remaining);
      last.yMax += extraBottom;
    }
  }
  expanded.crop = {
    xMin: Math.min(...expanded.map((rect) => rect.xMin)),
    yMin: Math.min(...expanded.map((rect) => rect.yMin)),
    xMax: Math.max(...expanded.map((rect) => rect.xMax)),
    yMax: Math.max(...expanded.map((rect) => rect.yMax)),
  };
  return expanded;
}

export function buildSlideGroups(
  musicSystems: readonly MusicSystem[],
  pageSizes: readonly PageSize[],
  padding: number,
  aspectRatio: number,
): SlideGroup[] {
  const groups: SlideGroup[] = [];
  let current: SlideGroup = [];
  let currentWidth = 0;
  let currentHeight = 0;

  for (const musicSystem of musicSystems) {
    const pageIndex = musicSystem.page - 1;
    const page = pageSizes[pageIndex];
    if (!page) continue;
    const pad = padding * page.width;
    const rect: SlideRect = {
      pageIndex,
      xMin: Math.max(0, musicSystem.xMin * page.width - pad),
      yMin: Math.max(0, musicSystem.yMin * page.height - pad),
      xMax: Math.min(page.width, musicSystem.xMax * page.width + pad),
      yMax: Math.min(page.height, musicSystem.yMax * page.height + pad),
    };
    const newWidth = Math.max(currentWidth, rect.xMax - rect.xMin);
    const newHeight = currentHeight + rect.yMax - rect.yMin;
    if (current.length && newWidth / newHeight < aspectRatio) {
      groups.push(current);
      current = [];
      currentWidth = 0;
      currentHeight = 0;
    }
    current.push(rect);
    currentWidth = Math.max(currentWidth, rect.xMax - rect.xMin);
    currentHeight += rect.yMax - rect.yMin;
  }
  if (current.length) groups.push(current);

  return groups.map((group) => {
    const merged: SlideGroup = [];
    for (const rect of group) {
      const existing = merged.find((item) => item.pageIndex === rect.pageIndex && gap(item, rect) <= 0.1);
      if (existing) merge(existing, rect);
      else merged.push({ ...rect });
    }
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < merged.length; i++) {
        for (let j = i + 1; j < merged.length; j++) {
          if (merged[i].pageIndex === merged[j].pageIndex && overlaps(merged[i], merged[j])) {
            merge(merged[i], merged[j]);
            merged.splice(j, 1);
            changed = true;
            break outer;
          }
        }
      }
    }
    return expandSlideGroup(merged, pageSizes, aspectRatio);
  });
}
