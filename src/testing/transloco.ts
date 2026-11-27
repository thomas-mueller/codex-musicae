import { readFileSync } from 'node:fs';
import { Injectable } from '@angular/core';
import { provideTransloco, TranslocoLoader, Translation } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';

import { TUNABLES } from '../config/tunables';

const english = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as Translation;

@Injectable()
class EnglishLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of(english);
  }
}

/** Real en.json for component tests. */
export function provideTestTransloco() {
  return provideTransloco({
    config: { availableLangs: ['en'], defaultLang: 'en', reRenderOnLangChange: false },
    loader: EnglishLoader,
  });
}

export function translate(key: string): string {
  return key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], english) as string;
}

@Injectable()
class FileLoader implements TranslocoLoader {
  getTranslation(language: string): Observable<Translation> {
    return of(JSON.parse(readFileSync(`src/assets/i18n/${language}.json`, 'utf8')) as Translation);
  }
}

/** Every real translation file, configured like the app: for specs that change the language (I18-004). */
export function provideTestLanguages() {
  return provideTransloco({
    config: { availableLangs: [...TUNABLES.i18n.languages], defaultLang: TUNABLES.i18n.fallback, reRenderOnLangChange: true },
    loader: FileLoader,
  });
}
