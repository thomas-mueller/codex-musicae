import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import type { FileRef } from '../../ports/file-access';
import { AspectRatioService } from '../../state/aspect-ratio.service';
import { OrgViewStore } from '../../state/org-view.store';
import { PreferencesStore } from '../../state/preferences.store';
import { SessionStore } from '../../state/session.store';
import { SlideNavStore } from '../../state/slide-nav.store';
import type { StyledTool } from '../../state/tool-settings.store';
import { UiStore } from '../../state/ui.store';
import { ToolPopup } from '../annotation/tool-popup';
import { POPUP_OVERFLOW_BOTTOM, POPUP_SLIDER } from './bottom-bar';
import { MarkList, POPUP_MARK_LIST } from '../organization/mark-list';
import { FileItem, POPUP_FILES } from '../files/file-item';
import { POPUP_RECENT } from '../files/open-file.directive';
import { ModeSwitch, POPUP_MODES } from '../toolbar/mode-switch';
import { HistoryButtons } from './history-buttons';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { LEVEL_ENTRIES, POPUP_ORG } from './tool-area';
import { POPUP_TOOL_SETTINGS } from './tool-button';

const POPUP_SELECTOR = '[data-popup], [data-popup-trigger]';

/** Renders at most one popup: a sheet (compact) or a side panel (expanded). UIX-013, 015 */
@Component({
  selector: 'app-popup-host',
  imports: [FileItem, HistoryButtons, Icon, IconButton, MarkList, ModeSwitch, ToolPopup, TranslocoPipe],
  templateUrl: './popup-host.html',
  styleUrl: './popup-host.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:pointerdown)': 'onOutside($event)',
  },
})
export class PopupHost {
  protected readonly store = inject(UiStore);
  protected readonly view = inject(OrgViewStore);
  protected readonly nav = inject(SlideNavStore);
  protected readonly aspect = inject(AspectRatioService);
  protected readonly session = inject(SessionStore);
  protected readonly preferences = inject(PreferencesStore);
  protected readonly levels = LEVEL_ENTRIES;
  protected readonly ids = {
    overflowBottom: POPUP_OVERFLOW_BOTTOM,
    slider: POPUP_SLIDER,
    org: POPUP_ORG,
    recent: POPUP_RECENT,
    files: POPUP_FILES,
    modes: POPUP_MODES,
    markList: POPUP_MARK_LIST,
    toolSettings: POPUP_TOOL_SETTINGS,
  };
  protected readonly compact = computed(() => this.store.sizeClass() === 'compact');
  protected readonly organization = computed(() => this.store.mode() === 'organization');
  protected readonly annotation = computed(() => this.store.mode() === 'annotation');
  protected readonly sliderDisabled = computed(() =>
    this.organization() ? !this.view.active() : this.annotation() ? !this.nav.canSlide() : this.noDocument(),
  );
  protected readonly sliderMax = computed(() => (this.annotation() ? this.nav.count() : this.view.pageCount()));
  protected readonly sliderValue = computed(() => (this.annotation() ? this.nav.shown() : this.view.currentPage()) + 1);
  protected readonly showMoreDisabled = computed(() => !this.nav.active() || !this.aspect.canShowMore());
  protected readonly showLessDisabled = computed(() => !this.nav.active() || !this.aspect.canShowLess());
  protected readonly noDocument = computed(() => !this.store.hasDocument());
  protected readonly settingsTool = computed<StyledTool | null>(() => {
    const tool = this.store.tool();
    return tool === 'pen' || tool === 'highlighter' ? tool : null;
  });
  /** The file list and the mode choice hang below the top bar across the full width, in every layout. FIL-027, UIX-037 */
  protected readonly below = computed(() => {
    const id = this.store.popup()?.id;
    return id === this.ids.files || id === this.ids.modes;
  });
  protected readonly popupId = computed(() => {
    const id = this.store.popup()?.id;
    if (id === this.ids.markList && !this.compact()) {
      return null; // expanded layouts open the marks list beside its button (ToolArea)
    }
    if (id === this.ids.toolSettings && (this.settingsTool() === null || !this.compact())) {
      return null; // expanded layouts open the settings beside the tool button (ToolButton); no pen/highlighter, no settings
    }
    if (id === this.ids.overflowBottom && !(this.compact() && this.annotation())) {
      return null; // the More menu belongs to the compact annotation layout
    }
    if (id === this.ids.files && this.session.tabs().length === 0) {
      return null; // the last file was closed from the list
    }
    return id !== undefined && Object.values(this.ids).includes(id) ? id : null;
  });

  /** FIL-008: success closes the popup; lost access keeps it open with the entry marked (next tap offers the picker). */
  protected async reopen(ref: FileRef): Promise<void> {
    if ((await this.session.reopenRecent(ref)) === 'opened') {
      this.store.closePopup();
    }
  }

  protected onSlide(event: Event): void {
    const index = Number((event.target as HTMLInputElement).value) - 1;
    if (this.organization()) {
      this.view.goToPage(index, false);
    } else if (this.annotation()) {
      this.nav.scrub(index);
    }
  }

  protected onOutside(event: Event): void {
    const target = event.target;
    if (this.store.popup() && target instanceof Element && !target.closest(POPUP_SELECTOR)) {
      this.store.closePopup();
    }
  }
}
