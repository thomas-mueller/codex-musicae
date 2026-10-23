import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';
import { provideRouter } from '@angular/router';

import { provideAppIdentity } from './adapters/web/app-identity';
import { AppTranslocoLoader } from './adapters/web/transloco-loader';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    ...provideTransloco({
      config: {
        availableLangs: ['en'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: false,
      },
      loader: AppTranslocoLoader,
    }),
    provideAppIdentity(),
    provideRouter(routes),
  ]
};
