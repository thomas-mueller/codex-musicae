import { DestroyRef, Directive, inject, output } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';

/**
 * ORG-019: emits `longPress` after `T:layout.longPressMs` of holding still (moving more than `T:gestures.tapMaxMovePx`
 * cancels, as does a pointer cancel such as the start of a scroll). The click that follows a long press must be
 * ignored by the host: it asks `consumeClick()`, which is true once per long press.
 */
@Directive({
  selector: '[appLongPress]',
  exportAs: 'appLongPress',
  host: {
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'cancel()',
    '(pointercancel)': 'cancel()',
    '(contextmenu)': '$event.preventDefault()',
  },
})
export class LongPressDirective {
  readonly longPress = output<void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private fired = false;
  private startX = 0;
  private startY = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  consumeClick(): boolean {
    const was = this.fired;
    this.fired = false;
    return was;
  }

  protected onDown(event: PointerEvent): void {
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.fired = false;
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.fired = true;
      this.longPress.emit();
    }, TUNABLES.layout.longPressMs);
  }

  protected onMove(event: PointerEvent): void {
    if (Math.hypot(event.clientX - this.startX, event.clientY - this.startY) > TUNABLES.gestures.tapMaxMovePx) {
      this.cancel();
    }
  }

  protected cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
