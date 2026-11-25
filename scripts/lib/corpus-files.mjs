// Which corpus files the tests use (V2-M2 S3, TST-015; V2-M3b S2, TST-024). Pure: the callers hand in what exists on disk.

import { ENGINES } from './corpus-schema.mjs';

/** Folders searched for an entry's file, in this order. */
export const CORPUS_FOLDERS = ['e2e/corpus/real', 'e2e/corpus/cache'];
/** Entries run by the Firefox and WebKit smoke projects. */
export const SMOKE_ENTRY_COUNT = 3;
/** A PDF with more pages than this is a stress file: it gets no detection regression run, only the responsiveness tests (V2-M2, owner decision). */
export const STRESS_MIN_PAGES = 100;
/** Smallest number of slide changes the performance test accepts as a measurement. */
export const MIN_PERF_SLIDE_CHANGES = 10;

/** The path of an entry's file (`exists(path)` tells whether a file is there), or `null` with the reason to show in the report. */
export function resolveCorpusEntry({ entry, exists }) {
  for (const folder of CORPUS_FOLDERS) {
    const path = `${folder}/${entry.file}`;
    if (exists(path)) return { path, reason: null };
  }
  return { path: null, reason: `${entry.file} is not present (put it in e2e/corpus/real/ or list its URL in e2e/corpus/urls.txt, then run npm run corpus)` };
}

/** The entries that belong to `suite` (`detection` or `load`); an entry can be in both. */
export function entriesOf(entries, suite) {
  return entries.filter((entry) => Array.isArray(entry.suites) && entry.suites.includes(suite));
}

/** The engines the `detection` suite runs an entry on: its `engines` list, or all desktop engines. */
export function enginesOf(entry) {
  return entry.engines === undefined ? [...ENGINES] : [...entry.engines];
}

/** The profiles an entry is asserted under: the defaults of profiles.json (`{ name: { default } }`) plus the entry's own, each once, in a stable order. */
export function profilesOf(entry, profiles) {
  const defaults = Object.keys(profiles).filter((name) => profiles[name].default === true);
  return [...new Set([...defaults, ...(entry.profiles ?? [])])];
}

/**
 * The counts a run of `profile` on `engine` must give: the matching deviation, else the reviewed `systemsPerPage`.
 * A deviation applies to its profile, on the named engine or (without `engine`) on every engine; one that names the engine wins over one that does not.
 */
export function expectedFor(entry, profile, engine) {
  const matching = (entry.deviations ?? []).filter((deviation) => deviation.profile === profile && (deviation.engine === undefined || deviation.engine === engine));
  const chosen = matching.find((deviation) => deviation.engine === engine) ?? matching[0];
  return chosen === undefined ? entry.systemsPerPage : chosen.systemsPerPage;
}

/** The first `count` entries. */
export function smokeEntries(entries, count = SMOKE_ENTRY_COUNT) {
  return entries.slice(0, count);
}

/**
 * The real PDFs the performance tests use. `files` are `{ file, path, source, bytes, pages, stress? }`; files without a source are not considered. Ties go to the name that sorts first.
 * - `largest`: the largest file (any kind), opened to measure the time to the first slide.
 * - `regular`: the regular PDF (not a stress file) with the most pages: slide changes and detection in the background, which need a finished detection.
 * - `heavy`: the stress file with the most pages, or `regular` when there is none: scrolling, zooming and jumps while detection is still running.
 */
export function pickPerfPdfs(files) {
  const real = files.filter((item) => item.source === 'folder' || item.source === 'url');
  const best = (list, key) =>
    list.reduce((top, item) => (top === null || item[key] > top[key] || (item[key] === top[key] && item.file < top.file) ? item : top), null);
  const regular = best(real.filter((item) => item.stress !== true), 'pages');
  return { largest: best(real, 'bytes'), regular, heavy: best(real.filter((item) => item.stress === true), 'pages') ?? regular };
}
