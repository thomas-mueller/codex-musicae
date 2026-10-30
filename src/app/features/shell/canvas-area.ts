import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Middle row: canvas grey, placeholder for later content. GEN-008 */
@Component({
  selector: 'app-canvas-area',
  template: '<div class="content"></div>',
  styles: `
    :host { display: block; min-height: 0; min-width: 0; background: var(--cm-canvas-grey); }
    .content { width: 100%; height: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasArea {}
