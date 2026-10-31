import { computed, inject, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { CLOCK } from './clock';

const R = TUNABLES.resources;
const LEVEL_NO_PREFETCH = 1;
const LEVEL_LOW_RES = 2;

/**
 * NFR-010: degrade in order — drop prefetch (level 1), lower render resolution (level 2),
 * free inactive tabs' bitmaps (level 3, acted on by SessionStore). Recovers one level per quiet period.
 */
@Injectable({ providedIn: 'root' })
export class ResourceGovernor {
  private readonly clock = inject(CLOCK);
  private readonly levelSignal = signal(0);
  private lastEscalationAt = Number.NEGATIVE_INFINITY;
  private cancelRecovery: (() => void) | null = null;

  readonly level = this.levelSignal.asReadonly();
  readonly prefetchNeighbors = computed(() => (this.level() >= LEVEL_NO_PREFETCH ? 0 : R.prefetchNeighbors));
  readonly renderScaleFactor = computed(() => (this.level() >= LEVEL_LOW_RES ? R.governorLowResFactor : 1));

  /** An allocation failed or the cache is over budget after eviction. */
  reportFailure(): void {
    const now = this.clock.now();
    if (this.level() < R.governorMaxLevel && now - this.lastEscalationAt >= R.governorEscalateCooldownMs) {
      this.levelSignal.update((l) => l + 1);
      this.lastEscalationAt = now;
    }
    this.armRecovery();
  }

  private armRecovery(): void {
    this.cancelRecovery?.();
    this.cancelRecovery = this.clock.schedule(R.governorRecoverMs, () => {
      this.cancelRecovery = null;
      this.levelSignal.update((l) => Math.max(0, l - 1));
      if (this.level() > 0) {
        this.armRecovery();
      }
    });
  }
}
