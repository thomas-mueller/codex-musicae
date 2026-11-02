import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';
import type { WakeLock, WakeLockError } from '../../ports/wake-lock';
import { ImmersivePlugin } from './immersive-plugin';
import type { ImmersivePluginApi } from './immersive-plugin';

/** PLT-005: the Android keep-screen-on window flag, set by the native plugin. */
export class CapWakeLock implements WakeLock {
  constructor(private readonly plugin: ImmersivePluginApi = ImmersivePlugin) {}

  async acquire(): Promise<Result<void, WakeLockError>> {
    try {
      await this.plugin.setKeepAwake({ on: true });
      return ok(undefined);
    } catch {
      return err('denied');
    }
  }

  async release(): Promise<void> {
    try {
      await this.plugin.setKeepAwake({ on: false });
    } catch {
      // Nothing to release.
    }
  }
}
