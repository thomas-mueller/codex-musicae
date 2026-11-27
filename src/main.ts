import { bootstrapApplication } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { preloadLanguages } from './app/adapters/web/ui-language';
import { TUNABLES } from './config/tunables';

bootstrapApplication(App, appConfig)
  // I18-004: here and not in appConfig, because the requests need the running web app (and its injector for good)
  .then((app) => preloadLanguages(app.injector.get(TranslocoService), TUNABLES.i18n.languages))
  .catch((err) => console.error(err));
