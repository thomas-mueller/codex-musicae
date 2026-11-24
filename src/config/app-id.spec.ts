import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appIdFor, editionOf } from './app-id';
import { TUNABLES } from './tunables';

const APP_ID = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

describe('application IDs', () => {
  it('GEN-011 the free and the paid app have distinct, valid IDs and the paid app keeps the ID of V1', () => {
    expect(TUNABLES.identity.appId).not.toBe(TUNABLES.identity.appIdPaid);
    expect(TUNABLES.identity.appId).toMatch(APP_ID);
    expect(TUNABLES.identity.appIdPaid).toMatch(APP_ID);
    expect(TUNABLES.identity.appIdPaid).toBe('app.web.codexmusicae');
  });

  it('GEN-011 the edition picks its ID and anything but paid is the free app', () => {
    expect(appIdFor('free')).toBe(TUNABLES.identity.appId);
    expect(appIdFor('paid')).toBe(TUNABLES.identity.appIdPaid);
    expect(editionOf('paid')).toBe('paid');
    expect(editionOf('free')).toBe('free');
    expect(editionOf(undefined)).toBe('free');
    expect(editionOf('anything')).toBe('free');
  });

  it.each([
    ['free', TUNABLES.identity.appId],
    ['paid', TUNABLES.identity.appIdPaid],
  ] as const)('GEN-011 EDN-010 apply-edition writes the %s ID for Gradle and Xcode', (edition, id) => {
    const out = mkdtempSync(join(tmpdir(), 'cm-edition-'));
    const result = spawnSync(process.execPath, ['scripts/apply-edition.mjs', edition, out]);
    expect(result.status).toBe(0);
    expect(readFileSync(join(out, 'android/edition.properties'), 'utf8')).toContain(`appId=${id}\n`);
    expect(readFileSync(join(out, 'ios/edition.xcconfig'), 'utf8')).toContain(`APP_BUNDLE_ID = ${id}\n`);
  });

  it('EDN-010 the repository passes the edition consistency check', () => {
    expect(spawnSync(process.execPath, ['scripts/check-editions.mjs']).status).toBe(0);
  });

  it('GEN-012 the repository has no analytics or crash-reporting dependency', () => {
    expect(spawnSync(process.execPath, ['scripts/check-static-compliance.mjs']).status).toBe(0);
  });
});
