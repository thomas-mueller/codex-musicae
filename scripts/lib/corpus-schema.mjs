// Corpus entry schema (V2-M3b S1, TST-023). Pure: the callers hand in the entry and the profile list (e2e/corpus/profiles.json).

/** The suites an entry can belong to: detection counts per page, or load (responsiveness and resources). */
export const SUITES = ['detection', 'load'];
/** The desktop engines the detection suite runs on. */
export const ENGINES = ['chromium', 'firefox', 'webkit'];

const isCounts = (value) => Array.isArray(value) && value.every((count) => count === null || Number.isInteger(count));

/**
 * The problems of one `expected.json` entry (empty list: valid). `profiles` is the content of profiles.json (name → `{ default }`).
 * Rules: known suites (non-empty); known profiles and engines; `detection` needs counts; a `load`-only entry has none; counts need `reviewed`;
 * narrowing `engines` below all engines needs a note; a deviation names a known profile and carries counts.
 */
export function validateEntry(entry, profiles) {
  const problems = [];
  const known = Object.keys(profiles);
  const suites = entry.suites;
  const hasCounts = Array.isArray(entry.systemsPerPage) && entry.systemsPerPage.length > 0;

  if (!Array.isArray(suites) || suites.length === 0) {
    problems.push('suites must be a non-empty list');
  } else {
    for (const suite of suites) if (!SUITES.includes(suite)) problems.push(`unknown suite "${suite}"`);
  }
  const inSuite = (name) => Array.isArray(suites) && suites.includes(name);

  for (const profile of entry.profiles ?? []) if (!known.includes(profile)) problems.push(`unknown profile "${profile}"`);
  for (const engine of entry.engines ?? []) if (!ENGINES.includes(engine)) problems.push(`unknown engine "${engine}"`);

  if (inSuite('detection') && !hasCounts) problems.push('a detection entry needs systemsPerPage');
  if (inSuite('load') && !inSuite('detection') && hasCounts) problems.push('a load-only entry has no systemsPerPage');
  if (entry.systemsPerPage !== undefined && !isCounts(entry.systemsPerPage)) problems.push('systemsPerPage must be a list of integers or null');
  if (hasCounts && typeof entry.reviewed !== 'boolean') problems.push('an entry with counts needs reviewed');

  if (entry.engines !== undefined) {
    if (entry.engines.length === 0) problems.push('engines must not be empty (leave it out to run on every engine)');
    const narrowed = ENGINES.some((engine) => !entry.engines.includes(engine));
    if (narrowed && (typeof entry.note !== 'string' || entry.note.trim() === '')) problems.push('narrowing engines needs a note');
  }

  for (const deviation of entry.deviations ?? []) {
    if (!known.includes(deviation.profile)) problems.push(`deviation names unknown profile "${deviation.profile}"`);
    if (deviation.engine !== undefined && !ENGINES.includes(deviation.engine)) problems.push(`deviation names unknown engine "${deviation.engine}"`);
    if (!isCounts(deviation.systemsPerPage)) problems.push('a deviation needs systemsPerPage');
  }
  return problems;
}
