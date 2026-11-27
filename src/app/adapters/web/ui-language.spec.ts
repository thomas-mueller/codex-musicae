import type { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';

import { preloadLanguages, showLanguage } from './ui-language';
import { webSystemLanguages } from './web-system-languages';

describe('the web language adapters', () => {
  afterEach(() => vi.restoreAllMocks());

  it('I18-004 shows a language: Transloco switches to it and the page declares it', () => {
    const translation = { setActiveLang: vi.fn() };
    showLanguage(translation as unknown as TranslocoService, document, 'de');
    expect(translation.setActiveLang).toHaveBeenCalledWith('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('I18-004 loads every language at the start; one that fails does not stop the others', () => {
    const load = vi.fn((language: string) => (language === 'de' ? throwError(() => new Error('offline')) : of({})));
    expect(() => preloadLanguages({ load } as unknown as TranslocoService, ['en', 'de', 'fr'])).not.toThrow();
    expect(load.mock.calls.map(([language]) => language)).toEqual(['en', 'de', 'fr']);
  });

  it('I18-004 reads the preferred languages of the browser in their order', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-AT', 'en']);
    expect(webSystemLanguages()).toEqual(['de-AT', 'en']);
  });
});
