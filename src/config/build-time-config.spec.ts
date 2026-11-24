import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Relative to the repository root (the working directory of `ng test`), like features.spec.ts.
const RUNTIME_LOAD = /(fetch\(|HttpClient|import\(|XMLHttpRequest)[^;\n]*config\//;

interface AngularBuild {
  options: { assets?: unknown };
  configurations: Record<string, { fileReplacements?: unknown; assets?: unknown }>;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(name) && !/\.spec\.ts$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles('src').map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const angular = JSON.parse(readFileSync('angular.json', 'utf8'));
const project = Object.values(angular.projects)[0] as { architect: { build: AngularBuild } };
const build = project.architect.build;

describe('build-time configuration', () => {
  it('ARC-009 no source file loads tunables or the feature configuration at runtime', () => {
    const loaders = files.filter((file) => RUNTIME_LOAD.test(file.text)).map((file) => file.path);
    expect(loaders).toEqual([]);
  });

  it('ARC-009 the feature files are imported statically and only by the composition root', () => {
    const importers = files
      .filter((file) => /^\s*import\s[^;]*['"][^'"]*config\/features\.(web|native)['"]/m.test(file.text))
      .map((file) => file.path.replace(/\\/g, '/'));
    expect(importers.every((path) => ['src/app/app.config.ts', 'src/main.ts'].includes(path))).toBe(true);
    expect(importers).toContain('src/app/app.config.ts');
  });

  it('ARC-009 the native builds swap the feature file at build time and nothing copies src/config as an asset', () => {
    for (const name of ['native-free', 'native-paid']) {
      expect(build.configurations[name]?.fileReplacements).toEqual([
        { replace: 'src/config/features.web.ts', with: 'src/config/features.native.ts' },
      ]);
    }
    expect(build.configurations['web']?.fileReplacements).toBeUndefined();
    const assets = JSON.stringify([build.options.assets, ...Object.values(build.configurations).map((c) => c.assets)]);
    expect(assets).not.toMatch(/src\/config|"config"/);
  });
});
