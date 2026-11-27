import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { TUNABLES } from '../../../config/tunables';
import { fileMarkers } from '../../core';
import type { FileMarker } from '../../core';
import { FEATURE_FLAGS } from '../../ports/feature-flags';
import { FilePrompts } from '../../state/file-prompts';
import { SessionStore } from '../../state/session.store';
import type { Tab } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { Icon } from '../shell/icon';
import type { IconKey } from '../shell/icon';
import { IconButton } from '../shell/icon-button';
import { TooltipDirective } from '../shell/tooltip.directive';

export const POPUP_FILES = 'files';

interface MarkerView {
  readonly icon: IconKey;
  /** Translation key under `a11y.` and `tooltip.`. */
  readonly labelKey: string;
  /** Present when the marker is a control. */
  readonly action?: 'grantAccess' | 'reopen';
}

/** The markers drawn as icons behind the name; unsaved changes and the lock belong to the name itself. */
type IconMarker = Exclude<FileMarker, 'unsaved' | 'readOnly'>;

const isIconMarker = (marker: FileMarker): marker is IconMarker => marker !== 'unsaved' && marker !== 'readOnly';

const MARKER_VIEWS: Readonly<Record<Exclude<IconMarker, 'loadError'>, MarkerView>> = {
  saveFailed: { icon: 'error', labelKey: 'saveFailed' },
  writeAccess: { icon: 'save', labelKey: 'grantWriteAccess', action: 'grantAccess' },
  needsReopen: { icon: 'needsReopen', labelKey: 'needsReopen', action: 'reopen' },
};

const ERROR_KEYS: Readonly<Record<string, string>> = {
  invalid: 'errorInvalid',
  encrypted: 'errorEncrypted',
  empty: 'errorEmpty',
  unknown: 'errorUnknown',
};

/** An error of loading carries its reason. FIL-009 */
function viewOf(marker: IconMarker, tab: Tab): MarkerView {
  return marker === 'loadError'
    ? { icon: 'error', labelKey: ERROR_KEYS[tab.errorCode ?? 'unknown'] ?? 'errorUnknown' }
    : MARKER_VIEWS[marker];
}

/**
 * One open file: name with a red "*" for unsaved changes, then the lock of a read-only file, further status icons and the
 * close icon. In the top bar the name (and the free space after it) opens the file list; in the list it makes the file current. The current file lies on a pale pill. FIL-021, FIL-022, FIL-023
 */
@Component({
  selector: 'app-file-item',
  imports: [Icon, IconButton, TooltipDirective, TranslocoPipe],
  template: `
    <button
      type="button"
      class="name"
      [attr.data-popup-trigger]="inBar() ? '' : null"
      [attr.aria-expanded]="inBar() ? ui.popup()?.id === popupId : null"
      [attr.aria-current]="!inBar() && active() ? 'true' : null"
      (click)="onName()"
    >
      <!-- the hover text sits on the name itself, not on the button: it must not show beside a marker's tooltip -->
      <span class="text" [textContent]="tab().name" (pointerenter)="onTextEnter($event)"></span>
      @if (unsaved()) {
        <span class="marker unsaved" role="img" appTooltip="unsaved" [attr.aria-label]="'a11y.unsaved' | transloco" [textContent]="unsavedMark"></span>
      }
    </button>
    @if (readOnly()) {
      <button
        type="button"
        class="marker lock"
        [class.disabled]="!allowed('saveAs')"
        [attr.aria-disabled]="!allowed('saveAs')"
        appTooltip="readOnly"
        [attr.aria-label]="'a11y.readOnly' | transloco"
        (click)="onMarker('saveAs')"
      >
        <app-icon name="readOnly" />
      </button>
    }
    @for (marker of listed(); track marker.labelKey) {
      @if (marker.action) {
        <button
          type="button"
          class="marker"
          [class.disabled]="!allowed(marker.action)"
          [attr.aria-disabled]="!allowed(marker.action)"
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
    <!-- the free space belongs to the name's tap target; the name button is the one for keyboard and screen reader -->
    <button
      type="button"
      class="rest"
      tabindex="-1"
      [attr.aria-hidden]="summary() ? null : true"
      [attr.data-popup-trigger]="inBar() ? '' : null"
      (click)="onName()"
    >
      @if (summary(); as marker) {
        <span class="marker" role="img" [appTooltip]="marker.labelKey" [attr.aria-label]="'a11y.' + marker.labelKey | transloco">
          <app-icon [name]="marker.icon" />
        </span>
      }
    </button>
    @if (closable()) {
      <button appIconButton class="close" icon="closeTab" labelKey="closeTab" (pressed)="session.closeTab(tab().id)"></button>
    }
  `,
  styleUrl: './file-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.active]': 'active()', '[class.in-bar]': 'inBar()' },
})
export class FileItem {
  protected readonly session = inject(SessionStore);
  protected readonly ui = inject(UiStore);
  private readonly flags = inject(FEATURE_FLAGS);
  private readonly prompts = inject(FilePrompts);
  protected readonly popupId = POPUP_FILES;
  readonly tab = input.required<Tab>();
  readonly active = input(false);
  /** True for the entry of the top bar, false for a row of the file list. */
  readonly inBar = input(false);
  /** The narrow top bar has room for the most important status icon only; the list shows all. FIL-022 */
  readonly firstMarkerOnly = input(false);
  /** False for the entry of the narrow top bar: files are closed from the file list there. FIL-021 */
  readonly closable = input(true);

  protected readonly unsavedMark = TUNABLES.layout.unsavedMarkText;
  private readonly markers = computed(() => {
    const tab = this.tab();
    return fileMarkers({ ...tab, loadError: tab.status === 'error' });
  });
  protected readonly unsaved = computed(() => this.markers().includes('unsaved'));
  protected readonly readOnly = computed(() => this.markers().includes('readOnly'));
  private readonly icons = computed(() => this.markers().filter(isIconMarker).map((marker) => viewOf(marker, this.tab())));
  /** The single status icon of the narrow bar: no control of its own, a tap on it opens the list. */
  protected readonly summary = computed(() => (this.firstMarkerOnly() ? (this.icons()[0] ?? null) : null));
  protected readonly listed = computed(() => (this.firstMarkerOnly() ? [] : this.icons()));

  /** FIL-027: the full name is hover text only while the name is shortened. Measured when the pointer arrives. */
  protected onTextEnter(event: Event): void {
    const text = event.target as HTMLElement;
    if (text.scrollWidth > text.clientWidth) {
      text.title = this.tab().name;
    } else {
      text.removeAttribute('title');
    }
  }

  protected onName(): void {
    if (this.inBar()) {
      this.ui.togglePopup(POPUP_FILES);
      return;
    }
    this.session.setActive(this.tab().id); // synchronous: a reopen may need this tap as its user gesture (FIL-013)
    this.ui.closePopup();
  }

  /** EDN-003: a marker that offers a blocked action stays visible but does nothing. */
  protected allowed(action: MarkerView['action'] | 'saveAs'): boolean {
    if (action === 'reopen') {
      return true;
    }
    return action === 'grantAccess' ? this.flags.autosave : this.flags.saveCopy;
  }

  /** FIL-022: the lock shows the notice that offers "save as new file". */
  protected onMarker(action: MarkerView['action'] | 'saveAs'): void {
    if (!this.allowed(action)) {
      return;
    }
    if (action === 'grantAccess') {
      void this.session.grantWriteAccess(this.tab().id);
    } else if (action === 'reopen') {
      this.session.setActive(this.tab().id);
    } else {
      this.prompts.showNotice(this.tab().id, true);
      this.ui.closePopup(); // the notice shows where the file list is
    }
  }
}
