// Expectation helper logic (V2-M2 S2, TST-013, TST-014). Decides which corpus PDFs to measure and merges the measured system counts into
// e2e/corpus/expected.json. Pure: the measuring itself is done by e2e/tools/propose-expected.spec.ts, called from scripts/make-expected.mjs.

import { validateEntry } from './corpus-schema.mjs';

/** Profile of the proposals (a name from e2e/corpus/profiles.json; V2-M8 adds parameter-set profiles). */
export const PROPOSAL_PROFILE = 'v1-standard';
const LOAD_NOTE = 'load file: only the load suite uses it';

/** The PDFs of the corpus: those of the folder and those of the download cache; a name in both is taken from the folder. */
export function listCorpusPdfs({ realFiles, cacheFiles }) {
  const isPdf = (name) => name.toLowerCase().endsWith('.pdf');
  const folder = realFiles.filter(isPdf);
  const pdfs = folder.map((file) => ({ file, source: 'folder' }));
  const warnings = [];
  for (const file of cacheFiles.filter(isPdf)) {
    if (folder.includes(file)) warnings.push(`${file} exists in the folder and in the download cache: the folder file is used`);
    else pdfs.push({ file, source: 'url' });
  }
  pdfs.sort((a, b) => a.file.localeCompare(b.file));
  return { pdfs, warnings };
}

/** An entry counts as reviewed unless it says `"reviewed": false` (the V1 entries have no such key and were checked by hand). */
export function isReviewed(entry) {
  return entry.reviewed !== false;
}

/** The PDFs to measure: those without an entry and those whose entry is not reviewed; all of them with `force`. */
export function selectToMeasure({ pdfs, entries, force = false }) {
  return pdfs.filter((pdf) => {
    if (force) return true;
    const entry = entries.find((candidate) => candidate.file === pdf.file);
    return entry === undefined || !isReviewed(entry);
  });
}

/** Page-count rule of the suite proposal: a file with more pages is a load file (V2-M3b, DEC-152); the owner may add the other suite. */
export function proposeSuites(measurement) {
  return Array.isArray(measurement) ? ['detection'] : ['load'];
}

/**
 * Merges measured counts (`measured[file]` = system count per page, `null` for a page that failed; or `{ load: true, pages }` for a file above
 * STRESS_MIN_PAGES, which is not run through detection) into the entries (V2 format, V2-M3b S2).
 * A new PDF gets an unreviewed entry (reviewed for a load file: it has no counts to review). An unreviewed entry is refreshed (suites proposed
 * anew, everything else kept). A reviewed entry stays as it is unless `force`, which replaces its counts, keeps suites, tags, engines, profiles,
 * deviations and note, and marks it unreviewed again. Entries of other files stay. With `profiles` (the content of profiles.json) every added or
 * refreshed entry is validated; the problems come back as `file: problem` lines and the caller writes nothing when there are any.
 */
export function mergeProposals({ entries, pdfs, measured, force = false, profiles }) {
  const result = entries.map((entry) => ({ ...entry }));
  const report = { added: [], refreshed: [], kept: [], warnings: [], problems: [] };
  const added = [];
  const touched = [];
  for (const { file, source } of pdfs) {
    const measurement = measured[file];
    if (measurement === undefined) continue;
    const load = !Array.isArray(measurement);
    const counts = load ? [] : measurement;
    const pages = load ? { pages: measurement.pages } : {};
    if (counts.some((count) => count === null)) report.warnings.push(`${file}: detection did not finish for every page (null in the proposal)`);
    const index = result.findIndex((entry) => entry.file === file);
    if (index < 0) {
      const entry = {
        file,
        source,
        suites: proposeSuites(measurement),
        profiles: [],
        systemsPerPage: counts,
        deviations: [],
        ...pages,
        note: load ? LOAD_NOTE : '',
        reviewed: load, // a load file has no expectation to review
      };
      added.push(entry);
      touched.push(entry);
      report.added.push(file);
    } else if (isReviewed(result[index]) && !force) {
      report.kept.push(file);
    } else {
      const old = result[index];
      const keepSuites = isReviewed(old) && old.suites !== undefined;
      const entry = {
        ...old,
        file,
        source,
        suites: keepSuites ? old.suites : proposeSuites(measurement),
        systemsPerPage: counts,
        ...pages,
        note: load && old.note === '' ? LOAD_NOTE : old.note,
        reviewed: load,
      };
      if (!load) delete entry.pages;
      result[index] = entry;
      touched.push(entry);
      report.refreshed.push(file);
    }
  }
  if (profiles !== undefined) {
    for (const entry of touched) for (const problem of validateEntry(entry, profiles)) report.problems.push(`${entry.file}: ${problem}`);
  }
  added.sort((a, b) => a.file.localeCompare(b.file));
  return { entries: [...result, ...added], ...report };
}

/** expected.json text in the V1 layout: one entry per line, trailing newline. */
export function serializeExpected(entries) {
  const valueText = (value) => (Array.isArray(value) ? `[${value.map((item) => JSON.stringify(item)).join(', ')}]` : JSON.stringify(value));
  const entryText = (entry) =>
    `{ ${Object.entries(entry)
      .map(([key, value]) => `${JSON.stringify(key)}: ${valueText(value)}`)
      .join(', ')} }`;
  return `[\n${entries.map((entry) => `  ${entryText(entry)}`).join(',\n')}\n]\n`;
}
