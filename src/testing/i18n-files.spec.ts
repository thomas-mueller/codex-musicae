import { readdirSync, readFileSync } from 'node:fs';

import { TUNABLES } from '../config/tunables';

const DIRECTORY = 'src/assets/i18n';

/** `{"a": {"b": "x"}}` as `{"a.b": "x"}`. */
function flatten(value: object, prefix = ''): Map<string, string> {
  const entries = Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null ? [...flatten(child, `${prefix}${key}.`)] : [[prefix + key, child as string] as [string, string]],
  );
  return new Map(entries);
}

const load = (language: string) => flatten(JSON.parse(readFileSync(`${DIRECTORY}/${language}.json`, 'utf8')) as object);

/** The backquoted first word of each list entry under a heading of docs/i18n-status.md. */
function statusList(heading: string): string[] {
  const text = readFileSync('docs/i18n-status.md', 'utf8');
  const section = text.split(`\n## ${heading}\n`)[1]?.split('\n## ')[0] ?? '';
  return [...section.matchAll(/^- `([^`]+)`/gm)].map((match) => match[1] ?? '');
}

const matches = (pattern: string, key: string) => (pattern.endsWith('*') ? key.startsWith(pattern.slice(0, -1)) : key === pattern);

const english = load('en');
const copies = statusList('Copies of English');
const byDesign = statusList('Same as English by design');
const others = TUNABLES.i18n.languages.filter((language) => language !== 'en');
const translated = others.filter((language) => !copies.includes(language));

describe('translation files', () => {
  it('I18-003 there is one file for each of the seven languages and no other', () => {
    expect(TUNABLES.i18n.languages).toEqual(['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'nl']);
    expect(readdirSync(DIRECTORY).sort()).toEqual(TUNABLES.i18n.languages.map((language) => `${language}.json`).sort());
  });

  for (const language of others) {
    it(`I18-003 ${language} has every key of the English file and no other, and no value is empty where English has a text`, () => {
      const file = load(language);
      expect([...english.keys()].filter((key) => !file.has(key))).toEqual([]);
      expect([...file.keys()].filter((key) => !english.has(key))).toEqual([]);
      expect([...file].filter(([key, value]) => value.trim() === '' && english.get(key) !== '').map(([key]) => key)).toEqual([]);
    });
  }

  it('I18-003 every file listed as a copy of English exists and is one', () => {
    expect(copies.filter((language) => !others.includes(language as (typeof others)[number]))).toEqual([]);
    for (const language of copies) {
      expect(Object.fromEntries(load(language)), language).toEqual(Object.fromEntries(english));
    }
  });

  it('I18-003 German is translated: it is not listed as a copy', () => {
    expect(translated).toContain('de');
  });

  for (const language of translated) {
    it(`I18-003 ${language} repeats an English value only where docs/i18n-status.md says so`, () => {
      const unlisted = [...load(language)]
        .filter(([key, value]) => value === english.get(key) && !byDesign.some((pattern) => matches(pattern, key)))
        .map(([key]) => key);
      expect(unlisted).toEqual([]);
    });
  }

  it('I18-003 docs/i18n-status.md has no entry that no translated file needs', () => {
    const repeated = translated.flatMap((language) => [...load(language)].filter(([key, value]) => value === english.get(key)).map(([key]) => key));
    expect(byDesign.length).toBeGreaterThan(0);
    expect(byDesign.filter((pattern) => !repeated.some((key) => matches(pattern, key)))).toEqual([]);
  });
});
