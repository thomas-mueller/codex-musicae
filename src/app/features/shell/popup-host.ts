import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { APP_VERSION } from '../../ports/app-version';
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
import { POPUP_RECENT } from '../tabs/open-file.directive';
import { POPUP_TABS } from '../tabs/tab-switcher';
import { TabItem } from '../tabs/tab-item';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { LEVEL_ENTRIES, POPUP_ORG } from './tool-area';
import { POPUP_TOOL_SETTINGS } from './tool-button';
import { POPUP_OVERFLOW_TOP } from './top-bar';

export const POPUP_INFO = 'info';
const POPUP_SELECTOR = '[data-popup], [data-popup-trigger]';

/** Renders at most one popup: a sheet (compact) or a side panel (expanded). UIX-013, 015 */
@Component({
  selector: 'app-popup-host',
  imports: [Icon, IconButton, MarkList, TabItem, ToolPopup, TranslocoPipe],
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
  /** SAV-011: save a copy of the active tab, then close the menu. */
  protected saveCopy(): void {
    void this.session.saveCopy();
    this.store.closePopup();
  }

  protected readonly noDocument = computed(() => !this.store.hasDocument());
  protected readonly settingsTool = computed<StyledTool | null>(() => {
    const tool = this.store.tool();
    return tool === 'pen' || tool === 'highlighter' ? tool : null;
  });
  protected readonly popupId = computed(() => {
    const id = this.store.popup()?.id;
    if (id === this.ids.markList && !this.compact()) {
      return null; // expanded layouts open the marks list beside its button (ToolArea)
    }
    if (id === this.ids.toolSettings && (this.settingsTool() === null || !this.compact())) {
      return null; // expanded layouts open the settings beside the tool button (ToolButton); no pen/highlighter, no settings
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
