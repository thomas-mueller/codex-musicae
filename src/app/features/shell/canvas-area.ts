import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { OrganizationViewer } from '../organization/organization-viewer';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { PagePreview } from './page-preview';

/** Middle row: canvas grey with the organization viewer; other modes show the page preview until their milestones. GEN-008 */
@Component({
  selector: 'app-canvas-area',
  imports: [OrganizationViewer, PagePreview],
  template: `
    <div class="content">
      @if (organizationDocument(); as doc) {
        <app-organization-viewer [document]="doc" />
      } @else {
        <app-page-preview />
      }
    </div>
  `,
  styles: `
    :host { display: block; min-height: 0; min-width: 0; background: var(--cm-canvas-grey); }
    .content { width: 100%; height: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasArea {
  private readonly session = inject(SessionStore);
  private readonly ui = inject(UiStore);

  /** ORG-001: the viewer is shown in organization mode while the active tab is ready. */
  protected readonly organizationDocument = computed(() => {
    const doc = this.session.activeDocument();
    return this.ui.mode() === 'organization' && doc?.status() === 'ready' ? doc : null;
  });
}
