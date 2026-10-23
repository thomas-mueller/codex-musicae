// REFERENCE IMPLEMENTATION (plain JavaScript) of the pure core functions of CodexMusicae.
//
// Purpose: it produced and cross-checked every expected value in docs/contracts/core/fixtures.
// Status:  informational. The contracts (docs/contracts/core/*.ts) and the fixtures are the authority.
//          You may read this file for clarification and port it to TypeScript, but do not paste it blindly:
//          the implementation must satisfy the contracts' types and the lint rules, and the tests decide.
// Notes:   - the contract of `generatePlayingOrder` also documents `maxLength`; this file passes it through as given.
//          - `computeBars`, `flattenSystems`, `packSlides` use plain objects exactly as typed in the contracts.
// Reference implementation (JS) used ONLY to compute and verify expected values for the spec tables.
const area = (r) => r.width * r.height;
const R = (x, y, width, height) => ({ x, y, width, height });
const union = (a, b) => {
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.width, b.x + b.width), y1 = Math.max(a.y + a.height, b.y + b.height);
  return R(x0, y0, x1 - x0, y1 - y0);
};

// ---- detection filter
export function selectSystemRects(rects, pageWidth, p) {
  const valid = rects.filter((r) => r.width > 0 && r.height > 0);
  if (valid.length === 0) return [];
  let maxI = 0;
  valid.forEach((r, i) => { if (area(r) > area(valid[maxI])) maxI = i; });
  const rest = valid.filter((_, i) => i !== maxI);
  if (rest.length === 0) return [];
  let threshold = 0;
  if (rest.length >= 2) {
    const a = rest.map(area).sort((x, y) => x - y);
    let bestGap = -1, bestI = -1;
    for (let i = 0; i < a.length - 1; i++) {
      const g = a[i + 1] - a[i];
      if (g >= bestGap) { bestGap = g; bestI = i; }
    }
    if (bestGap > 0) threshold = (a[bestI] + a[bestI + 1]) / 2;
  }
  const keep = new Set();
  rest.forEach((r, i) => {
    if (area(r) > threshold && r.width >= p.minSystemWidthRatio * pageWidth) keep.add(i);
    if (r.width >= p.fullWidthSystemRatio * pageWidth) keep.add(i);
  });
  return rest.filter((_, i) => keep.has(i)).sort((a, b) => a.y - b.y || a.x - b.x);
}

// ---- padding
const median = (v) => {
  if (v.length === 0) return null;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const gapsOnPage = (systems) => {
  const s = [...systems].sort((a, b) => a.y - b.y);
  const g = [];
  for (let i = 0; i < s.length - 1; i++) g.push(Math.max(0, s[i + 1].y - (s[i].y + s[i].height)));
  return g;
};
export function computePaddings(pages, fallbackRatio) {
  const pooled = pages.flatMap((p) => gapsOnPage(p.systems));
  const docMedian = median(pooled);
  return pages.map((p) => {
    const g = gapsOnPage(p.systems);
    if (g.length >= 1) return median(g);
    if (docMedian !== null) return docMedian;
    return fallbackRatio * p.height;
  });
}
export function paddedArea(box, padding, page) {
  const x0 = Math.max(0, box.x - padding), y0 = Math.max(0, box.y - padding);
  const x1 = Math.min(page.width, box.x + box.width + padding), y1 = Math.min(page.height, box.y + box.height + padding);
  return R(x0, y0, x1 - x0, y1 - y0);
}

// ---- junctions / bars
export function flattenSystems(pages) {
  const out = [];
  [...pages].sort((a, b) => a.pageIndex - b.pageIndex).forEach((p) => {
    [...p.systems].sort((a, b) => a.y - b.y || a.x - b.x).forEach((box) => out.push({ index: out.length + 1, pageIndex: p.pageIndex, box }));
  });
  return out;
}
export function computeBars(pages) {
  const bars = [];
  let n = 0;
  [...pages].sort((a, b) => a.pageIndex - b.pageIndex).forEach((p) => {
    if (p.systems.length === 0) return;
    const s = [...p.systems].sort((a, b) => a.y - b.y || a.x - b.x);
    const first = n + 1;
    bars.push({ junction: first - 1, pageIndex: p.pageIndex, y: 0, height: Math.max(0, s[0].y) });
    for (let i = 0; i < s.length - 1; i++) {
      const bottom = s[i].y + s[i].height;
      bars.push({ junction: first + i, pageIndex: p.pageIndex, y: bottom, height: Math.max(0, s[i + 1].y - bottom) });
    }
    const last = s[s.length - 1];
    const lb = last.y + last.height;
    n += s.length;
    bars.push({ junction: n, pageIndex: p.pageIndex, y: lb, height: Math.max(0, p.height - lb) });
  });
  return bars;
}

// ---- aspect ratio
const EPS = 1e-9;
const r10 = (x) => Math.round(x * 1e10) / 1e10;
export function stepAspectRatio(cur, dir, { min, max, step }) {
  const q = cur / step;
  const idx = dir === 'more' ? Math.ceil(q - EPS) - 1 : Math.floor(q + EPS) + 1;
  return Math.min(max, Math.max(min, r10(idx * step)));
}
export function initialAspectRatio(w, h, { min, max, roundDecimals }) {
  const f = 10 ** roundDecimals;
  return Math.min(max, Math.max(min, Math.round((w / h) * f) / f));
}
export const fitScaleToPixelCap = (wPt, hPt, scale, maxPixels) => Math.min(scale, Math.sqrt(maxPixels / (wPt * hPt)));

// ---- page transforms
export function pageDisplaySize({ view: [x0, y0, x1, y1], rotate }) {
  const W = x1 - x0, H = y1 - y0;
  return rotate === 90 || rotate === 270 ? { width: H, height: W } : { width: W, height: H };
}
export function userToDisplay(p, { view: [x0, y0, x1, y1], rotate }) {
  switch (rotate) {
    case 0: return { x: p.x - x0, y: y1 - p.y };
    case 90: return { x: p.y - y0, y: p.x - x0 };
    case 180: return { x: x1 - p.x, y: p.y - y0 };
    default: return { x: y1 - p.y, y: x1 - p.x };
  }
}
export function displayToUser(p, { view: [x0, y0, x1, y1], rotate }) {
  switch (rotate) {
    case 0: return { x: x0 + p.x, y: y1 - p.y };
    case 90: return { x: x0 + p.y, y: y0 + p.x };
    case 180: return { x: x1 - p.x, y: y0 + p.y };
    default: return { x: x1 - p.y, y: y1 - p.x };
  }
}

// ---- playing order
export function generatePlayingOrder({ systemCount: N, jumps, stops, maxLength }) {
  const arrivals = new Array(N + 1).fill(0);
  const entries = [];
  const events = []; // {junction, len}
  let pos = 0, truncated = false;
  for (;;) {
    arrivals[pos]++;
    events.push({ junction: pos, len: entries.length });
    const j = jumps.find((x) => x.origin === pos && x.pass === arrivals[pos]);
    if (j) { pos = j.target; continue; }
    if (pos === N) break;
    if (entries.length >= maxLength) { truncated = true; break; }
    entries.push(pos + 1);
    pos = pos + 1;
  }
  // arrivals after entry k (0-based) are the events with len === k + 1
  const betw = [];
  for (let k = 0; k < entries.length - 1; k++) betw.push(events.filter((e) => e.len === k + 1).map((e) => e.junction));
  let cut = entries.length;
  const cuts = [];
  for (const s of stops) {
    const lens = events.filter((e) => e.junction === s).map((e) => e.len);
    if (lens.length) cuts.push(Math.max(...lens));
  }
  if (cuts.length) cut = Math.min(...cuts);
  return { entries: entries.slice(0, cut), between: betw.slice(0, Math.max(0, cut - 1)), truncatedByCap: truncated };
}
export function systemNumbers(order, N) {
  const out = Array.from({ length: N }, () => []);
  order.entries.forEach((s, i) => out[s - 1].push(i + 1));
  return out;
}
export const forcedBreaks = (order, breaks) => order.between.map((b) => b.some((j) => breaks.has(j)));

// ---- slides
export const referenceWidth = (systems) => Math.max(...systems.map((s) => s.padded.width));
export function packSlides({ entries, forcedBreakAfter, systems, slideWidth, aspectRatio }) {
  const H = slideWidth / aspectRatio;
  const slides = [];
  let cur = null;
  const fin = (c, end) => {
    const stack = c.regions.reduce((a, r) => a + r.area.height, 0);
    const enlarged = stack > H + EPS;
    const height = enlarged ? stack : H;
    return { entryStart: c.entryStart, entryEnd: end, regions: c.regions, width: enlarged ? height * aspectRatio : slideWidth, height, stackHeight: stack, enlarged };
  };
  const newRegion = (i) => {
    const s = systems[entries[i] - 1];
    return { pageIndex: s.pageIndex, firstSystem: s.index, lastSystem: s.index, area: { ...s.padded }, entryStart: i, entryEnd: i };
  };
  for (let i = 0; i < entries.length; i++) {
    if (cur && !forcedBreakAfter[i - 1]) {
      const s = systems[entries[i] - 1];
      const prev = systems[entries[i - 1] - 1];
      const adjacent = entries[i] === entries[i - 1] + 1 && s.pageIndex === prev.pageIndex;
      const regions = cur.regions.map((r) => ({ ...r }));
      if (adjacent) {
        const last = regions[regions.length - 1];
        last.area = union(last.area, s.padded);
        last.lastSystem = s.index;
        last.entryEnd = i;
      } else regions.push(newRegion(i));
      const stack = regions.reduce((a, r) => a + r.area.height, 0);
      if (stack <= H + EPS) { cur.regions = regions; continue; }
    }
    if (cur) slides.push(fin(cur, i - 1));
    cur = { entryStart: i, regions: [newRegion(i)] };
  }
  if (cur) slides.push(fin(cur, entries.length - 1));
  return slides;
}
export const slideIndexOfEntry = (slides, entryIndex) => slides.findIndex((s) => s.entryStart <= entryIndex && entryIndex <= s.entryEnd);
export { R, area, union };
