/** Port SystemLanguages (I18-004): the language tags the user's system prefers, most wanted first. */
import { InjectionToken } from '@angular/core';

export type SystemLanguages = () => readonly string[];

/** Without a platform the system tells nothing, so the fallback language is shown. */
export const SYSTEM_LANGUAGES = new InjectionToken<SystemLanguages>('SystemLanguages', {
  providedIn: 'root',
  factory: () => () => [],
});
