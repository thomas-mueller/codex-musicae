import type { Provider } from '@angular/core';

import { signal } from '@angular/core';

import { APP_LIFECYCLE } from '../app/ports/app-lifecycle';
import { DETECTION_ENGINE } from '../app/ports/detection-engine';
import { ok } from '../app/ports/result';
import { DEVICE_INFO } from '../app/ports/device-info';
import { FILE_ACCESS } from '../app/ports/file-access';
import { APP_VERSION } from '../app/ports/app-version';
import { PDF_RENDERER } from '../app/ports/pdf-renderer';
import { PDF_WRITER } from '../app/ports/pdf-writer';
import { PREFERENCES } from '../app/ports/preferences';
import { fakeFileAccess, fakePdfWriter, memoryPreferences } from '../app/state/testing/fake-ports';
import { fakeRenderer } from '../app/state/testing/fake-renderer';

const TEST_MEMORY_GB = 4;

/** Fake platform ports for specs that render the shell or use the stores. */
export function provideTestPorts(): Provider[] {
  return [
    { provide: PDF_RENDERER, useValue: fakeRenderer() },
    { provide: FILE_ACCESS, useValue: fakeFileAccess() },
    { provide: PREFERENCES, useValue: memoryPreferences() },
    ...provideTestDetectionPorts(),
    ...provideTestSavePorts(),
  ];
}

/** The ports the save pipeline of every tab needs (M15). */
export function provideTestSavePorts(): Provider[] {
  return [
    { provide: PDF_WRITER, useValue: fakePdfWriter() },
    { provide: APP_VERSION, useValue: 'v0.0.0-test' },
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
