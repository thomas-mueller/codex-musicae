import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { UiStore } from '../../state/ui.store';
import { CanvasArea } from './canvas-area';
import { ViewportObserverDirective } from './resize-observer.directive';

/** Three-row frame: top bar, canvas, bottom bar; presentation shows the canvas only. UIX-001, UIX-008 */
@Component({
  selector: 'app-shell',
  imports: [CanvasArea],
  hostDirectives: [ViewportObserverDirective],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-mode]': 'store.mode()',
    '[attr.data-size-class]': 'store.sizeClass()',
  },
})
export class AppShell {
  protected readonly store = inject(UiStore);
  protected readonly presentation = computed(() => this.store.mode() === 'presentation');
}
