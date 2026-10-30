import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { UiStore } from '../../state/ui.store';
import { IconButton } from './icon-button';

export const POPUP_OVERFLOW_BOTTOM = 'overflow-bottom';
export const POPUP_SLIDER = 'slider';

/** Navigation, indicator/slider, zoom and overflow, per mode and size class. UIX-004, 005, 006 */
@Component({
  selector: 'app-bottom-bar',
  imports: [IconButton, TranslocoPipe],
  templateUrl: './bottom-bar.html',
  styleUrl: './bars.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomBar {
  protected readonly store = inject(UiStore);
  protected readonly overflowId = POPUP_OVERFLOW_BOTTOM;
  protected readonly sliderId = POPUP_SLIDER;
  protected readonly annotation = computed(() => this.store.mode() === 'annotation');
  protected readonly compact = computed(() => this.store.sizeClass() === 'compact');
  protected readonly noDocument = computed(() => !this.store.hasDocument());
  protected readonly indicatorKey = computed(() => (this.annotation() ? 'slideIndicator' : 'pageIndicator'));
  protected readonly sliderKey = computed(() => (this.annotation() ? 'slideSlider' : 'pageSlider'));
}
