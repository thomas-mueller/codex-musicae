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
import { SessionStore } from './state/session.store';
import { WebAppLifecycle } from './adapters/web/web-app-lifecycle';
import { WebDeviceInfo } from './adapters/web/web-device-info';
import { CapFileAccess } from './adapters/capacitor/cap-file-access';
import { CapOpenWith } from './adapters/capacitor/cap-open-with';
import { CapBackButton } from './adapters/capacitor/cap-back-button';
import { CapImmersiveFullscreen } from './adapters/capacitor/cap-immersive-fullscreen';
import { CapWakeLock } from './adapters/capacitor/cap-wake-lock';
import { WebOpenWith } from './adapters/web/web-open-with';
import { WebFullscreen } from './adapters/web/web-fullscreen';
import { WebWakeLock } from './adapters/web/web-wake-lock';
import { WebFileAccess } from './adapters/web/web-file-access';
import { WebPreferences } from './adapters/web/web-preferences';
import { APP_LIFECYCLE } from './ports/app-lifecycle';
import { DETECTION_ENGINE } from './ports/detection-engine';
import { DEVICE_INFO } from './ports/device-info';
import { OPEN_WITH } from './ports/open-with';
import { SessionPersistence } from './state/session-persistence';
import { IncomingFilesService } from './state/incoming-files.service';
import { BACK_BUTTON } from './ports/back-button';
import { FULLSCREEN } from './ports/fullscreen';
import { WAKE_LOCK } from './ports/wake-lock';
import { FILE_ACCESS } from './ports/file-access';
import { PdfLibWriter } from './adapters/pdflib/pdflib-pdf-writer';
import { PDF_RENDERER } from './ports/pdf-renderer';
import { PDF_WRITER } from './ports/pdf-writer';
import { PREFERENCES } from './ports/preferences';
import { KeyboardInput } from './input/keyboard-input';
import { NavigationHandler } from './input/navigation-handler';
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
      inject(KeyboardInput);
      inject(NavigationHandler);
    }),
    // PLT-007: one handler at priority 0 runs the Back chain; nothing handled means the app is minimized.
    provideEnvironmentInitializer(() => {
      const navigation = inject(NavigationHandler);
      inject(BACK_BUTTON, { optional: true })?.register(0, () => navigation.handleBack());
    }),
    provideEnvironmentInitializer(() => {
      inject(IncomingFilesService);
    }),
    // FIL-011: reopen the previous tabs, then start writing the session (annotation mode, FIL-012, is the default).
    provideEnvironmentInitializer(() => {
      inject(SessionPersistence);
      void inject(SessionStore).restore();
    }),
    provideEnvironmentInitializer(() => {
      void inject(PwaUpdatePolicy).checkAtStartup();
    }),
    // Development builds only (ngDevMode): the production bundle carries no debug hook.
    provideEnvironmentInitializer(() => {
      // `ngDevMode` is replaced by `false` in production builds, so this branch and the hook module are removed.
      if (typeof ngDevMode !== 'undefined' && ngDevMode) {
        const renderer = inject(PDF_RENDERER);
        const engine = inject(DETECTION_ENGINE);
        const session = inject(SessionStore);
        const detect = async (pdf: Uint8Array, pageIndex: number, scale: number) => {
          const signal = new AbortController().signal;
          const doc = await renderer.open(pdf);
          if (!doc.ok) throw new Error(doc.error);
          try {
            const info = await doc.value.getPageInfo(pageIndex);
            if (!info.ok) throw new Error(info.error);
            const region = { x: 0, y: 0, width: info.value.width, height: info.value.height };
            const bitmap = await doc.value.renderRegion({ pageIndex, region, scale }, signal);
            if (!bitmap.ok) throw new Error(bitmap.error);
            const level = TUNABLES.detection.levels[TUNABLES.detection.defaultLevel];
            const set = await engine.extractComponents(bitmap.value, signal, { blockSize: level.adaptiveBlockSize, c: level.adaptiveC });
            if (!set.ok) throw new Error(set.error);
            return set.value.components.map((component) => component.rect);
          } finally {
            await doc.value.destroy();
          }
        };
        installDebugHook(window as DebugHost, inject(BitmapCache), {
          detect,
          startedOrder: () => session.activeDocument()?.detection.startedOrder ?? [],
          detectionState: () => {
            const doc = session.activeDocument();
            return { complete: doc?.detectionComplete() ?? false, startedOrder: doc?.detection.startedOrder ?? [] };
          },
          strokeCount: () => session.activeDocument()?.strokes().length ?? 0,
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
    { provide: PDF_WRITER, useFactory: () => new PdfLibWriter() },
    { provide: APP_LIFECYCLE, useFactory: () => new WebAppLifecycle() },
    { provide: PREFERENCES, useFactory: () => new WebPreferences() },
    { provide: DEVICE_INFO, useFactory: () => new WebDeviceInfo() },
    // One instance per platform: the open-with adapter hands its files to the same handle store the file access reads from.
    { provide: FILE_ACCESS, useFactory: () => (Capacitor.isNativePlatform() ? new CapFileAccess() : new WebFileAccess()) },
    {
      provide: OPEN_WITH,
      useFactory: () => {
        const access = inject(FILE_ACCESS);
        return access instanceof CapFileAccess
          ? new CapOpenWith((file) => access.openIncoming(file))
          : new WebOpenWith((handle) => (access as WebFileAccess).adoptHandle(handle));
      },
    },
    { provide: FULLSCREEN, useFactory: () => (Capacitor.isNativePlatform() ? new CapImmersiveFullscreen() : new WebFullscreen()) },
    { provide: WAKE_LOCK, useFactory: () => (Capacitor.isNativePlatform() ? new CapWakeLock() : new WebWakeLock()) },
    // The web has no back button: no provider there, consumers inject it optionally.
    ...(Capacitor.isNativePlatform() ? [{ provide: BACK_BUTTON, useFactory: () => new CapBackButton() }] : []),
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
