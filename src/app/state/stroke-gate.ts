import { effect, inject, Injectable, untracked } from '@angular/core';

import { UiStore } from './ui.store';

/**
 * ANN-013: navigation requested while a stroke is in progress waits and is applied, in order, right after the stroke
 * ends. Every navigation source (commands, buttons, slider) goes through `run`.
 */
@Injectable({ providedIn: 'root' })
export class StrokeGate {
  private readonly ui = inject(UiStore);
  private queue: Array<() => void> = [];

  constructor() {
    effect(() => {
      if (!this.ui.strokeInProgress()) {
        untracked(() => this.flush());
      }
    });
  }

  run(action: () => void): void {
    if (this.ui.strokeInProgress()) {
      this.queue.push(action);
    } else {
      action();
    }
  }

  private flush(): void {
    const queued = this.queue;
    this.queue = [];
    for (const action of queued) {
      action();
    }
  }
}
