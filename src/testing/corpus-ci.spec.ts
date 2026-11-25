import { readFileSync } from 'node:fs';

import { comparedValue, SUMMARY_HEADER, SUMMARY_MARKER, summaryRow } from '../../scripts/lib/load-checks.mjs';

const read = (path: string): string => readFileSync(path, 'utf8');
const e2e = read('.github/workflows/e2e.yml').replace(/^\s*#.*$/gm, '');

describe('job summary rows', () => {
  it('TST-026 the value held against the limit is the first compared key present', () => {
    expect(comparedValue({ min: 1, p95: 5, max: 9 })).toBe(5);
    expect(comparedValue({ during: 13, idle: 12, added: 1 })).toBe(1);
    expect(comparedValue({ longest: 200 })).toBe(200);
    expect(comparedValue({ elapsed: 3000 })).toBe(3000);
    expect(comparedValue({ cacheMib: 1 })).toBeUndefined();
  });

  it('TST-026 a row has entry, scenario, value, limit and result: ok within the limit, breach above it', () => {
    const row = (value: number, limit?: number) => summaryRow({ entry: 'a.pdf', name: 'open (ms)', values: { elapsed: value }, limit });
    expect(row(10, 20)).toBe('| a.pdf | open (ms) | elapsed=10.0 | 20.0 | ok |\n');
    expect(row(20, 20)).toContain('| ok |');
    expect(row(21, 20)).toContain('| breach |');
  });

  it('TST-026 a value without a limit or without a compared key has no result, and no entry is shown as a dash', () => {
    expect(summaryRow({ name: 'cache', values: { total: 3 } })).toBe('| – | cache | total=3.0 | – | – |\n');
    expect(summaryRow({ entry: 'a.pdf', name: 'x', values: { cacheMib: 3 }, limit: 5 })).toContain('| 5.0 | – |');
  });

  it('TST-026 the entry is not repeated in the scenario name', () => {
    expect(summaryRow({ entry: 'a.pdf', name: 'longest long task (ms) a.pdf', values: { longest: 1 }, limit: 2 })).toContain('| a.pdf | longest long task (ms) | ');
  });

  it('TST-026 the header carries the marker that tells the writer it is already there', () => {
    expect(SUMMARY_HEADER.startsWith(SUMMARY_MARKER)).toBe(true);
    expect(SUMMARY_HEADER).toContain('| Entry | Scenario | Value | Limit | Result |');
    expect(read('e2e/perf/support.ts')).toContain('GITHUB_STEP_SUMMARY');
  });
});

describe('perf job and time limits', () => {
  const perf = /^ {2}perf:\n((?: {4}.*\n|\s*\n)+)/m.exec(e2e)?.[1] ?? '';

  it('TST-026 the perf job runs the perf project without retries, has a time limit and cannot hide a breach', () => {
    expect(perf).toContain('npx playwright test --project=perf');
    expect(perf).not.toMatch(/--retries/);
    expect(perf).toMatch(/^ {4}timeout-minutes:\s*\d+/m);
    expect(perf).not.toContain('continue-on-error');
  });

  it('TST-027 the three desktop engine jobs have their own time limit, the job reads it with a default, and WebKit keeps one worker', () => {
    expect(e2e).toContain('timeout-minutes: ${{ matrix.timeout || 90 }}');
    for (const project of ['chromium', 'firefox', 'webkit']) {
      expect(e2e, project).toMatch(new RegExp(`project: ${project}, browser: ${project}, dev: '1',[^}]*timeout: \\d+`));
    }
    expect(e2e).toMatch(/project: webkit, browser: webkit, dev: '1', workers: '1'/);
    expect(e2e).not.toMatch(/project: \w+-(phone|tablet|iphone|ipad),[^}]*timeout:/);
  });

  it('TST-027 each detection run is limited by the page count, and a run that does not finish names engine and file', () => {
    const spec = read('e2e/detection-corpus.spec.ts');
    expect(spec).toContain('detectionRunTimeoutMs');
    expect(spec).toContain('test.setTimeout(');
    expect(spec).toMatch(/detection did not finish on \$\{engine\} for \$\{entry\.file\}/);
  });
});
