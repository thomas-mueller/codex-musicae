import type { Provider } from '@angular/core';

import { signal } from '@angular/core';

import { TUNABLES } from '../config/tunables';

import { APP_LIFECYCLE } from '../app/ports/app-lifecycle';
import { DETECTION_ENGINE } from '../app/ports/detection-engine';
import { ok } from '../app/ports/result';
import { DEVICE_INFO } from '../app/ports/device-info';
import { FILE_ACCESS } from '../app/ports/file-access';
import { FEATURE_FLAGS } from '../app/ports/feature-flags';
import type { FeatureFlags } from '../app/ports/feature-flags';
import { APP_VERSION } from '../app/ports/app-version';
import { PDF_RENDERER } from '../app/ports/pdf-renderer';
import { PDF_WRITER } from '../app/ports/pdf-writer';
import { PREFERENCES } from '../app/ports/preferences';
import { FULLSCREEN } from '../app/ports/fullscreen';
import { WAKE_LOCK } from '../app/ports/wake-lock';
import { fakeFileAccess, fakeFullscreen, fakeWakeLock, fakePdfWriter, memoryPreferences } from '../app/state/testing/fake-ports';
import { fakeRenderer } from '../app/state/testing/fake-renderer';

const TEST_MEMORY_GB = 4;

/** Specs run with the V1 behavior (every switch on, like the paid edition); specs of a configuration override FEATURE_FLAGS. */
export const ALL_FEATURES_ON: FeatureFlags = {
  autosave: true,
  saveCopy: true,
  sendTo: true,
  recentFiles: true,
  sessionRestore: true,
  persistSettings: true,
  persistFileChoices: true,
  restoreZoom: true,
  crossFileAutoOpen: true,
  shareIn: true,
};

/** Fake platform ports for specs that render the shell or use the stores. */
export function provideTestPorts(fullscreen = fakeFullscreen()): Provider[] {
  return [
    { provide: PDF_RENDERER, useValue: fakeRenderer() },
    { provide: FILE_ACCESS, useValue: fakeFileAccess() },
    // FIL-038: specs that are not about the overwrite question start with it switched off for all files
    { provide: PREFERENCES, useValue: memoryPreferences({ [TUNABLES.persistence.overwriteKey]: { all: true, names: [] } }) },
    { provide: FULLSCREEN, useValue: fullscreen },
    { provide: WAKE_LOCK, useValue: fakeWakeLock() },
    ...provideTestDetectionPorts(),
    ...provideTestSavePorts(),
  ];
}

/** The ports the save pipeline of every tab needs (M15), and the feature switches (all on: V1 behavior; a spec of a configuration overrides FEATURE_FLAGS). */
export function provideTestSavePorts(): Provider[] {
  return [
    { provide: PDF_WRITER, useValue: fakePdfWriter() },
    { provide: APP_VERSION, useValue: 'v0.0.0-test' },
    { provide: FEATURE_FLAGS, useValue: ALL_FEATURES_ON },
  ];
}

/** A lifecycle that reports the user as active, so background detection stays paused (DET-017) and specs that open documents see no extra renders. */
export function provideTestDetectionPorts(): Provider[] {
  return [
    {
      provide: APP_LIFECYCLE,
      useValue: { visible: signal(true), userActive: signal(true), batterySaver: signal<boolean | null>(null), onPause: () => () => undefined },
    },
    {
      provide: DETECTION_ENGINE,
      useValue: {
        extractComponents: (bitmap: ImageBitmap) => {
          const { width, height } = bitmap;
          bitmap.close();
          return Promise.resolve(ok({ width, height, components: [] }));
        },
      },
    },
    { provide: DEVICE_INFO, useValue: { deviceMemoryGb: () => TEST_MEMORY_GB, devicePixelRatio: () => 1, prefersReducedMotion: () => false, screenSize: () => ({ width: 1280, height: 800 }) } },
  ];
}
