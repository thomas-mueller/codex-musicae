// REFERENCE IMPLEMENTATION, part 2 (plain JavaScript): cache, scheduler, detection queue, edits, composition,
// gestures, view math, tiles, entry lookup, junction labels, size class.
// Same status as core-reference.mjs: informational; the contracts and fixtures are the authority.
// It imports `R` from ./core-reference.mjs.
// Reference implementation, part 2 (cache, scheduler, detection queue, edits, composition, gestures, view).
import { R } from './core-reference.mjs';
const EPS = 1e-9;

// ---------------------------------------------------------------- LRU byte cache
export class LruByteCache {
  constructor(budget, onRemove) { this.budget = budget; this.onRemove = onRemove ?? (() => {}); this.map = new Map(); this.total = 0; }
  get totalBytes() { return this.total; }
  get size() { return this.map.size; }
  get(k) { if (!this.map.has(k)) return undefined; const e = this.map.get(k); this.map.delete(k); this.map.set(k, e); return e.value; }
  peek(k) { return this.map.get(k)?.value; }
  _remove(k, reason) { const e = this.map.get(k); this.map.delete(k); this.total -= e.bytes; this.onRemove(k, e.value, reason); }
  set(k, v, bytes) {
    if (this.map.has(k)) this._remove(k, 'replaced');
    if (bytes > this.budget) { this.onRemove(k, v, 'rejected'); return; }
    this.map.set(k, { value: v, bytes }); this.total += bytes;
    this._evict();
  }
  _evict() { while (this.total > this.budget) { const first = this.map.keys().next().value; this._remove(first, 'evicted'); } }
  delete(k) { if (!this.map.has(k)) return false; this._remove(k, 'deleted'); return true; }
  clear() { for (const k of [...this.map.keys()]) this._remove(k, 'cleared'); }
  setBudget(b) { this.budget = b; this._evict(); }
  keys() { return [...this.map.keys()]; }
}

// ---------------------------------------------------------------- scheduler
export const TASK_PRIORITY = { input: 0, visible: 1, prefetch: 2, save: 3, detection: 4 };
export function pickNext(queue, ctx) {
  const ok = queue.filter((t) => {
    if (t.cls === 'detection') return !(ctx.userActive || ctx.hidden || ctx.batterySaver === true);
    if (t.cls === 'prefetch') return !ctx.hidden;
    if (t.cls === 'save') return !ctx.strokeInProgress;
    return true;
  });
  if (!ok.length) return null;
  return [...ok].sort((a, b) => TASK_PRIORITY[a.cls] - TASK_PRIORITY[b.cls] || a.seq - b.seq)[0];
}
export function tasksToCancel(running, incoming) {
  if (incoming.cls !== 'input' && incoming.cls !== 'visible') return [];
  return running.filter((t) => t.cls === 'prefetch' || t.cls === 'detection').map((t) => t.id);
}

// ---------------------------------------------------------------- detection queue
export function usablePrefix(states) { let i = 0; while (i < states.length && (states[i] === 'done' || states[i] === 'failed')) i++; return i; }
export const isComplete = (states) => states.every((s) => s === 'done' || s === 'failed');
export function nextPageToProcess(states, priority) {
  if (priority !== null && priority >= 0 && priority < states.length && states[priority] === 'pending') return priority;
  const i = states.indexOf('pending');
  return i < 0 ? null : i;
}
export const isProvisional = (page, states) => states[page] === 'done' && page >= usablePrefix(states);

// ---------------------------------------------------------------- edits
export const EMPTY_MARKS = { jumps: [], breaks: [], stops: [], nextJumpId: 1 };
const isInt = Number.isInteger;
export const isValidJump = (j, N) => isInt(j.origin) && isInt(j.target) && isInt(j.pass) && j.origin >= 0 && j.origin <= N && j.target >= 0 && j.target <= N && j.origin !== j.target && j.pass >= 1;
const validMark = (j, N) => isInt(j) && j >= 1 && j <= N - 1;
export function addJump(m, jump, N) {
  if (!isValidJump(jump, N)) return null;
  return { ...m, jumps: [...m.jumps, { origin: jump.origin, target: jump.target, pass: jump.pass, id: m.nextJumpId }], nextJumpId: m.nextJumpId + 1 };
}
export const removeJump = (m, id) => ({ ...m, jumps: m.jumps.filter((j) => j.id !== id) });
export function updateJump(m, id, patch, N) {
  const i = m.jumps.findIndex((j) => j.id === id);
  if (i < 0) return null;
  const nj = { ...m.jumps[i], ...patch, id };
  if (!isValidJump(nj, N)) return null;
  const jumps = [...m.jumps]; jumps[i] = { origin: nj.origin, target: nj.target, pass: nj.pass, id };
  return { ...m, jumps };
}
const toggle = (arr, j) => (arr.includes(j) ? arr.filter((x) => x !== j) : [...arr, j].sort((a, b) => a - b));
export const toggleBreak = (m, j, N) => (validMark(j, N) ? { ...m, breaks: toggle(m.breaks, j) } : m);
export const toggleStop = (m, j, N) => (validMark(j, N) ? { ...m, stops: toggle(m.stops, j) } : m);
export const jumpsAtJunction = (m, j) => ({ asOrigin: m.jumps.filter((x) => x.origin === j), asTarget: m.jumps.filter((x) => x.target === j) });
export const junctionHasItems = (m, j) => m.jumps.some((x) => x.origin === j || x.target === j) || m.breaks.includes(j) || m.stops.includes(j);
export const clearJunction = (m, j) => ({ ...m, jumps: m.jumps.filter((x) => x.origin !== j && x.target !== j), breaks: m.breaks.filter((x) => x !== j), stops: m.stops.filter((x) => x !== j) });
export const reconcileAfterRedetection = (m, a, b) => (a === b ? m : EMPTY_MARKS);
export const jumpColorIndex = (id, size) => (((id - 1) % size) + size) % size;

// ---------------------------------------------------------------- composition
const inter = (a, b) => {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.width, b.x + b.width), y1 = Math.min(a.y + a.height, b.y + b.height);
  return x1 - x0 > EPS && y1 - y0 > EPS ? R(x0, y0, x1 - x0, y1 - y0) : null;
};
export function composeSlide(plan, systems, pages) {
  const W = plan.width, H = plan.height;
  const stackTop = (H - plan.stackHeight) / 2;
  const onSlide = new Set();
  plan.regions.forEach((r) => { for (let s = r.firstSystem; s <= r.lastSystem; s++) onSlide.add(s); });
  const contents = [];
  let y = stackTop;
  plan.regions.forEach((r, k) => {
    const cx = r.area.x + r.area.width / 2;
    const desired = R(cx - W / 2, r.area.y, W, r.area.height);
    const pg = pages[r.pageIndex];
    const source = inter(desired, R(0, 0, pg.width, pg.height));
    if (source) contents.push({ kind: 'region', regionIndex: k, pageIndex: r.pageIndex, source, dest: R(source.x - desired.x, y + (source.y - desired.y), source.width, source.height) });
    y += r.area.height;
  });
  const overlays = [];
  const filler = (kind, regionIndex, desired, top) => {
    const r = plan.regions[regionIndex];
    const pg = pages[r.pageIndex];
    const source = inter(desired, R(0, 0, pg.width, pg.height));
    if (!source) return;
    const dest = R(source.x - desired.x, top + (source.y - desired.y), source.width, source.height);
    contents.push({ kind, regionIndex, pageIndex: r.pageIndex, source, dest });
    const ivs = [];
    systems.filter((s) => s.pageIndex === r.pageIndex && !onSlide.has(s.index)).forEach((s) => {
      const a = Math.max(s.padded.y, source.y), b = Math.min(s.padded.y + s.padded.height, source.y + source.height);
      if (b - a > EPS) ivs.push([a, b]);
    });
    ivs.sort((p, q) => p[0] - q[0]);
    const merged = [];
    for (const iv of ivs) { const l = merged[merged.length - 1]; if (l && iv[0] <= l[1] + EPS) l[1] = Math.max(l[1], iv[1]); else merged.push([...iv]); }
    merged.forEach(([a, b]) => overlays.push(R(0, dest.y + (a - source.y), W, b - a)));
  };
  if (stackTop > EPS) {
    const r0 = plan.regions[0]; const cx = r0.area.x + r0.area.width / 2;
    filler('filler-top', 0, R(cx - W / 2, r0.area.y - stackTop, W, stackTop), 0);
  }
  const bottomTop = stackTop + plan.stackHeight;
  if (H - bottomTop > EPS) {
    const li = plan.regions.length - 1, rl = plan.regions[li]; const cx = rl.area.x + rl.area.width / 2;
    filler('filler-bottom', li, R(cx - W / 2, rl.area.y + rl.area.height, W, H - bottomTop), bottomTop);
  }
  overlays.sort((a, b) => a.y - b.y);
  return { width: W, height: H, stackTop, contents, overlays };
}

// ---------------------------------------------------------------- gestures
export function classifyTrack(track, vw, lim) {
  if (!track.length) return 'none';
  const a = track[0], b = track[track.length - 1];
  const duration = b.t - a.t;
  const maxMove = Math.max(...track.map((p) => Math.hypot(p.x - a.x, p.y - a.y)));
  if (duration <= lim.tapMaxDurationMs && maxMove <= lim.tapMaxMovePx) return 'tap';
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) < lim.swipeMinDistanceFraction * vw) return 'none';
  if ((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI > lim.swipeMaxAngleDeg) return 'none';
  const v = duration > 0 ? Math.abs(dx) / duration : Infinity;
  if (v < lim.swipeMinVelocityPxPerMs) return 'none';
  return dx < 0 ? 'swipe-left' : 'swipe-right';
}
export const tapZoneOf = (x, w, z) => (x / w < z.left ? 'left' : x / w >= z.left + z.center ? 'right' : 'center');
export const isDoubleTap = (a, b, l) => b.t - a.t >= 0 && b.t - a.t <= l.intervalMs && Math.hypot(b.x - a.x, b.y - a.y) <= l.distancePx;
export const WHEEL_INITIAL = { accum: 0, lastT: -1e12, stepT: null };
export function wheelStep(state, e, cfg) {
  const d = e.deltaY * (e.deltaMode === 1 ? cfg.lineHeightPx : e.deltaMode === 2 ? cfg.pageHeightPx : 1);
  let accum = state.accum;
  if (state.stepT !== null) {
    const unlocked = e.t - state.lastT >= cfg.idleResetMs && e.t - state.stepT >= cfg.cooldownMs;
    if (!unlocked) return { state: { accum: 0, lastT: e.t, stepT: state.stepT }, step: 0 };
    accum = 0;
  } else if (e.t - state.lastT >= cfg.idleResetMs) accum = 0;
  accum += d;
  if (Math.abs(accum) >= cfg.stepThresholdPx) return { state: { accum: 0, lastT: e.t, stepT: e.t }, step: Math.sign(accum) };
  return { state: { accum, lastT: e.t, stepT: null }, step: 0 };
}
export function pointerPolicy(c) {
  const none = { role: 'none', pan: false, tapZones: false, swipes: false };
  if (c.pointerCount === 0) return none;
  if (c.mode === 'presentation') return c.pointerCount === 1 ? { role: 'gestures', pan: false, tapZones: true, swipes: true } : none;
  if (c.mode === 'organization') return c.pointerCount === 1 ? { role: 'org-select', pan: true, tapZones: false, swipes: false } : { role: 'pinch', pan: true, tapZones: false, swipes: false };
  if (c.pointerCount >= 2) return { role: 'pinch', pan: true, tapZones: false, swipes: false };
  const fingerBlocked = c.stylusSeen && !c.allowFingerDrawing && c.pointerType === 'touch';
  if (c.toolActive && !fingerBlocked) return { role: 'draw', pan: false, tapZones: false, swipes: false };
  return { role: 'gestures', pan: c.zoomed, tapZones: true, swipes: !c.zoomed };
}

// ---------------------------------------------------------------- view
export const fitScale = (c, v, mode) => (mode === 'width' ? v.width / c.width : Math.min(v.width / c.width, v.height / c.height));
export const orgZoomLimits = (page, vp, maxZoom) => ({ min: Math.min(1, fitScale(page, vp, 'contain') / fitScale(page, vp, 'width')), max: maxZoom });
export const scrollAfterZoom = (s, a, o, n) => ({ x: ((s.x + a.x) * n) / o - a.x, y: ((s.y + a.y) * n) / o - a.y });
export function layoutPages(sizes, scale, gap) {
  let top = 0;
  return sizes.map((s) => { const p = { top, height: s.height * scale, width: s.width * scale }; top += p.height + gap; return p; });
}
export function pageAtOffset(layout, y, gap) {
  if (!layout.length) return -1;
  for (let i = 0; i < layout.length; i++) if (y < layout[i].top + layout[i].height + gap / 2) return i;
  return layout.length - 1;
}
export const FIT_VIEW = { zoom: 1, panX: 0, panY: 0 };
export function clampPan(v, fitted, vp) {
  const f = (size, vpAxis, pan) => { const s = size * v.zoom; if (s <= vpAxis) return 0; const m = (s - vpAxis) / 2; return Math.min(m, Math.max(-m, pan)); };
  return { zoom: v.zoom, panX: f(fitted.width, vp.width, v.panX), panY: f(fitted.height, vp.height, v.panY) };
}
export function zoomAround(v, factor, anchor, lim, fitted, vp) {
  const z2 = Math.min(lim.max, Math.max(lim.min, v.zoom * factor));
  const ux = anchor.x - vp.width / 2, uy = anchor.y - vp.height / 2;
  return clampPan({ zoom: z2, panX: ux - ((ux - v.panX) * z2) / v.zoom, panY: uy - ((uy - v.panY) * z2) / v.zoom }, fitted, vp);
}

// ---------------------------------------------------------------- additions
export function tilesCovering(visible, content, tile) {
  const out = [];
  const cols = Math.ceil(content.width / tile), rows = Math.ceil(content.height / tile);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x0 = i * tile, y0 = j * tile, x1 = Math.min(content.width, x0 + tile), y1 = Math.min(content.height, y0 + tile);
    const ix = Math.min(x1, visible.x + visible.width) - Math.max(x0, visible.x), iy = Math.min(y1, visible.y + visible.height) - Math.max(y0, visible.y);
    if (ix > 0 && iy > 0) out.push(R(x0, y0, x1 - x0, y1 - y0));
  }
  return out;
}
export function findEntryForSystem(entries, s) {
  if (!entries.length) return -1;
  const eq = entries.indexOf(s); if (eq >= 0) return eq;
  const greater = entries.filter((v) => v > s);
  if (greater.length) return entries.indexOf(Math.min(...greater));
  return entries.length - 1;
}
export const sizeClassOf = (w, h, l) => (w < l.compactMaxWidthPx || h < l.compactMaxHeightPx ? 'compact' : 'expanded');
