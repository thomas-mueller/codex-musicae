import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { OrgViewStore } from '../../state/org-view.store';
import { TUNABLES } from '../../../config/tunables';
import { UiStore } from '../../state/ui.store';
import { Icon } from './icon';
import { IconButton } from './icon-button';

export const POPUP_OVERFLOW_BOTTOM = 'overflow-bottom';
export const POPUP_SLIDER = 'slider';

/** Navigation, indicator/slider, zoom and overflow, per mode and size class. UIX-004, 005, 006 */
@Component({
  selector: 'app-bottom-bar',
  imports: [Icon, IconButton, TranslocoPipe],
  templateUrl: './bottom-bar.html',
  styleUrl: './bars.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomBar {
  protected readonly store = inject(UiStore);
  protected readonly view = inject(OrgViewStore);
  protected readonly overflowId = POPUP_OVERFLOW_BOTTOM;
  protected readonly sliderId = POPUP_SLIDER;
  protected readonly annotation = computed(() => this.store.mode() === 'annotation');
  protected readonly compact = computed(() => this.store.sizeClass() === 'compact');
  protected readonly noDocument = computed(() => !this.store.hasDocument());
  protected readonly indicatorKey = computed(() => (this.annotation() ? 'slideIndicator' : 'pageIndicator'));
  protected readonly sliderKey = computed(() => (this.annotation() ? 'slideSlider' : 'pageSlider'));

  /** ORG-006: in organization mode the controls follow the page view; the other modes keep the document gating. */
  protected readonly organization = computed(() => this.store.mode() === 'organization');
  protected readonly previousDisabled = computed(() => (this.organization() ? !this.view.canPrevious() : this.noDocument()));
  protected readonly nextDisabled = computed(() => (this.organization() ? !this.view.canNext() : this.noDocument()));
  protected readonly zoomOutDisabled = computed(() => (this.organization() ? !this.view.canZoomOut() : this.noDocument()));
  protected readonly zoomInDisabled = computed(() => (this.organization() ? !this.view.canZoomIn() : this.noDocument()));
  protected readonly zoomResetDisabled = computed(() => (this.organization() ? !this.view.active() : this.noDocument()));
  protected readonly sliderDisabled = computed(() => (this.organization() ? !this.view.active() : this.noDocument()));
  /** ORG-004: "x / n", empty (CSS placeholder) when there is nothing to show. */
  protected readonly indicatorText = computed(() => {
    const page = this.view.currentPage();
    return this.organization() && this.view.active() && page >= 0
      ? `${page + 1}${TUNABLES.layout.indicatorSeparator}${this.view.pageCount()}`
      : '';
  });

  /** DET-016: "processed/total" while detection of the active document is running; empty text means hidden. */
  protected readonly progressText = computed(() => {
    const doc = this.view.document();
    if (!this.organization() || !doc || doc.detectionComplete()) {
      return '';
    }
    const { done, total } = doc.detectionProgress();
    return `${done}${TUNABLES.layout.progressSeparator}${total}`;
  });

  protected onSlide(event: Event): void {
    this.view.goToPage(Number((event.target as HTMLInputElement).value) - 1, false);
  }
}
