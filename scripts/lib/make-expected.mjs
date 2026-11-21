// Expectation helper logic (V2-M2 S2, TST-013, TST-014). Decides which corpus PDFs to measure and merges the measured system counts into
// e2e/corpus/expected.json. Pure: the measuring itself is done by e2e/tools/propose-expected.spec.ts, called from scripts/make-expected.mjs.

/** Detection level of the proposals (the V1 level; V2-M8 replaces it by the parameter set). */
export const PROPOSAL_LEVEL = 'standard';

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

/**
 * Merges measured counts (`measured[file]` = system count per page, `null` for a page that failed) into the entries.
 * A new PDF gets an unreviewed entry; an unreviewed entry is refreshed and keeps note and known limitation; a reviewed entry stays as it is
 * unless `force`, which replaces its counts, keeps note and limitation and marks it unreviewed again. Entries of other files stay.
 */
export function mergeProposals({ entries, pdfs, measured, force = false }) {
  const result = entries.map((entry) => ({ ...entry }));
  const report = { added: [], refreshed: [], kept: [], warnings: [] };
  const added = [];
  for (const { file, source } of pdfs) {
    const counts = measured[file];
    if (counts === undefined) continue;
    if (counts.some((count) => count === null)) report.warnings.push(`${file}: detection did not finish for every page (null in the proposal)`);
    const index = result.findIndex((entry) => entry.file === file);
    if (index < 0) {
      added.push({ file, source, level: PROPOSAL_LEVEL, systemsPerPage: counts, note: '', knownLimitation: null, reviewed: false });
      report.added.push(file);
    } else if (isReviewed(result[index]) && !force) {
      report.kept.push(file);
    } else {
      const { note, knownLimitation } = result[index];
      result[index] = { file, source, level: PROPOSAL_LEVEL, systemsPerPage: counts, note, knownLimitation, reviewed: false };
      report.refreshed.push(file);
    }
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
