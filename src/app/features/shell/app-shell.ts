import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { UiStore } from '../../state/ui.store';
import { BottomBar } from './bottom-bar';
import { CanvasArea } from './canvas-area';
import { PopupHost } from './popup-host';
import { ToolArea } from './tool-area';
import { TopBar } from './top-bar';
import { ViewportObserverDirective } from './resize-observer.directive';

/** Three-row frame: top bar, canvas, bottom bar; presentation shows the canvas only. UIX-001, UIX-008 */
@Component({
  selector: 'app-shell',
  imports: [BottomBar, CanvasArea, PopupHost, ToolArea, TopBar],
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
