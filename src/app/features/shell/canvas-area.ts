import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PagePreview } from './page-preview';

/** Middle row: canvas grey with the page preview (until the organization viewer, M9). GEN-008 */
@Component({
  selector: 'app-canvas-area',
  imports: [PagePreview],
  template: '<div class="content"><app-page-preview /></div>',
  styles: `
    :host { display: block; min-height: 0; min-width: 0; background: var(--cm-canvas-grey); }
    .content { width: 100%; height: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasArea {}
