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
import { OpenCvDetectionEngine } from './adapters/opencv/opencv-detection-engine';
import { PdfJsRenderer } from './adapters/pdfjs/pdfjs-renderer';
import { installDebugHook } from './adapters/web/debug-hook';
import type { DebugHost } from './adapters/web/debug-hook';
import { BitmapCache } from './state/bitmap-cache';
import { WebDeviceInfo } from './adapters/web/web-device-info';
import { WebFileAccess } from './adapters/web/web-file-access';
import { WebPreferences } from './adapters/web/web-preferences';
import { DETECTION_ENGINE } from './ports/detection-engine';
import { DEVICE_INFO } from './ports/device-info';
import { FILE_ACCESS } from './ports/file-access';
import { PDF_RENDERER } from './ports/pdf-renderer';
import { PREFERENCES } from './ports/preferences';
import { routes } from './app.routes';

declare const ngDevMode: boolean | object | undefined;

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
    // Development builds only (ngDevMode): the production bundle carries no debug hook.
    provideEnvironmentInitializer(() => {
      // `ngDevMode` is replaced by `false` in production builds, so this branch and the hook module are removed.
      if (typeof ngDevMode !== 'undefined' && ngDevMode) {
        const renderer = inject(PDF_RENDERER);
        const engine = inject(DETECTION_ENGINE);
        installDebugHook(window as DebugHost, inject(BitmapCache), async (pdf, pageIndex, scale) => {
          const signal = new AbortController().signal;
          const doc = await renderer.open(pdf);
          if (!doc.ok) throw new Error(doc.error);
          try {
            const info = await doc.value.getPageInfo(pageIndex);
            if (!info.ok) throw new Error(info.error);
            const region = { x: 0, y: 0, width: info.value.width, height: info.value.height };
            const bitmap = await doc.value.renderRegion({ pageIndex, region, scale }, signal);
            if (!bitmap.ok) throw new Error(bitmap.error);
            const rects = await engine.extractComponents(bitmap.value, signal);
            if (!rects.ok) throw new Error(rects.error);
            return rects.value;
          } finally {
            await doc.value.destroy();
          }
        });
      }
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
    { provide: DETECTION_ENGINE, useFactory: () => new OpenCvDetectionEngine() },
    { provide: PREFERENCES, useFactory: () => new WebPreferences() },
    { provide: DEVICE_INFO, useFactory: () => new WebDeviceInfo() },
    { provide: FILE_ACCESS, useFactory: () => new WebFileAccess() },
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
