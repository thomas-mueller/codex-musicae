import { readFileSync } from 'node:fs';
import { Injectable } from '@angular/core';
import { provideTransloco, TranslocoLoader, Translation } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';

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
