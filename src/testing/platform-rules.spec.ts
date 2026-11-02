import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Static checks of rules that are about what the sources contain (M1, M7, M10). */
const APP = 'src/app';

function files(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'testing' ? [] : files(path, extensions);
    }
    return extensions.some((e) => path.endsWith(e)) && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

const read = (path: string): string => readFileSync(path, 'utf8');

describe('platform and architecture rules', () => {
  it('GEN-007 there is a single light theme: no dark-mode media query anywhere', () => {
    const sources = [...files(APP, ['.css', '.html', '.ts']), 'src/styles.css', 'src/index.template.html'];
    expect(sources.filter((path) => /prefers-color-scheme/.test(read(path)))).toEqual([]);
  });

  it('UIX-017 the viewport covers the notch and every bar side respects its safe-area inset', () => {
    expect(read('src/index.template.html')).toContain('viewport-fit=cover');
    const css = [...files(APP, ['.css']), 'src/styles.css'].map(read).join('\n');
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(css, `env(safe-area-inset-${side})`).toContain(`env(safe-area-inset-${side})`);
    }
  });

  it('UIX-017 the orientation follows the OS: neither the web manifest nor the Android manifest locks it', () => {
    expect(read('scripts/generate-index-metadata.mjs')).not.toMatch(/orientation/i);
    expect(read('android/app/src/main/AndroidManifest.xml')).not.toContain('screenOrientation');
    expect(read('capacitor.config.ts')).not.toMatch(/orientation/i);
  });

  it('ARC-003 components are standalone, OnPush, signal based and zoneless under strict TypeScript', () => {
    const components = files(APP, ['.ts']).filter((path) => read(path).includes('@Component('));
    expect(components.length).toBeGreaterThan(0);
    expect(components.filter((path) => !read(path).includes('ChangeDetectionStrategy.OnPush'))).toEqual([]);
    expect(components.filter((path) => /standalone:\s*false/.test(read(path)))).toEqual([]);
    expect(files(APP, ['.ts']).filter((path) => read(path).includes('@NgModule('))).toEqual([]);
    expect(read(join(APP, 'app.config.ts'))).toContain('provideZonelessChangeDetection()');
    expect(read('angular.json')).not.toContain('zone.js');
    expect(read('tsconfig.json')).toMatch(/"strict":\s*true/);
  });

  it('DET-022 detection results live in runtime memory only: no persistence port or storage in the detection sources', () => {
    const detection = files(join(APP, 'state'), ['.ts']).filter((path) => /detection[^/]*\.ts$/.test(path));
    expect(detection.length).toBeGreaterThan(0);
    for (const path of detection) {
      const text = read(path);
      expect(text, path).not.toMatch(/ports\/(preferences|file-access|pdf-writer)/);
      expect(text, path).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    }
  });
});
