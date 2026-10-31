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
    '(pointerdown)': 'onDown()',
    '(pointerup)': 'cancelTimer()',
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

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelTimer());
  }

  protected onDown(): void {
    this.longPressed = false;
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.longPressed = true;
      this.ui.openPopup(POPUP_RECENT);
    }, TUNABLES.layout.longPressMs);
  }

  protected cancelTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  protected onClick(): void {
    if (this.longPressed) {
      this.longPressed = false;
      return;
    }
    void this.session.pickAndOpen();
  }

  protected onContextMenu(event: Event): void {
    event.preventDefault();
    this.ui.openPopup(POPUP_RECENT);
  }
}
