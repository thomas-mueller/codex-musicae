import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { IconButton } from '../shell/icon-button';
import { TabItem } from './tab-item';
import { POPUP_TABS } from './tab-switcher';

/**
 * Expanded layout: tabs share the width like browser tabs and shrink as more are opened, names truncate.
 * Only when even the minimum width does not fit, one extra button opens the list of all tabs. FIL-004
 */
@Component({
  selector: 'app-tab-bar',
  imports: [IconButton, TabItem],
  template: `
    <div #tabs class="tabs" role="tablist">
      @for (tab of session.tabs(); track tab.id) {
        <app-tab-item [tab]="tab" [active]="tab.id === session.activeTabId()" />
      }
    </div>
    @if (overflowing()) {
      <button
        appIconButton
        data-popup-trigger
        icon="overflow"
        labelKey="tabList"
        [toggled]="ui.popup()?.id === popupId"
        (pressed)="ui.togglePopup(popupId)"
      ></button>
    }
  `,
  styles: `
    :host { display: flex; align-items: center; width: 100%; min-width: 0; }
    .tabs { display: flex; flex: 1; align-items: flex-end; min-width: 0; overflow: hidden; }
    button { flex: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabBar {
  protected readonly session = inject(SessionStore);
  protected readonly ui = inject(UiStore);
  protected readonly popupId = POPUP_TABS;
  protected readonly overflowing = signal(false);
  private readonly tabs = viewChild.required<ElementRef<HTMLElement>>('tabs');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.tabs().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    afterRenderEffect(() => {
      this.session.tabs();
      const active = this.session.activeTabId();
      this.measure();
      if (this.overflowing() && active) {
        this.tabs().nativeElement.querySelector('.active')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
      }
    });
  }

  private measure(): void {
    const el = this.tabs().nativeElement;
    this.overflowing.set(el.scrollWidth > el.clientWidth);
  }
}
