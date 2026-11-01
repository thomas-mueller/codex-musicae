import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { AspectRatioService } from '../../state/aspect-ratio.service';
import { OrgViewStore } from '../../state/org-view.store';
import { TUNABLES } from '../../../config/tunables';
import { SlideNavStore } from '../../state/slide-nav.store';
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
  protected readonly nav = inject(SlideNavStore);
  protected readonly aspect = inject(AspectRatioService);
  protected readonly overflowId = POPUP_OVERFLOW_BOTTOM;
  protected readonly sliderId = POPUP_SLIDER;
  protected readonly annotation = computed(() => this.store.mode() === 'annotation');
  protected readonly compact = computed(() => this.store.sizeClass() === 'compact');
  protected readonly noDocument = computed(() => !this.store.hasDocument());
  protected readonly indicatorKey = computed(() => (this.annotation() ? 'slideIndicator' : 'pageIndicator'));
  protected readonly sliderKey = computed(() => (this.annotation() ? 'slideSlider' : 'pageSlider'));

  /** ORG-006: in organization mode the controls follow the page view; the other modes keep the document gating. */
  protected readonly organization = computed(() => this.store.mode() === 'organization');
  protected readonly previousDisabled = computed(() => this.byMode(!this.view.canPrevious(), !this.nav.canPrevious()));
  protected readonly nextDisabled = computed(() => this.byMode(!this.view.canNext(), !this.nav.canNext()));
  protected readonly zoomOutDisabled = computed(() => (this.organization() ? !this.view.canZoomOut() : this.noDocument()));
  protected readonly zoomInDisabled = computed(() => (this.organization() ? !this.view.canZoomIn() : this.noDocument()));
  protected readonly zoomResetDisabled = computed(() => (this.organization() ? !this.view.active() : this.noDocument()));
  protected readonly sliderDisabled = computed(() => this.byMode(!this.view.active(), !this.nav.canSlide()));
  protected readonly sliderMax = computed(() => (this.annotation() ? this.nav.count() : this.view.pageCount()));
  protected readonly sliderValue = computed(() => (this.annotation() ? this.nav.shown() : this.view.currentPage()) + 1);
  /** SLD-013, SLD-017: disabled when the step would not change the ratio. */
  protected readonly showMoreDisabled = computed(() => !this.nav.active() || !this.aspect.canShowMore());
  protected readonly showLessDisabled = computed(() => !this.nav.active() || !this.aspect.canShowLess());
  /** ORG-004, SLD-016: "x / n" (annotation: "x / n+" while detection runs), empty when there is nothing to show. */
  protected readonly indicatorText = computed(() => {
    if (this.annotation()) {
      return this.nav.indicatorText();
    }
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

  protected onPrevious(): void {
    return this.annotation() ? this.nav.previous() : this.view.previous();
  }

  protected onNext(): void {
    return this.annotation() ? this.nav.next() : this.view.next();
  }

  protected onSlide(event: Event): void {
    const index = Number((event.target as HTMLInputElement).value) - 1;
    return this.annotation() ? this.nav.scrub(index) : this.view.goToPage(index, false);
  }

  /** Organization mode follows the page view; the other modes keep the document gating (annotation: the slide model). */
  private byMode(organization: boolean, annotation: boolean): boolean {
    if (this.organization()) {
      return organization;
    }
    return this.annotation() ? annotation : this.noDocument();
  }
}
