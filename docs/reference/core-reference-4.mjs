// REFERENCE IMPLEMENTATION, part 4 (plain JavaScript): data model v2 (marks on systems, labels, start mark, V1 migration).
// Same status as the other reference files: informational; the contracts and fixtures are the authority.
// It works differently from the contract wording on purpose: systems are one flat list of [page, number] pairs.
import { generatePlayingOrder, forcedBreaks } from './core-reference.mjs';

const isValidJump = (j, n) => [j.origin, j.target, j.pass].every(Number.isInteger) && j.pass >= 1 && j.origin !== j.target
  && Math.min(j.origin, j.target) >= 0 && Math.max(j.origin, j.target) <= n;

const clone = (x) => structuredClone(x);
const flat = (counts) => counts.flatMap((c, page) => Array.from({ length: c }, (_, i) => `${page}/${i + 1}`));
const keyOf = (r) => `${r.pageIndex}/${r.system}`;
const refOf = (key) => { const [pageIndex, system] = key.split('/').map(Number); return { pageIndex, system }; };
const isForeign = (r) => Object.hasOwn(r, 'file');
const foreignOk = (r) => r.file !== '' && Number.isInteger(r.pageIndex) && r.pageIndex >= 0 && Number.isInteger(r.system) && r.system >= 1;
const withText = (obj, text) => (text ? { ...obj, text } : obj);
const printOrder = (a, b) => a.at.pageIndex - b.at.pageIndex || a.at.system - b.at.system;

// ---------------------------------------------------------------- marks
export const defaultPass = (marks, from) => 1 + marks.jumps.filter((j) => keyOf(j.from) === keyOf(from)).length;

export function addMark(marks, mark, counts) {
  const all = flat(counts), pos = (r) => all.indexOf(keyOf(r));
  const own = mark.kind === 'jump' ? mark.from : mark.at;
  if (pos(own) < 0) return null;
  const out = clone(marks);
  if (mark.kind === 'jump') {
    if (!Number.isInteger(mark.pass) || mark.pass < 1) return null;
    if (isForeign(mark.to) ? !foreignOk(mark.to) : pos(mark.to) < 0 || pos(mark.to) === pos(mark.from) + 1) return null;
    out.jumps.push(withText({ id: out.nextJumpId++, from: mark.from, to: mark.to, pass: mark.pass }, mark.text));
  } else if (mark.kind === 'bookmark') {
    if (mark.ref && !foreignOk(mark.ref)) return null;
    out.bookmarks.push(withText({ id: out.nextBookmarkId++, at: mark.at, ...(mark.ref ? { ref: mark.ref } : {}) }, mark.text));
  } else if (mark.kind === 'start') {
    out.start = withText({ at: mark.at }, mark.text);
  } else {
    const name = mark.kind === 'stop' ? 'stops' : 'breaks';
    const rest = out[name].filter((m) => keyOf(m.at) !== keyOf(mark.at));
    if (rest.length < out[name].length) out[name] = rest;
    else if (pos(mark.at) === all.length - 1) return null;
    else out[name] = [...rest, withText({ at: mark.at }, mark.text)].sort(printOrder);
  }
  return out;
}

function filterMarks(marks, gone) {
  const keep = (m) => !gone(m.at);
  return {
    ...clone(marks),
    jumps: clone(marks.jumps.filter((j) => !gone(j.from) && (isForeign(j.to) || !gone(j.to)))),
    bookmarks: clone(marks.bookmarks.filter(keep)),
    stops: clone(marks.stops.filter(keep)),
    breaks: clone(marks.breaks.filter(keep)),
    start: marks.start && keep(marks.start) ? clone(marks.start) : null,
  };
}

export function removeMarksOfSystem(marks, deleted) {
  const out = filterMarks(marks, (r) => keyOf(r) === keyOf(deleted));
  const shift = (r) => { if (!isForeign(r) && r.pageIndex === deleted.pageIndex && r.system > deleted.system) r.system -= 1; };
  for (const j of out.jumps) { shift(j.from); shift(j.to); }
  for (const m of [...out.bookmarks, ...out.stops, ...out.breaks, ...(out.start ? [out.start] : [])]) shift(m.at);
  return out;
}

export const rerunPage = (marks, pageIndex, oldCount, newCount) =>
  oldCount === newCount ? marks : filterMarks(marks, (r) => r.pageIndex === pageIndex);

// ---------------------------------------------------------------- labels
export function formatLabel({ from, to, pass, text }, currentFile, { separator, jumpArrow, passPrefix }) {
  const place = (p) => [...(p.file === currentFile ? [] : [p.file]), p.pageIndex + 1, p.system].join(separator);
  const parts = [place(from)];
  if (to) parts.push(jumpArrow, place(to));
  if (to && pass > 1) parts.push(`${passPrefix}${pass}`);
  if (text && text.trim()) parts.push(text);
  return parts.join(' ');
}

// ---------------------------------------------------------------- derivation (PLY-014..PLY-016)
export function derivePlayingOrderInput(marks, counts, maxLength) {
  const all = flat(counts), n = all.length;
  const right = (r) => all.indexOf(keyOf(r)) + 1; // 0 = missing
  const junctions = (list) => list.map((m) => right(m.at)).filter((k) => k >= 1 && k < n).sort((a, b) => a - b);
  const jumps = marks.jumps
    .filter((j) => !isForeign(j.to) && right(j.from) > 0 && right(j.to) > 0 && right(j.from) !== right(j.to) - 1)
    .map((j) => ({ origin: right(j.from), target: right(j.to) - 1, pass: j.pass }));
  const start = marks.start ? right(marks.start.at) : 0;
  return { systemCount: n, startJunction: Math.max(0, start - 1), jumps, stops: junctions(marks.stops), breaks: junctions(marks.breaks), maxLength };
}

/**
 * The replay with a start junction: reference 1 starts at junction 0, so a helper junction is not possible without changing
 * arrival counts; the replay is therefore written again here (stops as in reference 1: cut at the last arrival, shortest wins).
 */
export function playFrom({ systemCount, startJunction = 0, jumps, stops, maxLength }) {
  const count = new Map(), seen = [], entries = [];
  let at = startJunction, truncatedByCap = false;
  for (let guard = 0; guard < 100000; guard++) {
    const c = (count.get(at) ?? 0) + 1;
    count.set(at, c);
    seen.push([at, entries.length]);
    const jump = jumps.find((j) => j.origin === at && j.pass === c);
    if (jump) { at = jump.target; continue; }
    if (at >= systemCount) break;
    if (entries.length === maxLength) { truncatedByCap = true; break; }
    entries.push(++at);
  }
  const cuts = stops.flatMap((stop) => seen.filter(([j]) => j === stop).slice(-1).map(([, len]) => len));
  const kept = entries.slice(0, Math.min(entries.length, ...cuts));
  const between = kept.slice(1).map((_, i) => seen.filter(([, len]) => len === i + 1).map(([j]) => j));
  return { entries: kept, between, truncatedByCap };
}

// ---------------------------------------------------------------- migration (SAV-016)
/** Whether the jump at `index` fires before the arrival at which the V1 order ends. */
function reachedJumps(n, jumps, stops, maxLength) {
  const count = new Map(), seen = [], fired = new Map();
  let at = 0, len = 0;
  for (;;) {
    const c = (count.get(at) ?? 0) + 1;
    count.set(at, c);
    seen.push([at, len]);
    const index = jumps.findIndex((j) => j.origin === at && j.pass === c);
    if (index >= 0) { fired.set(index, seen.length - 1); at = jumps[index].target; continue; }
    if (at === n || len >= maxLength) break;
    at++; len++;
  }
  let end = Infinity, shortest = Infinity;
  for (const stop of stops) {
    const last = seen.map(([j]) => j).lastIndexOf(stop);
    if (last < 0) continue;
    const cut = seen[last][1];
    if (cut < shortest || (cut === shortest && last < end)) { shortest = cut; end = last; }
  }
  return new Set([...fired].filter(([, when]) => when < end).map(([index]) => index));
}

export function v1Order(v1, counts, maxLength) {
  const n = flat(counts).length;
  const jumps = v1.jumps.filter((j) => isValidJump(j, n));
  const inside = (k) => Number.isInteger(k) && k >= 1 && k < n;
  const stops = v1.stops.filter(inside), breaks = v1.breaks.filter(inside);
  const order = generatePlayingOrder({ systemCount: n, jumps, stops, maxLength });
  return { n, jumps, stops, breaks, order, forced: forcedBreaks(order, new Set(breaks)) };
}

export function v2Order(marks, counts, maxLength) {
  const input = derivePlayingOrderInput(marks, counts, maxLength);
  const order = playFrom(input);
  return { order, forced: forcedBreaks(order, new Set(input.breaks)) };
}

export const sameOrder = (a, b) => JSON.stringify([a.order.entries, a.forced]) === JSON.stringify([b.order.entries, b.forced]);

export function migrateMarksV1(v1, counts, maxLength) {
  const all = flat(counts);
  const old = v1Order(v1, counts, maxLength);
  const { n, jumps } = old;
  const system = (k) => refOf(all[k - 1]);
  const isEdge = (j) => j.origin === 0 || j.target === n;
  const build = (startAt, extraStops) => ({
    jumps: jumps.filter((j) => !isEdge(j)).map((j) => ({ id: j.id, from: system(j.origin), to: system(j.target + 1), pass: j.pass })),
    bookmarks: [],
    stops: [...new Set([...old.stops, ...extraStops])].sort((a, b) => a - b).map((k) => ({ at: system(k) })),
    breaks: [...new Set(old.breaks)].sort((a, b) => a - b).map((k) => ({ at: system(k) })),
    start: startAt === undefined ? null : { at: system(startAt) },
    nextJumpId: v1.nextJumpId,
    nextBookmarkId: 1,
  });
  const reached = reachedJumps(n, jumps, old.stops, maxLength);
  const live = jumps.filter((_, i) => reached.has(i));
  const first = live.find((j) => j.origin === 0 && j.pass === 1 && j.target >= 1 && j.target < n);
  const toEnd = live.filter((j) => j.target === n && j.origin >= 1 && j.origin < n).map((j) => j.origin);
  const plain = build(undefined, []);
  if (!first && toEnd.length === 0) return plain;
  const converted = build(first ? first.target + 1 : undefined, toEnd);
  return sameOrder(old, v2Order(converted, counts, maxLength)) ? converted : plain;
}
