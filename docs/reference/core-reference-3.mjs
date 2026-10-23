// REFERENCE IMPLEMENTATION, part 3 (plain JavaScript): annotation, metadata, autosave, session, palm rejection.
// Same status as the other reference files: informational; the contracts and fixtures are the authority.
import { userToDisplay, displayToUser } from './core-reference.mjs';

// ---------------------------------------------------------------- annotation
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}
export function simplifyPath(points, eps) {
  if (points.length <= 2) return points.map((p) => ({ ...p }));
  const keep = new Array(points.length).fill(false); keep[0] = keep[points.length - 1] = true;
  const rec = (i, j) => {
    let best = -1, bi = -1;
    for (let k = i + 1; k < j; k++) { const d = distToSegment(points[k], points[i], points[j]); if (d > best) { best = d; bi = k; } }
    if (bi >= 0 && best > eps) { keep[bi] = true; rec(i, bi); rec(bi, j); }
  };
  rec(0, points.length - 1);
  return points.filter((_, i) => keep[i]).map((p) => ({ ...p }));
}
export function distanceToPolyline(p, pts) {
  if (!pts.length) return Infinity;
  if (pts.length === 1) return dist(p, pts[0]);
  let m = Infinity; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distToSegment(p, pts[i], pts[i + 1])); return m;
}
export const strokeHit = (s, p, r) => distanceToPolyline(p, s.points) <= r + s.widthPt / 2;
export function inkTransforms(comp) {
  const out = [];
  for (const c of comp.contents) {
    const dx = c.dest.x - c.source.x, dy = c.dest.y - c.source.y;
    if (!out.some((t) => t.pageIndex === c.pageIndex && Math.abs(t.dx - dx) <= 1e-6 && Math.abs(t.dy - dy) <= 1e-6)) out.push({ pageIndex: c.pageIndex, dx, dy });
  }
  return out;
}
const inDest = (d, p) => p.x >= d.x && p.x < d.x + d.width && p.y >= d.y && p.y < d.y + d.height;
export function startOwner(comp, p) {
  const i = comp.contents.findIndex((c) => inDest(c.dest, p));
  if (i < 0) return null;
  const c = comp.contents[i];
  return { contentIndex: i, pageIndex: c.pageIndex, dx: c.dest.x - c.source.x, dy: c.dest.y - c.source.y };
}
export function placementsAt(comp, p) {
  const out = [];
  for (const c of comp.contents) {
    if (!inDest(c.dest, p)) continue;
    const dx = c.dest.x - c.source.x, dy = c.dest.y - c.source.y;
    if (!out.some((t) => t.pageIndex === c.pageIndex && Math.abs(t.dx - dx) <= 1e-6 && Math.abs(t.dy - dy) <= 1e-6)) out.push({ pageIndex: c.pageIndex, dx, dy });
  }
  return out;
}
export const slidePointToUser = (o, box, p) => displayToUser({ x: p.x - o.dx, y: p.y - o.dy }, box);
export function userPointToSlide(pl, box, p) { const d = userToDisplay(p, box); return { x: d.x + pl.dx, y: d.y + pl.dy }; }
export const EMPTY_UNDO = { undo: [], redo: [] };
export function pushAction(s, a, depth) { const u = [...s.undo, a]; while (u.length > depth) u.shift(); return { undo: u, redo: [] }; }
export function undoStep(s) { if (!s.undo.length) return { state: s, action: null }; const a = s.undo[s.undo.length - 1]; return { state: { undo: s.undo.slice(0, -1), redo: [...s.redo, a] }, action: a }; }
export function redoStep(s) { if (!s.redo.length) return { state: s, action: null }; const a = s.redo[s.redo.length - 1]; return { state: { undo: [...s.undo, a], redo: s.redo.slice(0, -1) }, action: a }; }
export function applyAction(strokes, a, dir) {
  const has = (id) => strokes.some((s) => s.id === id);
  const add = (list, ss) => { const out = [...list]; for (const s of ss) if (!out.some((x) => x.id === s.id)) out.push(s); return out; };
  const rem = (list, ids) => list.filter((s) => !ids.includes(s.id));
  if (a.kind === 'add') return dir === 'redo' ? add(strokes, [a.stroke]) : rem(strokes, [a.stroke.id]);
  return dir === 'redo' ? rem(strokes, a.strokes.map((s) => s.id)) : add(strokes, a.strokes);
}

// ---------------------------------------------------------------- metadata
const r2 = (v) => Math.round(v * 100) / 100;
export function serializeMetadata(m) {
  const o = {
    schemaVersion: m.schemaVersion, appVersion: m.appVersion, pageCount: m.pageCount,
    detection: m.detection === null ? null : { level: m.detection.level, pages: m.detection.pages.map((p) => ({ pageIndex: p.pageIndex, width: r2(p.width), height: r2(p.height), state: p.state, systems: p.systems.map((r) => [r2(r.x), r2(r.y), r2(r.width), r2(r.height)]) })) },
    marks: { jumps: m.marks.jumps.map((j) => ({ id: j.id, origin: j.origin, target: j.target, pass: j.pass })), breaks: [...m.marks.breaks], stops: [...m.marks.stops], nextJumpId: m.marks.nextJumpId },
    aspectRatio: {},
  };
  if (m.aspectRatio.portrait !== undefined) o.aspectRatio.portrait = m.aspectRatio.portrait;
  if (m.aspectRatio.landscape !== undefined) o.aspectRatio.landscape = m.aspectRatio.landscape;
  return JSON.stringify(o);
}
const isInt = Number.isInteger;
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const bad = (reason) => ({ kind: 'invalid', reason });
export function parseMetadata(text) {
  let o; try { o = JSON.parse(text); } catch { return bad('json'); }
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return bad('root');
  if (!isInt(o.schemaVersion) || o.schemaVersion < 1) return bad('schemaVersion');
  if (o.schemaVersion > 1) return { kind: 'newer', version: o.schemaVersion };
  if (typeof o.appVersion !== 'string') return bad('appVersion');
  if (!isInt(o.pageCount) || o.pageCount < 0) return bad('pageCount');
  let detection = null;
  if (o.detection === undefined) return bad('detection');
  if (o.detection !== null) {
    const d = o.detection;
    if (typeof d !== 'object' || !['fast', 'standard', 'fine'].includes(d.level)) return bad('detection.level');
    if (!Array.isArray(d.pages)) return bad('detection.pages');
    const pages = [];
    for (let i = 0; i < d.pages.length; i++) {
      const p = d.pages[i], b = `detection.pages[${i}]`;
      if (!p || typeof p !== 'object') return bad(b);
      if (!isInt(p.pageIndex) || p.pageIndex < 0 || p.pageIndex >= o.pageCount) return bad(`${b}.pageIndex`);
      if (!num(p.width) || p.width <= 0) return bad(`${b}.width`);
      if (!num(p.height) || p.height <= 0) return bad(`${b}.height`);
      if (p.state !== 'done' && p.state !== 'failed') return bad(`${b}.state`);
      if (!Array.isArray(p.systems)) return bad(`${b}.systems`);
      const systems = [];
      for (let k = 0; k < p.systems.length; k++) {
        const r = p.systems[k];
        if (!Array.isArray(r) || r.length !== 4 || !r.every(num) || r[2] <= 0 || r[3] <= 0) return bad(`${b}.systems[${k}]`);
        systems.push({ x: r[0], y: r[1], width: r[2], height: r[3] });
      }
      pages.push({ pageIndex: p.pageIndex, width: p.width, height: p.height, state: p.state, systems });
    }
    detection = { level: d.level, pages };
  }
  const mk = o.marks;
  if (!mk || typeof mk !== 'object') return bad('marks');
  if (!Array.isArray(mk.jumps)) return bad('marks.jumps');
  const jumps = [];
  for (let i = 0; i < mk.jumps.length; i++) {
    const j = mk.jumps[i], b = `marks.jumps[${i}]`;
    if (!j || typeof j !== 'object') return bad(b);
    if (!isInt(j.id) || j.id < 1) return bad(`${b}.id`);
    if (!isInt(j.origin) || j.origin < 0) return bad(`${b}.origin`);
    if (!isInt(j.target) || j.target < 0) return bad(`${b}.target`);
    if (!isInt(j.pass) || j.pass < 1) return bad(`${b}.pass`);
    jumps.push({ id: j.id, origin: j.origin, target: j.target, pass: j.pass });
  }
  const asc = (a) => Array.isArray(a) && a.every((v) => isInt(v) && v >= 1) && a.every((v, i) => i === 0 || v > a[i - 1]);
  if (!asc(mk.breaks)) return bad('marks.breaks');
  if (!asc(mk.stops)) return bad('marks.stops');
  if (!isInt(mk.nextJumpId) || mk.nextJumpId <= Math.max(0, ...jumps.map((j) => j.id))) return bad('marks.nextJumpId');
  const ar = o.aspectRatio;
  if (!ar || typeof ar !== 'object') return bad('aspectRatio');
  const aspectRatio = {};
  for (const k of ['portrait', 'landscape']) {
    if (ar[k] !== undefined) { if (!num(ar[k]) || ar[k] < 0.5 || ar[k] > 2) return bad(`aspectRatio.${k}`); aspectRatio[k] = ar[k]; }
  }
  return { kind: 'ok', value: { schemaVersion: 1, appVersion: o.appVersion, pageCount: o.pageCount, detection, marks: { jumps, breaks: [...mk.breaks], stops: [...mk.stops], nextJumpId: mk.nextJumpId }, aspectRatio } };
}
export function reconcileMetadata(m, count) {
  if (m.pageCount !== count) return null;
  if (m.detection !== null && m.detection.pages.length !== count) return null;
  return m;
}

// ---------------------------------------------------------------- autosave
export const SAVE_INITIAL = { dirty: false, lastChangeT: 0, strokeInProgress: false, saving: false, forced: false, failed: false };
export function reduceSave(s, e) {
  switch (e.type) {
    case 'change': return { ...s, dirty: true, lastChangeT: e.t, failed: false };
    case 'strokeStart': return { ...s, strokeInProgress: true };
    case 'strokeEnd': return { ...s, strokeInProgress: false, dirty: true, lastChangeT: e.t, failed: false };
    case 'force': return { ...s, forced: true, failed: false };
    case 'saveStarted': return { ...s, saving: true, dirty: false, forced: false };
    default: return e.ok ? { ...s, saving: false } : { ...s, saving: false, dirty: true, failed: true };
  }
}
export function saveDecision(s, now, idle) {
  if (!s.dirty || s.saving || s.strokeInProgress) return { action: 'none' };
  if (s.forced) return { action: 'save' };
  if (s.failed) return { action: 'none' };
  if (now - s.lastChangeT >= idle) return { action: 'save' };
  return { action: 'wait', until: s.lastChangeT + idle };
}

// ---------------------------------------------------------------- session
export function parseSession(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 || !Array.isArray(raw.tabs)) return null;
  const tabs = []; const seen = new Set();
  for (const t of raw.tabs) {
    if (!t || typeof t !== 'object' || !t.ref || typeof t.ref !== 'object') continue;
    const { id, name } = t.ref;
    if (typeof id !== 'string' || !id || typeof name !== 'string' || !name || seen.has(id)) continue;
    seen.add(id);
    const ref = { id, name };
    if (num(t.ref.size)) ref.size = t.ref.size;
    if (num(t.ref.lastModified)) ref.lastModified = t.ref.lastModified;
    const nn = (v) => (isInt(v) && v >= 0 ? v : 0);
    tabs.push({ ref, system: nn(t.system), orgPage: nn(t.orgPage), orgOffset: num(t.orgOffset) && t.orgOffset >= 0 ? t.orgOffset : 0 });
  }
  let a = isInt(raw.activeIndex) ? raw.activeIndex : 0;
  a = tabs.length ? Math.min(tabs.length - 1, Math.max(0, a)) : 0;
  return { version: 1, tabs, activeIndex: a };
}

// ---------------------------------------------------------------- palm
export const PEN_INITIAL = { active: false, lastT: -1e12 };
export const reducePen = (s, e) => ({ active: ['pen-down', 'pen-move', 'pen-hover'].includes(e.type), lastT: e.t });
export const shouldIgnoreTouch = (pen, now, grace) => pen.active || now - pen.lastT <= grace;
