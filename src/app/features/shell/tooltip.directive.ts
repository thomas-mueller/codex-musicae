import { DestroyRef, Directive, ElementRef, inject, input, Renderer2 } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { TUNABLES } from '../../../config/tunables';

const TOOLTIP_CLASS = 'cm-tooltip';
const BOTTOM_AREA_SELECTOR = '[data-area="bottom"]';

/** Tooltip text `tooltip.<key>` after hover delay (mouse) or long press (touch). UIX-014 */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(pointerenter)': 'onEnter($event)',
    '(pointerleave)': 'hide()',
    '(pointerdown)': 'onDown($event)',
    '(pointerup)': 'hide()',
    '(pointercancel)': 'hide()',
  },
})
export class TooltipDirective {
  readonly appTooltip = input.required<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);
  private readonly transloco = inject(TranslocoService);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private element: HTMLElement | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  protected onEnter(event: Event): void {
    if ((event as PointerEvent).pointerType !== 'touch') {
      this.schedule(TUNABLES.layout.tooltipHoverDelayMs);
    }
  }

  protected onDown(event: Event): void {
    if ((event as PointerEvent).pointerType === 'touch') {
      this.schedule(TUNABLES.layout.longPressMs);
    }
  }

  protected hide(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.element) {
      this.renderer.removeChild(this.host, this.element);
      this.element = undefined;
    }
  }

  private schedule(delayMs: number): void {
    this.hide();
    this.timer = setTimeout(() => this.show(), delayMs);
  }

  private show(): void {
    const element = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(element, TOOLTIP_CLASS);
    this.renderer.setAttribute(element, 'role', 'tooltip');
    if (this.host.closest(BOTTOM_AREA_SELECTOR)) {
      this.renderer.addClass(element, `${TOOLTIP_CLASS}-above`);
    }
    element.textContent = this.transloco.translate(`tooltip.${this.appTooltip()}`);
    this.renderer.appendChild(this.host, element);
    this.element = element;
  }
}
