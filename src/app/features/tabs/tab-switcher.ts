import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';

export const POPUP_TABS = 'tabs';

/** Compact layout: one button with the current tab name that opens the list of all tabs. FIL-004 */
@Component({
  selector: 'app-tab-switcher',
  template: `
    @if (session.activeTab(); as tab) {
      <button
        type="button"
        class="current"
        data-popup-trigger
        [attr.aria-expanded]="ui.popup()?.id === popupId"
        (click)="ui.togglePopup(popupId)"
      >
        <span [textContent]="tab.name"></span>
      </button>
    }
  `,
  styles: `
    :host { display: flex; min-width: 0; }
    .current {
      flex: 1;
      min-width: 0;
      min-height: var(--cm-touch-target);
      padding: 0 var(--cm-tab-gap);
      border: 0;
      background: transparent;
      color: var(--cm-icon);
      font: inherit;
      text-align: start;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabSwitcher {
  protected readonly session = inject(SessionStore);
  protected readonly ui = inject(UiStore);
  protected readonly popupId = POPUP_TABS;
}
