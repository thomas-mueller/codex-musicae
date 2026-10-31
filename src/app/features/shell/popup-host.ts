import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { APP_VERSION } from '../../ports/app-version';
import type { FileRef } from '../../ports/file-access';
import { PreferencesStore } from '../../state/preferences.store';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { POPUP_OVERFLOW_BOTTOM, POPUP_SLIDER } from './bottom-bar';
import { POPUP_RECENT } from '../tabs/open-file.directive';
import { POPUP_TABS } from '../tabs/tab-switcher';
import { TabItem } from '../tabs/tab-item';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { LEVEL_ENTRIES, POPUP_ORG } from './tool-area';
import { POPUP_OVERFLOW_TOP } from './top-bar';

export const POPUP_INFO = 'info';
const POPUP_SELECTOR = '[data-popup], [data-popup-trigger]';

/** Renders at most one popup: a sheet (compact) or a side panel (expanded). UIX-013, 015 */
@Component({
  selector: 'app-popup-host',
  imports: [Icon, IconButton, TabItem, TranslocoPipe],
  templateUrl: './popup-host.html',
  styleUrl: './popup-host.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:pointerdown)': 'onOutside($event)',
    // TODO(M13): move to command bus
    '(document:keydown.escape)': 'store.closePopup()',
  },
})
export class PopupHost {
  protected readonly store = inject(UiStore);
  protected readonly version = inject(APP_VERSION);
  protected readonly session = inject(SessionStore);
  protected readonly preferences = inject(PreferencesStore);
  protected readonly levels = LEVEL_ENTRIES;
  protected readonly ids = {
    overflowTop: POPUP_OVERFLOW_TOP,
    overflowBottom: POPUP_OVERFLOW_BOTTOM,
    slider: POPUP_SLIDER,
    org: POPUP_ORG,
    info: POPUP_INFO,
    recent: POPUP_RECENT,
    tabs: POPUP_TABS,
  };
  protected readonly compact = computed(() => this.store.sizeClass() === 'compact');
  protected readonly annotation = computed(() => this.store.mode() === 'annotation');
  protected readonly noDocument = computed(() => !this.store.hasDocument());
  protected readonly popupId = computed(() => {
    const id = this.store.popup()?.id;
    return id !== undefined && Object.values(this.ids).includes(id) ? id : null;
  });

  /** FIL-008: success closes the popup; lost access keeps it open with the entry marked (next tap offers the picker). */
  protected async reopen(ref: FileRef): Promise<void> {
    if ((await this.session.reopenRecent(ref)) === 'opened') {
      this.store.closePopup();
    }
  }

  protected onOutside(event: Event): void {
    const target = event.target;
    if (this.store.popup() && target instanceof Element && !target.closest(POPUP_SELECTOR)) {
      this.store.closePopup();
    }
  }
}
