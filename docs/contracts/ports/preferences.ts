/** Port Preferences (first used in M8). UI state and file references only (FIL-015). Values must be JSON-serializable. */
import { InjectionToken } from '@angular/core';

export interface Preferences {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export const PREFERENCES = new InjectionToken<Preferences>('Preferences');
