import { computed, inject } from '@angular/core';
import type { Signal } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import { UiStore } from '../../state/ui.store';

/**
 * The side of the tool strip where there is one (expanded, not in the settings): a notice below the top bar leaves its
 * buttons free. Call in an injection context.
 */
export function noticeStrip(): Signal<string | null> {
  const ui = inject(UiStore);
  return computed(() => (ui.sizeClass() === 'expanded' && ui.mode() !== 'settings' ? TUNABLES.layout.toolStripSide : null));
}
