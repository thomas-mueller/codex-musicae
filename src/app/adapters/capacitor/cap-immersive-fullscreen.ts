import { signal } from '@angular/core';

import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';
import type { Fullscreen, FullscreenError } from '../../ports/fullscreen';
import { ImmersivePlugin } from './immersive-plugin';
import type { ImmersivePluginApi } from './immersive-plugin';

/**
 * PLT-006: sticky immersive mode that draws under display cutouts.
 * UNVERIFIED(device): the window behavior can only be checked on a device (docs/device-checklist.md).
 */
export class CapImmersiveFullscreen implements Fullscreen {
  private readonly activeSignal = signal(false);
  private readonly callbacks = new Set<() => void>();

  readonly active = this.activeSignal.asReadonly();

  constructor(private readonly plugin: ImmersivePluginApi = ImmersivePlugin) {}

  async enter(): Promise<Result<void, FullscreenError>> {
    try {
      await this.plugin.enter();
      this.activeSignal.set(true);
      return ok(undefined);
    } catch {
      return err('denied');
    }
  }

  async exit(): Promise<void> {
    this.activeSignal.set(false);
    try {
      await this.plugin.exit();
    } catch {
      // The window is left as it is; there is nothing more to restore.
    }
  }

  /** Android shows its bars only transiently and has no gesture that leaves immersive mode; back goes through BackButton. */
  onExternalExit(callback: () => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
}
