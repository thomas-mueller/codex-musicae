import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
  inject,
  InjectionToken,
  isDevMode,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { provideTransloco } from '@jsverse/transloco';
import { provideRouter } from '@angular/router';
import { TUNABLES } from '../config/tunables';
// EDN-007: the build replaces this file with features.native.ts for the native editions (angular.json fileReplacements).
import { FEATURES } from '../config/features.web';
import { resolveFeatures } from '../config/edition';
import type { Edition } from '../config/edition';
import { FEATURE_FLAGS } from './ports/feature-flags';
import type { FileAccess } from './ports/file-access';
import { FeatureFileAccess, persistsFileHandles } from './adapters/feature/feature-file-access';
import { FeaturePreferences } from './adapters/feature/feature-preferences';
import { MemoryHandleStore } from './adapters/web/memory-handle-store';
import { cacheBudgetFor } from './core/cache-budget';
import { tunablesToCssVars } from './state/css-vars';
import { DetectionService } from './state/detection.service';
import { APP_VERSION_DISPLAY, APP_VERSION_FULL as APP_VERSION_FULL_VALUE } from '../config/version.generated';
import { APP_VERSION, APP_VERSION_FULL } from './ports/app-version';

import { provideAppIdentity } from './adapters/web/app-identity';
import { AppTranslocoLoader } from './adapters/web/transloco-loader';
import { PwaUpdatePolicy } from './adapters/web/pwa-update-policy';
import { OpenCvDetectionEngine } from './adapters/opencv/opencv-detection-engine';
import { PdfJsRenderer } from './adapters/pdfjs/pdfjs-renderer';
import { WorkingResolutionRenderer } from './adapters/pdfjs/working-resolution-renderer';
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

/** The platform file access before the feature switches are applied; only the OPEN_WITH adapter needs the concrete class. */
const RAW_FILE_ACCESS = new InjectionToken<FileAccess>('RAW_FILE_ACCESS');

declare const ngDevMode: boolean | object | undefined;
/** EDN-010: build constant set by the build configuration (angular.json `define`): 'paid' only for native-paid. */
declare const EDITION: Edition;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    { provide: APP_VERSION, useValue: APP_VERSION_DISPLAY },
    { provide: APP_VERSION_FULL, useValue: APP_VERSION_FULL_VALUE },
    { provide: FEATURE_FLAGS, useValue: resolveFeatures(FEATURES, typeof EDITION === 'undefined' ? 'free' : EDITION) },
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
        const detection = inject(DetectionService);
        const detect = async (pdf: Uint8Array, pageIndex: number, scale: number) => {
          const signal = new AbortController().signal;
          const doc = await renderer.open(pdf);
          if (!doc.ok) throw new Error(doc.error);
          try {
            const info = await doc.value.getPageInfo(pageIndex);
            if (!info.ok) throw new Error(info.error);
            const region = { x: 0, y: 0, width: info.value.width, height: info.value.height };
            const level = TUNABLES.detection.levels[TUNABLES.detection.defaultLevel];
            const params = { blockSize: level.adaptiveBlockSize, c: level.adaptiveC };
            // The same path as the detection service: from the working raster, reduced inside the engine (NFR-025).
            const raster = await doc.value.renderWorkingRaster?.(pageIndex, signal);
            let set;
            if (raster?.ok && raster.value.scale >= scale) {
              const target = { width: Math.max(1, Math.round(info.value.width * scale)), height: Math.max(1, Math.round(info.value.height * scale)) };
              set = await engine.extractComponents(raster.value.bitmap, signal, { ...params, target });
            } else {
              if (raster?.ok) raster.value.bitmap.close();
              const bitmap = await doc.value.renderRegion({ pageIndex, region, scale }, signal);
              if (!bitmap.ok) throw new Error(bitmap.error);
              set = await engine.extractComponents(bitmap.value, signal, params);
            }
            if (!set.ok) throw new Error(set.error);
            return set.value.components.map((component) => component.rect);
          } finally {
            await doc.value.destroy();
          }
        };
        installDebugHook(window as DebugHost, inject(BitmapCache), {
          detect,
          sourceRenders: () => (renderer instanceof WorkingResolutionRenderer ? renderer.stats.sourceRenders : 0),
          directRenders: () => (renderer instanceof WorkingResolutionRenderer ? renderer.stats.directRenders : 0),
          startedOrder: () => session.activeDocument()?.detection.startedOrder ?? [],
          detectionState: () => {
            const doc = session.activeDocument();
            return { complete: doc?.detectionComplete() ?? false, startedOrder: doc?.detection.startedOrder ?? [] };
          },
          systemCounts: () => {
            const run = session.activeDocument()?.detection;
            return { level: run?.level() ?? '', counts: (run?.pages() ?? []).map((page) => page?.systems.length ?? null) };
          },
          redetect: (level) => {
            const doc = session.activeDocument();
            if (doc !== null) detection.redetect(doc, level);
          },
          strokes: () => session.activeDocument()?.strokes() ?? [],
          applyOps: (ops) => {
            const doc = session.activeDocument();
            for (const op of ops) {
              if (doc === null) break;
              if (op.op === 'add') doc.addStroke(op.stroke);
              else if (op.op === 'erase')
                doc.eraseStrokes(doc.strokes().filter((s) => s.id === op.id));
              else if (op.op === 'undo') doc.undo();
              else doc.redo();
            }
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
    {
      provide: PDF_RENDERER,
      useFactory: () => {
        // NFR-026: pages whose pdf.js state stays warm, by device memory.
        const warmPages = cacheBudgetFor(inject(DEVICE_INFO).deviceMemoryGb(), TUNABLES.pdf.warmPagesByDeviceMemoryGb, TUNABLES.pdf.warmPagesDefault);
        return new WorkingResolutionRenderer(new PdfJsRenderer({ warmPages }));
      },
    },
    { provide: DETECTION_ENGINE, useFactory: () => new OpenCvDetectionEngine() },
    { provide: PDF_WRITER, useFactory: () => new PdfLibWriter() },
    { provide: APP_LIFECYCLE, useFactory: () => new WebAppLifecycle() },
    // EDN-005: the switches decide what is persisted; the web preferences adapter is still the paid configuration's store.
    { provide: PREFERENCES, useFactory: () => new FeaturePreferences(new WebPreferences(), inject(FEATURE_FLAGS)) },
    { provide: DEVICE_INFO, useFactory: () => new WebDeviceInfo() },
    // One instance per platform: the open-with adapter hands its files to the same handle store the file access reads from.
    {
      provide: RAW_FILE_ACCESS,
      useFactory: () =>
        Capacitor.isNativePlatform()
          ? new CapFileAccess()
          : new WebFileAccess(persistsFileHandles(inject(FEATURE_FLAGS)) ? {} : { handleStore: new MemoryHandleStore() }),
    },
    // EDN-001, EDN-005: writes, copies and stored handles are gated by the switches.
    { provide: FILE_ACCESS, useFactory: () => new FeatureFileAccess(inject(RAW_FILE_ACCESS), inject(FEATURE_FLAGS)) },
    {
      provide: OPEN_WITH,
      useFactory: () => {
        const access = inject(RAW_FILE_ACCESS);
        return access instanceof CapFileAccess
          ? new CapOpenWith((file) => access.openIncoming(file))
          : new WebOpenWith((handle) => (access as WebFileAccess).adoptHandle(handle));
      },
    },
    { provide: FULLSCREEN, useFactory: () => (Capacitor.isNativePlatform() ? new CapImmersiveFullscreen() : new WebFullscreen()) },
    { provide: WAKE_LOCK, useFactory: () => (Capacitor.isNativePlatform() ? new CapWakeLock() : new WebWakeLock()) },
    // Only Android has a back button: no provider on the web or iOS, consumers inject it optionally.
    ...(hasBackButton(Capacitor) ? [{ provide: BACK_BUTTON, useFactory: () => new CapBackButton() }] : []),
    provideRouter(routes),
  ]
};

interface CapacitorPlatform {
  isNativePlatform(): boolean;
}

interface CapacitorPlatformName {
  getPlatform(): string;
}

/** PLT-007, PLT-013: Android has a system back button; iOS has none (leaving presentation mode is by center tap or Esc). */
export function hasBackButton(capacitor: CapacitorPlatformName): boolean {
  return capacitor.getPlatform() === TUNABLES.platforms.android;
}

export function shouldRegisterServiceWorker(
  developmentBuild: boolean,
  capacitor: CapacitorPlatform,
): boolean {
  return !developmentBuild && !capacitor.isNativePlatform();
}

function applyTunablesToCss(root: HTMLElement): void {
  for (const [name, value] of Object.entries(tunablesToCssVars(TUNABLES))) {
    root.style.setProperty(name, value);
  }
}
