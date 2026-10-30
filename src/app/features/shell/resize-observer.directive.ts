import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

import { UiStore } from '../../state/ui.store';

/** Reports the host element's size to UiStore.viewport. UIX-003 */
@Directive({ selector: '[appViewportObserver]' })
export class ViewportObserverDirective {
  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const store = inject(UiStore);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      store.setViewport(host.clientWidth, host.clientHeight);
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => store.setViewport(host.clientWidth, host.clientHeight));
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
