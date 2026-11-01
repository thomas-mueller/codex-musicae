import { computed, inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { initialAspectRatio, orientationOf, stepAspectRatio } from '../core';
import type { DocumentStore } from './document.store';
import { PreferencesStore } from './preferences.store';
import { SessionStore } from './session.store';

/** Aspect ratio of slides: global default per orientation, per-PDF override, step buttons. SLD-013..SLD-015 */
@Injectable({ providedIn: 'root' })
export class AspectRatioService {
  private readonly preferences = inject(PreferencesStore);
  private readonly session = inject(SessionStore);

  readonly canShowMore = computed(() => this.canStep('more'));
  readonly canShowLess = computed(() => this.canStep('less'));

  /** SLD-014: the first presentation entry in an orientation fixes its global default; later entries change nothing. */
  async captureForOrientation(width: number, height: number): Promise<void> {
    const orientation = orientationOf(width, height);
    if (this.preferences.globalRatios()[orientation] === undefined) {
      await this.preferences.setGlobalRatio(orientation, initialAspectRatio(width, height, TUNABLES.aspectRatio));
    }
  }

  showMore(): void {
    this.step('more');
  }

  showLess(): void {
    this.step('less');
  }

  private step(direction: 'more' | 'less'): void {
    const doc = this.session.activeDocument();
    if (doc && this.canStep(direction)) {
      this.write(doc, direction);
    }
  }

  private write(doc: DocumentStore, direction: 'more' | 'less'): void {
    const orientation = doc.orientation();
    doc.ratioOverride.update((o) => ({ ...o, [orientation]: stepAspectRatio(doc.aspectRatio(), direction, TUNABLES.aspectRatio) }));
  }

  private canStep(direction: 'more' | 'less'): boolean {
    const doc = this.session.activeDocument();
    return !!doc && stepAspectRatio(doc.aspectRatio(), direction, TUNABLES.aspectRatio) !== doc.aspectRatio();
  }
}
