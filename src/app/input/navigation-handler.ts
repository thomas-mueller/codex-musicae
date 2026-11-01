import { effect, inject, Injectable, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FIT_VIEW } from '../core';
import { AspectRatioService } from '../state/aspect-ratio.service';
import { OrgViewStore } from '../state/org-view.store';
import { SessionStore } from '../state/session.store';
import { UiStore } from '../state/ui.store';
import { CommandBus } from './command-bus';
import type { Command } from './command-bus';

/**
 * Reacts to navigation commands by mode. NAV-001..NAV-005, NAV-015, NAV-017..NAV-019, UIX-018.
 * Zoom, pan and double-tap commands are consumed in S3.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHandler {
  private readonly ui = inject(UiStore);
  private readonly session = inject(SessionStore);
  private readonly org = inject(OrgViewStore);
  private readonly aspect = inject(AspectRatioService);
  private previousMode = this.ui.mode();

  constructor() {
    inject(CommandBus).commands$.pipe(takeUntilDestroyed()).subscribe((command) => this.handle(command));
    // UIX-018: entering presentation, however it happens (command or mode button).
    effect(() => {
      const mode = this.ui.mode();
      untracked(() => {
        if (mode === 'presentation' && this.previousMode !== 'presentation') {
          this.enterPresentation();
        }
        this.previousMode = mode;
      });
    });
  }

  private handle(command: Command): void {
    switch (command.type) {
      case 'Next':
        return this.step(1);
      case 'Previous':
        return this.step(-1);
      case 'First':
        return this.jump('first');
      case 'Last':
        return this.jump('last');
      case 'ToggleMode':
        return this.toggleMode();
      case 'ExitPresentation':
        return this.exitPresentation();
      case 'Back':
        return this.back();
      default:
        return;
    }
  }

  private readyDocument() {
    const doc = this.session.activeDocument();
    return doc?.status() === 'ready' ? doc : null;
  }

  /** NAV-003: clamped, no wrap. NAV-005: organization mode moves by page. */
  private step(direction: 1 | -1): void {
    const mode = this.ui.mode();
    if (mode === 'organization') {
      return direction === 1 ? this.org.next() : this.org.previous();
    }
    const doc = this.readyDocument();
    if (doc && doc.slideCount() > 0) {
      doc.goToSlide(doc.currentSlideIndex() + direction);
    }
  }

  private jump(which: 'first' | 'last'): void {
    if (this.ui.mode() === 'organization') {
      return this.org.goToPage(which === 'first' ? 0 : this.org.pageCount() - 1, true);
    }
    const doc = this.readyDocument();
    if (doc && doc.slideCount() > 0) {
      doc.goToSlide(which === 'first' ? 0 : doc.slideCount() - 1);
    }
  }

  private toggleMode(): void {
    const mode = this.ui.mode();
    if (mode === 'annotation') {
      this.ui.setMode('presentation');
    } else if (mode === 'presentation') {
      this.ui.setMode('annotation');
    }
  }

  private exitPresentation(): void {
    if (this.ui.mode() === 'presentation') {
      this.ui.setMode('annotation');
    }
  }

  /** NAV-018: the first applicable step wins. */
  private back(): void {
    if (this.ui.pendingLevel() !== null) {
      this.ui.cancelLevel();
    } else if (this.ui.popup() !== null) {
      this.ui.closePopup();
    } else if (this.ui.pickingTarget() !== null) {
      this.ui.cancelPicking();
    } else if (this.ui.selection() !== null) {
      this.ui.deselect();
    } else if (this.ui.mode() === 'presentation') {
      this.ui.setMode('annotation');
    }
  }

  private enterPresentation(): void {
    this.ui.setTool(null);
    this.readyDocument()?.slideView.set(FIT_VIEW);
    const { width, height } = this.ui.viewport();
    if (width > 0 && height > 0) {
      void this.aspect.captureForOrientation(width, height);
    }
  }
}
