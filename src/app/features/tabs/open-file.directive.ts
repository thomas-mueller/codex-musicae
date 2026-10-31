import { DestroyRef, Directive, inject } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';

export const POPUP_RECENT = 'recent';

/**
 * The open-file control: tap opens the picker, long press or right-click opens the recent files. FIL-001, FIL-008
 * The picker is started from the click handler itself so the browser still sees the user gesture.
 */
@Directive({
  selector: '[appOpenFile]',
  host: {
    '(pointerdown)': 'onDown($event)',
    '(pointerup)': 'onUp($event)',
    '(pointerleave)': 'cancelTimer()',
    '(pointercancel)': 'cancelTimer()',
    '(click)': 'onClick()',
    '(contextmenu)': 'onContextMenu($event)',
  },
})
export class OpenFileDirective {
  private readonly session = inject(SessionStore);
  private readonly ui = inject(UiStore);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private longPressed = false;
  private downAt = 0;
  private upAt = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelTimer());
  }

  protected onDown(event: Event): void {
    this.longPressed = false;
    this.downAt = event.timeStamp;
    this.upAt = event.timeStamp;
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.longPressed = true;
      this.ui.openPopup(POPUP_RECENT);
    }, TUNABLES.layout.longPressMs);
  }

  protected onUp(event: Event): void {
    this.upAt = event.timeStamp;
    this.cancelTimer();
  }

  protected cancelTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /**
   * The press length comes from the event time stamps, not from the timer: a busy main thread (rendering) can
   * fire the timer before a quick release is handled, and that tap must still open the picker.
   */
  protected onClick(): void {
    const heldMs = this.upAt - this.downAt;
    if (this.longPressed && heldMs >= TUNABLES.layout.longPressMs) {
      this.longPressed = false;
      return;
    }
    if (this.longPressed) {
      this.longPressed = false;
      this.ui.closePopup();
    }
    void this.session.pickAndOpen();
  }

  protected onContextMenu(event: Event): void {
    event.preventDefault();
    this.ui.openPopup(POPUP_RECENT);
  }
}
