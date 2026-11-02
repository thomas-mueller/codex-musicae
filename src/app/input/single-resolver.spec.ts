import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = 'src/app';
const RESOLVER = 'src/app/input/pointer-input.ts';
/** Hover and long-press tooltips only; they decide nothing about navigation. */
const POINTER_TYPE_ALLOWED = [RESOLVER, 'src/app/features/shell/tooltip.directive.ts'];

function productionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'testing' || entry.name === 'core' ? [] : productionFiles(path);
    }
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('single resolver', () => {
  const files = productionFiles(APP).map((path) => ({ path, text: readFileSync(path, 'utf8') }));

  it('ARC-006 only the pointer input uses pointerPolicy', () => {
    expect(files.filter((f) => f.text.includes('pointerPolicy')).map((f) => f.path)).toEqual([RESOLVER]);
  });

  it('ARC-006 pointerType is inspected only by the resolver and the tooltip directive', () => {
    const users = files.filter((f) => /\bpointerType\b/.test(f.text)).map((f) => f.path);
    expect(users.filter((path) => !POINTER_TYPE_ALLOWED.includes(path))).toEqual([]);
  });
});
