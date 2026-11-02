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
  /** Present when the marker is a control: FIL-016 the lock offers "save a copy". */
  readonly action?: 'saveCopy' | 'grantAccess';
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
  if (tab.saveFailed) {
    markers.push({ icon: 'error', labelKey: 'saveFailed' });
  }
  if (tab.needsWriteAccess) {
    markers.push({ icon: 'save', labelKey: 'grantWriteAccess', action: 'grantAccess' });
  }
  if (tab.unsaved) {
    markers.push({ icon: 'unsaved', labelKey: 'unsaved' });
  }
  if (tab.readOnly) {
    markers.push({ icon: 'readOnly', labelKey: 'readOnly', action: 'saveCopy' });
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
    <button
      type="button"
      class="name"
      role="tab"
      [attr.aria-selected]="active()"
      [attr.title]="tab().name"
      (click)="session.setActive(tab().id)"
    >
      <span [textContent]="tab().name"></span>
    </button>
    @for (marker of markers(); track marker.labelKey) {
      @if (marker.action) {
        <button
          type="button"
          class="marker"
          [appTooltip]="marker.labelKey"
          [attr.aria-label]="'a11y.' + marker.labelKey | transloco"
          (click)="onMarker(marker.action)"
        >
          <app-icon [name]="marker.icon" />
        </button>
      } @else {
        <span class="marker" role="img" [appTooltip]="marker.labelKey" [attr.aria-label]="'a11y.' + marker.labelKey | transloco">
          <app-icon [name]="marker.icon" />
        </span>
      }
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

  protected onMarker(action: TabMarker['action']): void {
    if (action === 'grantAccess') {
      void this.session.grantWriteAccess(this.tab().id);
    } else {
      void this.session.saveCopy(this.tab().id);
    }
  }
}
