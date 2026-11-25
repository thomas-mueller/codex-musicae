import { loadFiles, STRESS_MIN_PAGES } from '../../scripts/lib/corpus-files.mjs';

const entry = (file: string, suites: string[], extra: { pages?: number; systemsPerPage?: number[] } = {}) => ({ file, source: 'url' as const, suites, systemsPerPage: [2, 2, 2], ...extra });

describe('load suite file selection', () => {
  it('TST-025 TST-015 only the entries of the load suite are perf files; a detection-only entry is not', () => {
    const files = loadFiles([entry('a.pdf', ['detection']), entry('b.pdf', ['load']), entry('c.pdf', ['detection', 'load'])]);
    expect(files.map((f) => f.file)).toEqual(['b.pdf', 'c.pdf']);
  });

  it('TST-025 TST-015 the page count is `pages` when given, else the number of counts', () => {
    const files = loadFiles([entry('a.pdf', ['load'], { pages: 281, systemsPerPage: [] }), entry('b.pdf', ['load'])]);
    expect(files.map((f) => f.pages)).toEqual([281, 3]);
  });

  it('TST-025 TST-015 a file above the page limit is a stress file, one at the limit is regular', () => {
    const files = loadFiles([entry('big.pdf', ['load'], { pages: STRESS_MIN_PAGES + 1 }), entry('edge.pdf', ['load'], { pages: STRESS_MIN_PAGES })]);
    expect(files.map((f) => f.stress)).toEqual([true, false]);
  });

  it('TST-025 TST-015 an empty corpus or one without load entries gives no files', () => {
    expect(loadFiles([])).toEqual([]);
    expect(loadFiles([entry('a.pdf', ['detection'])])).toEqual([]);
  });
});
