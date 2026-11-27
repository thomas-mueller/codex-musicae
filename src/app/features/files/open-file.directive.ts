import { DestroyRef, Directive, inject } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import { FEATURE_FLAGS } from '../../ports/feature-flags';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';

export const POPUP_RECENT = 'recent';

/**
 * The open-file control: tap opens the picker, a long press (or holding the mouse button) opens the recent files. With recent
 * files switched off a long press counts as a tap. No right-click action. FIL-001, FIL-025, FIL-026, UIX-022
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
    '(contextmenu)': '$event.preventDefault()',
  },
})
export class OpenFileDirective {
  private readonly session = inject(SessionStore);
  private readonly ui = inject(UiStore);
  private readonly flags = inject(FEATURE_FLAGS);
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
    if ((event as PointerEvent).button > 0 || !this.flags.recentFiles) {
      return;
    }
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
}
