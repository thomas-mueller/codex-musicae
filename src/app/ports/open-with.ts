/** Port OpenWith (M16): files handed to the app by the OS (Android VIEW intent, web file handler). */
import { InjectionToken } from '@angular/core';
import type { OpenedFile } from './file-access';

export interface OpenWith {
  /** Registers a listener; also delivers files received before registration (cold start). Returns an unsubscribe function. */
  onIncomingFiles(callback: (files: readonly OpenedFile[]) => void): () => void;
}

export const OPEN_WITH = new InjectionToken<OpenWith>('OpenWith');
