import type { TranslocoService } from '@jsverse/transloco';

/** Shows the app in `language` and tells the page which language it is in. I18-004 */
export function showLanguage(translation: TranslocoService, document: Document, language: string): void {
  translation.setActiveLang(language);
  document.documentElement.lang = language;
}

/**
 * Loads every translation file at the app start, so a change of the language needs no request. On a first visit the
 * installing service worker holds later requests for seconds (as with the icon sprite). A file that fails to load is
 * asked for again when its language is chosen. I18-004
 */
export function preloadLanguages(translation: TranslocoService, languages: readonly string[]): void {
  for (const language of languages) {
    translation.load(language).subscribe({ error: () => undefined });
  }
}
