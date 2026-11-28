import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TUNABLES } from '../config/tunables';

function styledSources(directory = 'src/app'): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return styledSources(path);
    }
    return /\.(ts|css|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

/** Every font a style sets, as "file: value". `font: inherit` takes the font of the parent. */
function fontsSet(paths: readonly string[]): string[] {
  return paths.flatMap((path) =>
    [...readFileSync(path, 'utf8').matchAll(/(?:^|[;{\s])(?:font-family|font):\s*([^;}\n]+)/g)].map((match) => `${path}: ${match[1]?.trim()}`),
  );
}

describe('font', () => {
  const fonts = fontsSet([...styledSources(), 'src/styles.css']);

  it('UIX-038 the app font is a sans-serif stack of device fonts and the page uses it', () => {
    expect(TUNABLES.typography.fontFamily.startsWith('system-ui, ')).toBe(true);
    expect(TUNABLES.typography.fontFamily.endsWith(', sans-serif')).toBe(true);
    expect(fonts).toContain('src/styles.css: var(--cm-font)');
  });

  it('UIX-038 no style sets another font and no font file is loaded', () => {
    expect(fonts.filter((entry) => !/: (var\(--cm-font\)|inherit)$/.test(entry))).toEqual([]);
    expect(readFileSync('src/styles.css', 'utf8')).not.toContain('@font-face');
  });
});
