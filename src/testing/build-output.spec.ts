import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LONG_LINE = 'a'.repeat(2000);
const minified = (display: string): string => `import{a as b}from"./x.js";var v="${display}";${LONG_LINE}\n`;
const unminified = (display: string): string => Array.from({ length: 400 }, (_, i) => `const value${i} = "${i === 0 ? display : 'x'}";`).join('\n');

let dir = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cm-build-'));
  mkdirSync(join(dir, 'build'));
  writeFileSync(join(dir, 'version.generated.ts'), 'export const APP_VERSION_DISPLAY = "v1.5.0";\nexport const APP_VERSION_FULL = "v1.5.0-3-gabc1234";\n');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function check() {
  return spawnSync(process.execPath, ['scripts/check-versions.mjs', '--built', join(dir, 'build'), join(dir, 'version.generated.ts')], { encoding: 'utf8' });
}
const bundle = (text: string): void => writeFileSync(join(dir, 'build', 'main-ABC123.js'), text);

describe('production build output', () => {
  it('NFR-019 a minified build without source maps passes', () => {
    bundle(minified('v1.5.0'));
    const result = check();
    expect(result.status, result.stderr).toBe(0);
  });

  it('NFR-019 a source map in the build fails', () => {
    bundle(minified('v1.5.0'));
    writeFileSync(join(dir, 'build', 'main-ABC123.js.map'), '{}');
    const result = check();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('source maps');
  });

  it('NFR-019 an unminified bundle fails', () => {
    bundle(unminified('v1.5.0'));
    const result = check();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('not minified');
  });

  it('PIP-018 a bundle without the display version fails', () => {
    bundle(minified('v9.9.9'));
    const result = check();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('display version');
  });
});
