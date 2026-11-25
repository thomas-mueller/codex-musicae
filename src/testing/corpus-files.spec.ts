import { readFileSync } from 'node:fs';

import { MIN_PERF_SLIDE_CHANGES, pickPerfPdfs, STRESS_MIN_PAGES, resolveCorpusEntry, type PerfPdf } from '../../scripts/lib/corpus-files.mjs';

const pdf = (file: string, bytes: number, pages: number, source: 'folder' | 'url' | null = 'folder'): PerfPdf => ({
  file,
  path: `e2e/corpus/real/${file}`,
  ...(source === null ? {} : { source }),
  bytes,
  pages,
});
const text = (path: string): string => readFileSync(path, 'utf8').replace(/^\s*#.*$/gm, '');

describe('corpus file selection', () => {
  it('TST-015 an entry file is searched in real/, then cache/', () => {
    const entry = { file: 'a.pdf' };
    expect(resolveCorpusEntry({ entry, exists: () => true }).path).toBe('e2e/corpus/real/a.pdf');
    expect(resolveCorpusEntry({ entry, exists: (p) => p !== 'e2e/corpus/real/a.pdf' }).path).toBe('e2e/corpus/cache/a.pdf');
    expect(resolveCorpusEntry({ entry, exists: (p) => p === 'e2e/corpus/a.pdf' }).path).toBeNull();
  });

  it('TST-015 an absent entry file gives a reason that names npm run corpus', () => {
    const result = resolveCorpusEntry({ entry: { file: 'gone.pdf' }, exists: () => false });
    expect(result.path).toBeNull();
    expect(result.reason).toContain('gone.pdf');
    expect(result.reason).toContain('npm run corpus');
  });

  it('TST-015 the performance PDFs: the largest file, the regular PDF with the most pages and the heavy stress file', () => {
    const picked = pickPerfPdfs([
      pdf('a.pdf', 900, 3),
      pdf('b.pdf', 100, 80),
      pdf('c.pdf', 500, 10, 'url'),
      { ...pdf('stress.pdf', 800, 281), stress: true },
    ]);
    expect(picked.largest?.file).toBe('a.pdf');
    expect(picked.regular?.file).toBe('b.pdf');
    expect(picked.heavy?.file).toBe('stress.pdf');
  });

  it('TST-015 without a stress file the heavy PDF is the regular one; a stress file is never the regular one', () => {
    expect(pickPerfPdfs([pdf('x.pdf', 5, 5)])).toMatchObject({ largest: { file: 'x.pdf' }, regular: { file: 'x.pdf' }, heavy: { file: 'x.pdf' } });
    expect(pickPerfPdfs([{ ...pdf('s.pdf', 9, 300), stress: true }])).toMatchObject({ largest: { file: 's.pdf' }, regular: null, heavy: { file: 's.pdf' } });
  });

  it('TST-015 ties go to the first name, files without a source and an empty corpus are ignored', () => {
    expect(pickPerfPdfs([pdf('b.pdf', 5, 5), pdf('a.pdf', 5, 5)]).largest?.file).toBe('a.pdf');
    expect(pickPerfPdfs([pdf('old.pdf', 99, 99, null), pdf('real.pdf', 1, 1)]).largest?.file).toBe('real.pdf');
    expect(pickPerfPdfs([])).toEqual({ largest: null, regular: null, heavy: null });
    expect(MIN_PERF_SLIDE_CHANGES).toBeGreaterThan(0);
    expect(STRESS_MIN_PAGES).toBeGreaterThan(MIN_PERF_SLIDE_CHANGES);
  });
});

describe('corpus wiring', () => {
  it('TST-015 the e2e and perf jobs fetch the corpus before the tests and the generated reference PDF is gone', () => {
    const workflow = text('.github/workflows/e2e.yml');
    const fetches = workflow.match(/node scripts\/corpus\.mjs --no-expected/g) ?? [];
    expect(fetches).toHaveLength(2);
    expect(workflow).not.toContain('make:large-pdf');
    expect(workflow.indexOf('corpus.mjs')).toBeLessThan(workflow.indexOf('npx playwright test --project=${{ matrix.project }}'));
    expect(text('package.json')).not.toContain('make:large-pdf');
    expect(text('.gitignore')).not.toContain('reference-120');
  });

  it('TST-015 the Firefox and WebKit jobs build the development app that carries the detection hook', () => {
    const workflow = text('.github/workflows/e2e.yml');
    expect(workflow).toMatch(/project: firefox, browser: firefox, dev: '1'/);
    expect(workflow).toMatch(/project: webkit, browser: webkit, dev: '1'/);
  });
});
