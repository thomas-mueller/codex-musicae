import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { SessionStore } from '../../state/session.store';
import type { Tab } from '../../state/session.store';
import { Icon } from '../shell/icon';
import type { IconKey } from '../shell/icon';
import { IconButton } from '../shell/icon-button';
import { TooltipDirective } from '../shell/tooltip.directive';

export interface TabMarker {
  readonly icon: IconKey;
  /** Translation key under `a11y.` and `tooltip.`. */
  readonly labelKey: string;
}

const ERROR_KEYS: Readonly<Record<string, string>> = {
  invalid: 'errorInvalid',
  encrypted: 'errorEncrypted',
  empty: 'errorEmpty',
  unknown: 'errorUnknown',
};

/** Markers of a tab in display order: error (with the reason), unsaved dot, read-only lock, needs-re-open. FIL-003, FIL-009 */
export function markersOf(tab: Tab): TabMarker[] {
  const markers: TabMarker[] = [];
  if (tab.status === 'error') {
    markers.push({ icon: 'error', labelKey: ERROR_KEYS[tab.errorCode ?? 'unknown'] ?? 'errorUnknown' });
  }
  if (tab.unsaved) {
    markers.push({ icon: 'unsaved', labelKey: 'unsaved' });
  }
  if (tab.readOnly) {
    markers.push({ icon: 'readOnly', labelKey: 'readOnly' });
  }
  if (tab.needsReopen) {
    markers.push({ icon: 'needsReopen', labelKey: 'needsReopen' });
  }
  return markers;
}

/** One tab: file name, status markers, close icon. FIL-003 */
@Component({
  selector: 'app-tab-item',
  imports: [Icon, IconButton, TooltipDirective, TranslocoPipe],
  template: `
    <button type="button" class="name" role="tab" [attr.aria-selected]="active()" (click)="session.setActive(tab().id)">
      <span [textContent]="tab().name"></span>
    </button>
    @for (marker of markers(); track marker.labelKey) {
      <span class="marker" role="img" [appTooltip]="marker.labelKey" [attr.aria-label]="'a11y.' + marker.labelKey | transloco">
        <app-icon [name]="marker.icon" />
      </span>
    }
    <button appIconButton icon="closeTab" labelKey="closeTab" (pressed)="session.closeTab(tab().id)"></button>
  `,
  styleUrl: './tab-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.active]': 'active()' },
})
export class TabItem {
  protected readonly session = inject(SessionStore);
  readonly tab = input.required<Tab>();
  readonly active = input(false);
  protected readonly markers = computed(() => markersOf(this.tab()));
}
