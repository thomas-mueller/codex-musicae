import { DestroyRef, inject, Injectable } from '@angular/core';

import { OPEN_WITH } from '../ports/open-with';
import { SessionStore } from './session.store';

/**
 * FIL-018, FIL-019, FIL-029, FIL-030: files the OS hands to the app (Android VIEW and SEND intents, iOS, web file handler) open as tabs like picked files; a
 * file without write access opens read-only (FIL-016, FIL-040). In every edition (EDN-017). Started once from the composition root.
 */
@Injectable({ providedIn: 'root' })
export class IncomingFilesService {
  constructor() {
    const session = inject(SessionStore);
    const stop = inject(OPEN_WITH, { optional: true })?.onIncomingFiles((files) => void session.openFiles(files));
    if (stop) {
      inject(DestroyRef).onDestroy(stop);
    }
  }
}
