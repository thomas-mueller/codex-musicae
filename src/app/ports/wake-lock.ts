/** Port WakeLock (M16). Web: Screen Wake Lock. Android: keep-awake flag. The implementation re-acquires after visibility returns. */
import { InjectionToken } from '@angular/core';
import type { Result } from './result';

export type WakeLockError = 'unsupported' | 'denied';

export interface WakeLock {
  acquire(): Promise<Result<void, WakeLockError>>;
  release(): Promise<void>;
}

export const WAKE_LOCK = new InjectionToken<WakeLock>('WakeLock');
