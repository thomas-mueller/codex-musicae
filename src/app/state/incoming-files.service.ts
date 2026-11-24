import { DestroyRef, inject, Injectable } from '@angular/core';

import { FEATURE_FLAGS } from '../ports/feature-flags';
import { OPEN_WITH } from '../ports/open-with';
import { SessionStore } from './session.store';

/**
 * FIL-018, FIL-019: files the OS hands to the app (Android VIEW intent, web file handler) open as tabs like picked files; a
 * file without write access opens read-only (FIL-016). Started once from the composition root.
 */
@Injectable({ providedIn: 'root' })
export class IncomingFilesService {
  constructor() {
    if (!inject(FEATURE_FLAGS).shareIn) {
      return; // EDN-001, EDN-005: the free edition ignores files handed over by the system
    }
    const session = inject(SessionStore);
    const stop = inject(OPEN_WITH, { optional: true })?.onIncomingFiles((files) => void session.openFiles(files));
    if (stop) {
      inject(DestroyRef).onDestroy(stop);
    }
  }
}
