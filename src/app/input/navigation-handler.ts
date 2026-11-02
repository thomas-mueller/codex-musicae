import { DestroyRef, effect, inject, Injectable, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FIT_VIEW } from '../core';
import { AspectRatioService } from '../state/aspect-ratio.service';
import { OrgViewStore } from '../state/org-view.store';
import { PresentationPlatform } from '../state/presentation-platform';
import { SessionStore } from '../state/session.store';
import { StrokeGate } from '../state/stroke-gate';
import { UiStore } from '../state/ui.store';
import { SlideNavStore } from '../state/slide-nav.store';
import { CommandBus } from './command-bus';
import type { Command, Point } from './command-bus';

/**
 * Reacts to navigation commands by mode. NAV-001..NAV-005, NAV-015, NAV-017..NAV-019, UIX-018.
 * Zoom, pan and double-tap commands follow the mode: NAV-013, NAV-014, NAV-016, NAV-017.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHandler {
  private readonly ui = inject(UiStore);
  private readonly session = inject(SessionStore);
  private readonly org = inject(OrgViewStore);
  private readonly slideNav = inject(SlideNavStore);
  private readonly aspect = inject(AspectRatioService);
  private readonly gate = inject(StrokeGate);
  private previousMode = this.ui.mode();

  constructor() {
    const bus = inject(CommandBus);
    bus.commands$.pipe(takeUntilDestroyed()).subscribe((command) => this.handle(command));
    // PLT-004: Esc or a system gesture left fullscreen; presentation mode ends with it.
    const stopExternalExit = inject(PresentationPlatform).onExternalExit(() => bus.dispatch({ type: 'ExitPresentation' }));
    inject(DestroyRef).onDestroy(stopExternalExit);
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
      // ANN-013: while a stroke is in progress these wait until it has ended.
      case 'Next':
        return this.gate.run(() => this.step(1));
      case 'Previous':
        return this.gate.run(() => this.step(-1));
      case 'First':
        return this.gate.run(() => this.jump('first'));
      case 'Last':
        return this.gate.run(() => this.jump('last'));
      case 'ToggleMode':
        return this.toggleMode();
      case 'ExitPresentation':
        return this.exitPresentation();
      case 'Back':
        return this.back();
      case 'ZoomBy':
        return this.zoomBy(command.factor, command.anchor);
      case 'ZoomReset':
        return this.zoomReset();
      case 'Pan':
        return this.pan(command.dx, command.dy);
      case 'DoubleTapZoom':
        return this.doubleTapZoom(command.anchor);
    }
  }

  /** NAV-017: presentation mode is always at fit scale, so zoom and pan commands are ignored there. */
  private zoomBy(factor: number, anchor: Point): void {
    const mode = this.ui.mode();
    if (mode === 'annotation') {
      this.slideNav.zoomAt(factor, anchor);
    } else if (mode === 'organization') {
      this.org.zoomAt(factor, anchor);
    }
  }

  private zoomReset(): void {
    const mode = this.ui.mode();
    if (mode === 'annotation') {
      this.slideNav.zoomReset();
    } else if (mode === 'organization') {
      this.org.zoomReset();
    }
  }

  /** Organization mode scrolls natively, so only the slide view is panned here. */
  private pan(dx: number, dy: number): void {
    if (this.ui.mode() === 'annotation') {
      this.slideNav.panBy(dx, dy);
    }
  }

  /** NAV-016: a double tap zooms in organization mode only; in annotation mode it would delay the tap zones. */
  private doubleTapZoom(anchor: Point): void {
    if (this.ui.mode() === 'organization') {
      this.org.toggleDoubleTapZoom(anchor);
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
