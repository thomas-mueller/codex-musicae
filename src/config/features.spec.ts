import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FEATURES as WEB } from './features.web';
import { FEATURES as NATIVE } from './features.native';
import { resolveFeatures } from './edition';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_ONLY_KEYS = ['webOrganizational'];
const SCRIPT = 'scripts/check-features.mjs';

/** Runs scripts/check-features.mjs on the given file contents; returns its exit code. */
function runCheck(webText: string, nativeText: string): number {
  const dir = mkdtempSync(join(tmpdir(), 'cm-features-'));
  writeFileSync(join(dir, 'web.ts'), webText);
  writeFileSync(join(dir, 'native.ts'), nativeText);
  return spawnSync(process.execPath, [SCRIPT, join(dir, 'web.ts'), join(dir, 'native.ts')]).status ?? 1;
}

// Relative to the repository root (the working directory of `ng test`, like the script path below): import.meta.url is not a file URL under coverage.
const read = (name: string) => readFileSync(`src/config/${name}`, 'utf8');
const webText = read('features.web.ts');
const nativeText = read('features.native.ts');

describe('feature configuration files', () => {
  it('EDN-006 every shared switch is a boolean in both files', () => {
    const shared = Object.keys(WEB).filter((key) => !WEB_ONLY_KEYS.includes(key));
    expect(Object.keys(NATIVE).sort()).toEqual([...shared].sort());
    for (const key of shared) {
      expect(typeof (WEB as Record<string, unknown>)[key]).toBe('boolean');
      expect(typeof (NATIVE as Record<string, unknown>)[key]).toBe('boolean');
    }
  });

  it('EDN-017 the shared switches are those for saving and for keeping data between app starts, and no others', () => {
    expect(Object.keys(NATIVE).sort()).toEqual(
      ['autosave', 'saveCopy', 'sendTo', 'recentFiles', 'sessionRestore', 'persistSettings', 'persistFileChoices', 'restoreZoom'].sort(),
    );
  });

  it('EDN-009 the web-only switch exists in the web file only', () => {
    expect(Object.keys(WEB)).toContain('webOrganizational');
    expect(Object.keys(NATIVE)).not.toContain('webOrganizational');
  });

  it('EDN-006 the files import nothing', () => {
    expect(webText).not.toMatch(/^import /m);
    expect(nativeText).not.toMatch(/^import /m);
  });

  it('EDN-013 the real files pass the completeness check', () => {
    expect(runCheck(webText, nativeText)).toBe(0);
  });

  it('EDN-013 a missing shared key, a web-only key in the native file and a missing comment are reported', () => {
    expect(runCheck(webText, nativeText.replace(/^ {2}autosave:.*\n/m, ''))).not.toBe(0);
    expect(runCheck(webText, nativeText.replace(/^ {2}autosave:/m, '  webOrganizational: false, // x\n  autosave:'))).not.toBe(0);
    expect(runCheck(webText, nativeText.replace(/^ {2}autosave:.*$/m, '  autosave: false,'))).not.toBe(0);
    expect(runCheck(webText, nativeText.replace('autosave: false', 'autosave: 1'))).not.toBe(0);
  });

  it('EDN-006 the free configurations switch every persistence and save switch off', () => {
    expect(Object.values(resolveFeatures(WEB, 'free')).every((value) => value === false)).toBe(true);
    expect(Object.values(resolveFeatures(NATIVE, 'free')).every((value) => value === false)).toBe(true);
  });
});
