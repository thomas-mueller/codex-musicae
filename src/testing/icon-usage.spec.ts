import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TUNABLES } from '../config/tunables';

/** Every template and component source of the app, without specs. */
function sources(directory = 'src/app'): { path: string; text: string }[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sources(path);
    }
    return /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [{ path, text: readFileSync(path, 'utf8') }] : [];
  });
}

const quoted = (text: string): string[] => [...text.matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1] ?? '');

/** How the app writes an icon key. Each pattern must find something (the control below). */
const ICON_PATTERNS: Readonly<Record<string, (text: string) => string[]>> = {
  'icon="key" on a button': (text) => [...text.matchAll(/\sicon="([A-Za-z]+)"/g)].map((m) => m[1] ?? ''),
  '<app-icon name="key">': (text) => [...text.matchAll(/<app-icon\b[^>]*?\sname="([A-Za-z]+)"/g)].map((m) => m[1] ?? ''),
  "icon: 'key' in an entry": (text) => [...text.matchAll(/\bicon: '([A-Za-z]+)'/g)].map((m) => m[1] ?? ''),
  // both results of `[name]="x === 'break' ? 'slideBreak' : 'stop'"`; the compared value is not an icon
  'a conditional [name] or [icon]': (text) =>
    [...text.matchAll(/\[(?:name|icon)\]="[^"]*\?([^"]*:[^"]*)"/g)].flatMap((m) => quoted(m[1] ?? '')),
};

/** How the app writes the translation key of an icon-only control. */
const LABEL_PATTERNS: Readonly<Record<string, (text: string) => string[]>> = {
  'labelKey="key"': (text) => [...text.matchAll(/\slabelKey="([A-Za-z]+)"/g)].map((m) => m[1] ?? ''),
  "labelKey: 'key'": (text) => [...text.matchAll(/\blabelKey: '([A-Za-z]+)'/g)].map((m) => m[1] ?? ''),
};

const files = sources();
const found = (patterns: Readonly<Record<string, (text: string) => string[]>>) =>
  Object.entries(patterns).map(([name, find]) => ({ name, uses: files.flatMap((file) => find(file.text).map((key) => ({ key, path: file.path }))) }));

describe('icon usage', () => {
  const sprite = readFileSync('src/assets/icons/sprite.svg', 'utf8');

  it('UIX-029 the sprite holds exactly the icons of T:icons, none missing and none left over', () => {
    const symbols = [...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]);
    expect(symbols.sort()).toEqual([...new Set<string>(Object.values(TUNABLES.icons))].sort());
  });

  it('UIX-029 control: every way of writing an icon or label key is still found in the sources', () => {
    for (const { name, uses } of [...found(ICON_PATTERNS), ...found(LABEL_PATTERNS)]) {
      expect(uses.length, name).toBeGreaterThan(0);
    }
  });

  it('UIX-029 every icon the app names is a key of T:icons', () => {
    const unknown = found(ICON_PATTERNS)
      .flatMap(({ uses }) => uses)
      .filter(({ key }) => !(key in TUNABLES.icons));
    expect(unknown).toEqual([]);
  });

  it('UIX-029 only app-icon draws an icon: no other component has its own <svg>', () => {
    const drawing = files.filter((file) => /<svg[\s>]/.test(file.text)).map((file) => file.path);
    expect(drawing).toEqual(['src/app/features/shell/icon.ts']);
  });

  it('UIX-029 GEN-010 every label key of an icon control has a name and a tooltip in all seven languages', () => {
    const keys = [...new Set([...found(LABEL_PATTERNS).flatMap(({ uses }) => uses.map((use) => use.key)), ...Object.keys(TUNABLES.icons)])];
    for (const language of TUNABLES.i18n.languages) {
      const texts = JSON.parse(readFileSync(`src/assets/i18n/${language}.json`, 'utf8')) as Record<'a11y' | 'tooltip', Record<string, string>>;
      expect(keys.filter((key) => !texts.a11y[key]?.trim() || !texts.tooltip[key]?.trim()), language).toEqual([]);
    }
  });
});
