import { readFileSync } from 'node:fs';

import { countByKind, countTests, kindOf, renderTable } from '../../scripts/lib/test-kinds.mjs';

const { kinds } = JSON.parse(readFileSync('scripts/test-kinds.json', 'utf8')) as { kinds: Parameters<typeof kindOf>[1] };
const spec = (count: number): string => Array.from({ length: count }, (_, i) => `it('case ${i}', () => {});`).join('\n');

describe('coverage report per kind of test', () => {
  it('PIP-016 counts it, test and desktopTest calls', () => {
    expect(countTests("it('a', () => {}); test('b', async () => {}); desktopTest('c', async () => {}); describe('d', () => {});")).toBe(3);
    const modifiers = ['skip', 'fixme'].map((word, i) => `${i === 0 ? 'it' : 'test'}.${word}('x', () => {});`).join(' ');
    expect(countTests(modifiers)).toBe(2);
  });

  it('PIP-016 sorts spec files into the five kinds', () => {
    const files = {
      'src/app/core/a.spec.ts': spec(2),
      'src/testing/b.spec.ts': spec(1),
      'src/app/state/c.spec.ts': spec(3),
      'src/app/app.spec.ts': spec(1),
      'e2e/d.spec.ts': spec(4),
      'e2e/detection-corpus.spec.ts': spec(1),
      'e2e/perf/e.spec.ts': spec(2),
    };
    const counts = Object.fromEntries(countByKind(files, kinds).map((row) => [row.id, row.tests]));
    expect(counts).toEqual({ unit: 3, integration: 4, e2e: 4, 'real-pdf-detection': 1, performance: 2 });
  });

  it('PIP-016 the table gives Vitest coverage to unit and integration and says "no coverage source" for the rest', () => {
    const rows = countByKind({ 'src/app/core/a.spec.ts': spec(2), 'e2e/d.spec.ts': spec(1) }, kinds);
    const table = renderTable(rows, { lines: { pct: 91.234 }, branches: { pct: 80 } });
    expect(table).toContain('| unit | 2 | lines 91.2 %, branches 80.0 % (Vitest, unit and integration together) |');
    expect(table).toContain('| E2E | 1 | no coverage source: number of tests only |');
    expect(renderTable(rows, null)).toContain('no coverage run: tests counted only');
  });

  it('PIP-017 a very low coverage still renders and no coverage threshold is configured', () => {
    const rows = countByKind({ 'src/app/core/a.spec.ts': spec(1) }, kinds);
    expect(() => renderTable(rows, { lines: { pct: 0.1 }, branches: { pct: 0 } })).not.toThrow();
    expect(readFileSync('angular.json', 'utf8')).not.toMatch(/coverageThresholds|"thresholds"/);
    expect(readFileSync('package.json', 'utf8')).not.toMatch(/--coverage-threshold|coverageThreshold/);
  });
});
