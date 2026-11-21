import { checkLicenses, isAllowed } from '../../scripts/lib/license-check.mjs';
import { findUnused, parseExceptions } from '../../scripts/lib/unused-code.mjs';
import { findUnusedDependencies } from '../../scripts/lib/unused-dependencies.mjs';

const ALLOWED = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'Zlib'];

describe('license allow-list (PIP-015)', () => {
  it('PIP-015 accepts listed licenses and compound expressions whose sides are listed', () => {
    expect(isAllowed('MIT', ALLOWED)).toBe(true);
    expect(isAllowed('(MIT AND Zlib)', ALLOWED)).toBe(true);
    expect(isAllowed('MIT OR Apache-2.0', ALLOWED)).toBe(true);
  });

  it('PIP-015 an OR expression passes through its allowed side, an AND needs both', () => {
    expect(isAllowed('(MIT OR GPL-3.0-only)', ALLOWED)).toBe(true);
    expect(isAllowed('MIT AND GPL-3.0-only', ALLOWED)).toBe(false);
    expect(isAllowed('MIT AND CC-BY-4.0', ALLOWED)).toBe(false);
  });

  it('PIP-015 GPL, AGPL and LGPL never pass, even when someone adds them to the list', () => {
    for (const id of ['GPL-3.0', 'AGPL-3.0-only', 'LGPL-2.1-or-later', 'GPL-2.0 WITH Classpath-exception-2.0']) {
      expect(isAllowed(id, [...ALLOWED, id.split(' ')[0] ?? id])).toBe(false);
    }
  });

  it('PIP-015 a missing, empty or unlisted license fails and is named in the violations', () => {
    expect(isAllowed(undefined, ALLOWED)).toBe(false);
    expect(isAllowed('', ALLOWED)).toBe(false);
    const { rows, violations } = checkLicenses(
      [{ name: 'good', version: '1.0.0', license: 'MIT' }, { name: 'bad', version: '2.0.0', license: 'SSPL-1.0' }, { name: 'none', version: '3.0.0' }],
      ALLOWED,
    );
    expect(rows.map((row) => row.ok)).toEqual([true, false, false]);
    expect(violations).toHaveLength(2);
    expect(violations[0]).toContain('bad@2.0.0');
  });
});

describe('unused code (PIP-013)', () => {
  const sources = {
    'src/main.ts': "import { used } from './used'; import * as all from './all'; import('./lazy'); new Worker(new URL('./w.worker', import.meta.url)); export * from './barrel'; console.log(used, all);",
    'src/used.ts': 'export const used = 1; export const dead = 2;',
    'src/all.ts': 'export const a = 1; export const b = 2;',
    'src/lazy.ts': 'export const page = 1;',
    'src/w.worker.ts': 'export const work = 1;',
    'src/barrel.ts': 'export const fromBarrel = 1;',
    'src/orphan.ts': 'export const orphan = 1;',
  };
  const entries = ['src/main.ts'];

  it('PIP-013 reports an unused file and an unused export', () => {
    const lines = findUnused({ sources, entries });
    expect(lines).toContain('src/orphan.ts: file is not used');
    expect(lines).toContain('src/used.ts: export dead is not used');
    expect(lines).not.toContain('src/used.ts: export used is not used');
  });

  it('PIP-013 a namespace import, a dynamic import, a worker URL and export * count as use', () => {
    const lines = findUnused({ sources, entries });
    expect(lines.filter((line) => /all\.ts|lazy\.ts|w\.worker\.ts|barrel\.ts/.test(line))).toEqual([]);
  });

  it('PIP-013 a spec entry makes an export used, a re-export passes the use on', () => {
    const lines = findUnused({
      sources: { ...sources, 'src/x.spec.ts': "import { orphan } from './orphan'; import { dead } from './used'; console.log(orphan, dead);" },
      entries: [...entries, 'src/x.spec.ts'],
    });
    expect(lines).toEqual([]);
    const reexport = findUnused({
      sources: { 'src/main.ts': "import { b } from './index'; console.log(b);", 'src/index.ts': "export { a as b, c } from './impl';", 'src/impl.ts': 'export const a = 1; export const c = 2;' },
      entries,
    });
    expect(reexport).toEqual(['src/impl.ts: export c is not used', 'src/index.ts: export c is not used']);
  });

  it('PIP-013 an exception hides its finding and a stale exception is reported', () => {
    const lines = findUnused({ sources, entries, exceptions: new Set(['src/orphan.ts', 'src/used.ts#dead', 'src/all.ts#a']) });
    expect(lines).toEqual(['src/all.ts#a: exception is stale, the finding is gone']);
  });

  it('PIP-013 the exceptions file format yields key and reason', () => {
    const map = parseExceptions('# title\n\n- **src/a.ts#x** kept for M5\n- **left-pad** implicit\n');
    expect([...map]).toEqual([['src/a.ts#x', 'kept for M5'], ['left-pad', 'implicit']]);
  });
});

describe('unused dependencies (PIP-014)', () => {
  const declared = ['alpha', '@scope/beta', 'gamma', 'delta', 'typescript'];

  it('PIP-014 reports a dependency that nothing names', () => {
    const lines = findUnusedDependencies({ declared, specifiers: ['alpha', '@scope/beta/sub'], configText: '"builder": "gamma:build"', exceptions: new Set() });
    expect(lines).toEqual(['delta: dependency is not used (PIP-014)', 'typescript: dependency is not used (PIP-014)']);
  });

  it('PIP-014 a subpath import and a name in a configuration file count as use, a longer name does not', () => {
    const lines = findUnusedDependencies({ declared: ['typescript'], specifiers: [], configText: 'typescript-eslint', exceptions: new Set() });
    expect(lines).toHaveLength(1);
    expect(findUnusedDependencies({ declared: ['alpha'], specifiers: ['alpha/deep/file'], configText: '', exceptions: new Set() })).toEqual([]);
  });

  it('PIP-014 an exception hides a dependency, a stale or unknown exception is reported', () => {
    expect(findUnusedDependencies({ declared: ['delta'], specifiers: [], configText: '', exceptions: new Set(['delta']) })).toEqual([]);
    expect(findUnusedDependencies({ declared: ['alpha'], specifiers: ['alpha'], configText: '', exceptions: new Set(['alpha', 'gone']) })).toEqual([
      'alpha: exception is stale, the package is now found in use',
      'gone: exception names a package that is not declared',
    ]);
  });
});
