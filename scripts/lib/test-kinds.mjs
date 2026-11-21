// Tests per kind and the coverage table (V2-M1 S4, PIP-016, PIP-017). Pure logic; scripts/coverage-summary.mjs feeds it the spec files and
// the Vitest coverage summary. Nothing here ever fails a build because of a number (PIP-017).

const TEST_CALL = /\b(?:it|test|desktopTest)(?:\.\w+)*\s*\(\s*(['"`])/g;

/** Number of test calls (it, test, desktopTest) in a spec file: a static count, so generated and `.each` cases count once. */
export function countTests(text) {
  return (text.match(TEST_CALL) ?? []).length;
}

/** The kind of a spec file: the first kind with a matching pattern, or null. */
export function kindOf(path, kinds) {
  return kinds.find((kind) => kind.patterns.some((pattern) => new RegExp(pattern).test(path))) ?? null;
}

/** files: { path: text }. Returns one row per kind, in the order of `kinds`. */
export function countByKind(files, kinds) {
  const rows = kinds.map((kind) => ({ ...kind, files: 0, tests: 0 }));
  for (const [path, text] of Object.entries(files)) {
    const kind = kindOf(path, kinds);
    const row = rows.find((candidate) => candidate.id === kind?.id);
    if (row) {
      row.files += 1;
      row.tests += countTests(text);
    }
  }
  return rows;
}

const percent = (value) => `${value.toFixed(1)} %`;

/** coverage: the `total` object of a Vitest json-summary file, or null when no coverage run happened. */
export function renderTable(rows, coverage) {
  const vitestCoverage = coverage
    ? `lines ${percent(coverage.lines.pct)}, branches ${percent(coverage.branches.pct)} (Vitest, unit and integration together)`
    : 'no coverage run: tests counted only';
  const lines = ['| Kind of test | Tests | Coverage |', '|---|---:|---|'];
  for (const row of rows) {
    lines.push(`| ${row.label} | ${row.tests} | ${row.vitest ? vitestCoverage : 'no coverage source: number of tests only'} |`);
  }
  lines.push('', 'No coverage threshold applies: the numbers are information (PIP-017).');
  return lines.join('\n');
}
