import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { SessionStore } from '../../state/session.store';
import { TabItem } from './tab-item';

/** Expanded layout: all tabs in a row. FIL-004 */
@Component({
  selector: 'app-tab-bar',
  imports: [TabItem],
  template: `
    @for (tab of session.tabs(); track tab.id) {
      <app-tab-item [tab]="tab" [active]="tab.id === session.activeTabId()" />
    }
  `,
  styles: `
    :host { display: flex; align-items: center; overflow-x: auto; min-width: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'tablist' },
})
export class TabBar {
  protected readonly session = inject(SessionStore);
}
