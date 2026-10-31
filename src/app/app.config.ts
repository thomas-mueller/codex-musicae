import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
  inject,
  isDevMode,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { provideTransloco } from '@jsverse/transloco';
import { provideRouter } from '@angular/router';
import { TUNABLES } from '../config/tunables';
import { tunablesToCssVars } from './state/css-vars';
import { APP_VERSION_RAW } from '../config/version.generated';
import { APP_VERSION } from './ports/app-version';

import { provideAppIdentity } from './adapters/web/app-identity';
import { AppTranslocoLoader } from './adapters/web/transloco-loader';
import { PwaUpdatePolicy } from './adapters/web/pwa-update-policy';
import { PdfJsRenderer } from './adapters/pdfjs/pdfjs-renderer';
import { PDF_RENDERER } from './ports/pdf-renderer';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    { provide: APP_VERSION, useValue: APP_VERSION_RAW },
    provideServiceWorker('ngsw-worker.js', {
      enabled: shouldRegisterServiceWorker(isDevMode(), Capacitor),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideEnvironmentInitializer(() => applyTunablesToCss(document.documentElement)),
    provideEnvironmentInitializer(() => {
      void inject(PwaUpdatePolicy).checkAtStartup();
    }),
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
    { provide: PDF_RENDERER, useFactory: () => new PdfJsRenderer() },
    provideRouter(routes),
  ]
};

export interface CapacitorPlatform {
  isNativePlatform(): boolean;
}

export function shouldRegisterServiceWorker(
  developmentBuild: boolean,
  capacitor: CapacitorPlatform,
): boolean {
  return !developmentBuild && !capacitor.isNativePlatform();
}

export function applyTunablesToCss(root: HTMLElement): void {
  for (const [name, value] of Object.entries(tunablesToCssVars(TUNABLES))) {
    root.style.setProperty(name, value);
  }
}
