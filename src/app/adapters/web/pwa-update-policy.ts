import { Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

@Injectable({ providedIn: 'root' })
export class PwaUpdatePolicy {
  private readonly update = inject(SwUpdate, { optional: true });

  async checkAtStartup(): Promise<void> {
    if (!this.update?.isEnabled) {
      return;
    }

    try {
      await this.update.checkForUpdate();
    } catch {
      // Update checks are best effort and must never block application startup.
    }
  }
}
