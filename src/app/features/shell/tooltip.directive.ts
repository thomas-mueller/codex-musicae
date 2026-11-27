import { DestroyRef, Directive, ElementRef, inject, input, Renderer2 } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { TUNABLES } from '../../../config/tunables';
import { placeTooltip } from '../../core';
import type { Edges } from '../../core';

const TOOLTIP_CLASS = 'cm-tooltip';
const SAFE_AREA_CLASS = 'cm-safe-area';
/** On the control while its tooltip is shown: a dimmed control must then dim its icon only (see icon-button.css). */
const OPEN_CLASS = 'cm-tooltip-open';
const BOTTOM_AREA_SELECTOR = '[data-area="bottom"]';

/**
 * Tooltip text `tooltip.<key>` after hover delay (mouse) or long press (touch), below the control (above it in the bottom
 * bar), always inside the screen. The element is a child of the control but fixed to the window, so a container that
 * clips its content does not cut it off. UIX-014, UIX-027, UIX-028
 */
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
      this.renderer.removeClass(this.host, OPEN_CLASS);
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
    element.textContent = this.transloco.translate(`tooltip.${this.appTooltip()}`);
    this.renderer.addClass(this.host, OPEN_CLASS);
    this.renderer.appendChild(this.host, element);
    this.element = element;
    this.place(element);
  }

  private place(element: HTMLElement): void {
    const move = (left: number, top: number): void => {
      this.renderer.setStyle(element, 'left', `${left}px`);
      this.renderer.setStyle(element, 'top', `${top}px`);
    };
    move(0, 0); // measured where nothing narrows it
    const side = this.host.closest(BOTTOM_AREA_SELECTOR) ? 'above' : 'below';
    const position = placeTooltip(this.host.getBoundingClientRect(), element.getBoundingClientRect(), this.screen(), side, TUNABLES.layout.tooltipEdgeGapPx);
    move(position.left, position.top);
    // An ancestor with a transform becomes the reference of a fixed element: correct by what it shifted.
    const placed = element.getBoundingClientRect();
    move(2 * position.left - placed.left, 2 * position.top - placed.top);
  }

  /**
   * The window without its safe-area insets (notch, home indicator), measured with a probe that CSS lays out.
   * UNVERIFIED(ios): the insets are zero in every browser the tests run in.
   */
  private screen(): Edges {
    const body = this.host.ownerDocument.body;
    const probe = this.renderer.createElement('div') as HTMLElement;
    this.renderer.addClass(probe, SAFE_AREA_CLASS);
    this.renderer.appendChild(body, probe);
    const { left, top, right, bottom } = probe.getBoundingClientRect();
    this.renderer.removeChild(body, probe);
    return { left, top, right, bottom };
  }
}
