import { describe, expect, it } from 'vitest';

import { selectLanguage } from './language';

const available = ['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'nl'] as const;

describe('selectLanguage', () => {
  const cases: readonly [string, readonly string[], (typeof available)[number]][] = [
    ['an exact match', ['de'], 'de'],
    ['a region of an available language', ['de-AT'], 'de'],
    ['a region of English', ['en-GB', 'de'], 'en'],
    ['another case', ['PT-br'], 'pt-BR'],
    ['Portuguese without a region', ['pt'], 'pt-BR'],
    ['Portuguese of Portugal', ['pt-PT'], 'pt-BR'],
    ['the first preference that is available', ['sv-SE', 'nl-BE', 'de'], 'nl'],
    ['no available preference', ['sv-SE', 'ja'], 'en'],
    ['an empty list', [], 'en'],
    ['an empty tag', [''], 'en'],
  ];
  for (const [name, preferred, expected] of cases) {
    it(`I18-004 ${name}: ${preferred.join(', ') || '(none)'} -> ${expected}`, () => {
      expect(selectLanguage(preferred, available, 'en')).toBe(expected);
    });
  }
});
