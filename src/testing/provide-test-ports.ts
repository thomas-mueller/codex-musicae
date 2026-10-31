import type { Provider } from '@angular/core';

import { DEVICE_INFO } from '../app/ports/device-info';
import { FILE_ACCESS } from '../app/ports/file-access';
import { PDF_RENDERER } from '../app/ports/pdf-renderer';
import { PREFERENCES } from '../app/ports/preferences';
import { fakeFileAccess, memoryPreferences } from '../app/state/testing/fake-ports';
import { fakeRenderer } from '../app/state/testing/fake-renderer';

const TEST_MEMORY_GB = 4;

/** Fake platform ports for specs that render the shell or use the stores. */
export function provideTestPorts(): Provider[] {
  return [
    { provide: PDF_RENDERER, useValue: fakeRenderer() },
    { provide: FILE_ACCESS, useValue: fakeFileAccess() },
    { provide: PREFERENCES, useValue: memoryPreferences() },
    { provide: DEVICE_INFO, useValue: { deviceMemoryGb: () => TEST_MEMORY_GB, devicePixelRatio: () => 1, prefersReducedMotion: () => false } },
  ];
}
