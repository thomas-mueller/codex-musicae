import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { TestBed } from '@angular/core/testing';

import { APP_VERSION_DISPLAY, APP_VERSION_FULL as GENERATED_FULL } from '../config/version.generated';
import { appConfig } from '../app/app.config';
import { SettingsView } from '../app/features/settings/settings-view';
import { APP_VERSION, APP_VERSION_FULL } from '../app/ports/app-version';
import { displayVersion } from '../../scripts/lib/version.mjs';
import { provideTestPorts } from './provide-test-ports';
import { provideTestTransloco } from './transloco';

const DISPLAY = 'v1.5.0';
const FULL = 'v1.5.0-3-gabc1234-dirty';

describe('version wiring (PIP-018)', () => {
  it('PIP-018 the app provides the display version to users and the full describe string to internal places', () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    expect(TestBed.inject(APP_VERSION)).toBe(APP_VERSION_DISPLAY);
    expect(TestBed.inject(APP_VERSION)).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(TestBed.inject(APP_VERSION_FULL)).toBe(GENERATED_FULL);
    expect(APP_VERSION_DISPLAY).toBe(displayVersion(GENERATED_FULL));
  });

  it('PIP-018 the full version falls back to the display version when only that is provided', () => {
    TestBed.configureTestingModule({ providers: [{ provide: APP_VERSION, useValue: DISPLAY }] });
    expect(TestBed.inject(APP_VERSION_FULL)).toBe(DISPLAY);
  });

  it('PIP-018 UIX-035 the settings view shows vX.Y.Z only, never the describe suffix', async () => {
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: DISPLAY }, { provide: APP_VERSION_FULL, useValue: FULL }],
    });
    const fixture = TestBed.createComponent(SettingsView);
    await fixture.whenStable();
    const shown = (fixture.nativeElement as HTMLElement).querySelector('.version')?.textContent;
    expect(shown).toBe(DISPLAY);
    expect(shown).not.toContain('-g');
  });

  it('PIP-018 only the saved-file metadata reads the full version; no template shows it', () => {
    expect(readFileSync('src/app/state/session.store.ts', 'utf8')).toContain('inject(APP_VERSION_FULL)');
    expect(readFileSync('src/app/features/settings/settings-view.ts', 'utf8')).not.toContain('APP_VERSION_FULL');
  });

  it('PIP-018 the version script writes a display value that matches its describe string', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-version-'));
    try {
      const out = join(dir, 'version.generated.ts');
      const result = spawnSync(process.execPath, ['scripts/generate-version.mjs', out], { encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
      const text = readFileSync(out, 'utf8');
      const display = /APP_VERSION_DISPLAY = "([^"]*)"/.exec(text)?.[1];
      const full = /APP_VERSION_FULL = "([^"]*)"/.exec(text)?.[1];
      expect(display).toMatch(/^v\d+\.\d+\.\d+$/);
      expect(display).toBe(displayVersion(full ?? ''));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
