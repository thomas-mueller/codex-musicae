import { computed, inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { selectLanguage } from '../core';
import { SYSTEM_LANGUAGES } from '../ports/system-languages';
import { SettingsRegistry } from './settings-registry';

type Language = (typeof TUNABLES.i18n.languages)[number];

/**
 * The language setting (General group): "System language" or one of the app's languages. Created at the app start, so
 * the setting is registered before the settings are shown or reset. I18-004, UIX-023
 */
@Injectable({ providedIn: 'root' })
export class LanguageStore {
  private readonly systemLanguages = inject(SYSTEM_LANGUAGES);
  private readonly setting = inject(SettingsRegistry).register({
    id: 'language',
    group: 'general',
    labelKey: 'settings.language.label',
    persist: true,
    type: 'choice',
    defaultValue: TUNABLES.i18n.systemChoice,
    options: [
      { value: TUNABLES.i18n.systemChoice, labelKey: 'settings.language.system' },
      ...TUNABLES.i18n.languages.map((language) => ({ value: language, labelKey: `settings.language.names.${language}` })),
    ],
  });

  /** The language the app is shown in. */
  readonly active = computed<Language>(() => {
    const chosen = TUNABLES.i18n.languages.find((language) => language === this.setting.value());
    // read once per computation: a change of the system language applies at the next start
    return chosen ?? selectLanguage<Language>(this.systemLanguages(), TUNABLES.i18n.languages, TUNABLES.i18n.fallback);
  });
}
