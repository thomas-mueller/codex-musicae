import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { translateSignal } from '@jsverse/transloco';

import { adjacentFile } from '../../core';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { IconButton } from '../shell/icon-button';
import { FileItem } from './file-item';
import { OpenFileDirective } from './open-file.directive';

/** Open file, the entry of the current file and, unless the screen is narrow, previous and next file around it. FIL-021, FIL-024, FIL-025, FIL-027 */
@Component({
  selector: 'app-file-bar',
  imports: [FileItem, IconButton, OpenFileDirective],
  template: `
    <button appIconButton appOpenFile icon="openFile" labelKey="openFile"></button>
    @if (!ui.narrow()) {
      <button appIconButton icon="previousFile" labelKey="previousFile" [disabled]="previousId() === null" (pressed)="activate(previousId())"></button>
    }
    <div class="entry">
      @if (session.activeTab(); as tab) {
        <app-file-item [tab]="tab" [active]="true" [inBar]="true" [firstMarkerOnly]="ui.narrow()" [closable]="!ui.narrow()" />
      }
    </div>
    @if (!ui.narrow()) {
      <button appIconButton icon="nextFile" labelKey="nextFile" [disabled]="nextId() === null" (pressed)="activate(nextId())"></button>
    }
  `,
  styles: `
    :host { display: flex; align-items: center; min-width: 0; }
    .entry { display: flex; flex: 1; align-self: stretch; min-width: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'label()' },
})
export class FileBar {
  protected readonly session = inject(SessionStore);
  protected readonly ui = inject(UiStore);
  protected readonly label = translateSignal('a11y.fileBar');
  private readonly ids = computed(() => this.session.tabs().map((tab) => tab.id));
  protected readonly previousId = computed(() => adjacentFile(this.ids(), this.session.activeTabId(), -1));
  protected readonly nextId = computed(() => adjacentFile(this.ids(), this.session.activeTabId(), 1));

  protected activate(id: string | null): void {
    if (id !== null) {
      this.session.setActive(id);
    }
  }
}
