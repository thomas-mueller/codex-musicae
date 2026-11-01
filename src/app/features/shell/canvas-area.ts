import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { PointerStage } from '../../input/pointer-input';
import { OrganizationViewer } from '../organization/organization-viewer';
import { PresentationView } from '../presentation/presentation-view';
import { SlideView } from '../slides/slide-view';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';

/** Middle row: canvas grey with the organization viewer or the slide view; presentation shows the stage only. GEN-008 */
@Component({
  selector: 'app-canvas-area',
  imports: [OrganizationViewer, PointerStage, PresentationView, SlideView],
  template: `
    <div class="content" appPointerStage>
      @if (organizationDocument(); as doc) {
        <app-organization-viewer [document]="doc" />
      }
      @if (annotationDocument(); as doc) {
        <app-slide-view [document]="doc" />
      }
      @if (presentationDocument(); as doc) {
        <app-presentation-view [document]="doc" />
      }
    </div>
  `,
  styles: `
    :host { display: block; min-height: 0; min-width: 0; background: var(--cm-canvas-grey); isolation: isolate; }
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

  /** SLD-007: annotation mode shows the current slide while the active tab is ready. */
  protected readonly annotationDocument = computed(() => {
    const doc = this.session.activeDocument();
    return this.ui.mode() === 'annotation' && doc?.status() === 'ready' ? doc : null;
  });

  /** UIX-009: presentation mode shows the slide stage only. */
  protected readonly presentationDocument = computed(() => {
    const doc = this.session.activeDocument();
    return this.ui.mode() === 'presentation' && doc?.status() === 'ready' ? doc : null;
  });
}
