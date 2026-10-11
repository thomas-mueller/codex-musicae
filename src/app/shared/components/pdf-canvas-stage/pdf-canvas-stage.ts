import { Component, ElementRef, HostListener, ViewChild, input, linkedSignal, output } from '@angular/core';

export type PageNavigationAction = 'previous' | 'next' | 'first' | 'last';

@Component({
  selector: 'app-pdf-canvas-stage',
  standalone: true,
  templateUrl: './pdf-canvas-stage.html',
  styleUrl: './pdf-canvas-stage.css',
})
export class PdfCanvasStage {
  readonly controlsVisibleInitially = input(true);
  readonly presentationMode = input(false);
  readonly escapeWhileHidden = output<void>();
  readonly exitPresentation = output<void>();
  readonly navigate = output<PageNavigationAction>();
  readonly controlsVisible = linkedSignal(() => this.controlsVisibleInitially());
  private pointerStart?: { x: number; y: number; pointerId: number };
  private readonly swipeThreshold = 50;
  private readonly verticalSwipeTolerance = 35;
  @ViewChild('topBar') private readonly topBarRef?: ElementRef<HTMLElement>;
  @ViewChild('bottomBar') private readonly bottomBarRef?: ElementRef<HTMLElement>;

  onStageClick(event: MouseEvent): void {
    const target = event.target;
    if (this.isInteractiveTarget(target)) {
      return;
    }

    const stage = event.currentTarget as HTMLElement;
    const bounds = stage.getBoundingClientRect();
    const topBarHeight = this.topBarRef?.nativeElement.offsetHeight || 44;
    const bottomBarHeight = this.bottomBarRef?.nativeElement.offsetHeight || 44;
    const y = event.clientY - bounds.top;
    if (y <= topBarHeight || y >= bounds.height - bottomBarHeight) {
      this.toggleControls();
      return;
    }

    if (event.clientX < bounds.left + bounds.width / 2) {
      this.navigate.emit('previous');
    } else {
      this.navigate.emit('next');
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || this.isControlTarget(event.target)) {
      this.pointerStart = undefined;
      return;
    }
    const stage = event.currentTarget as HTMLElement;
    stage.setPointerCapture?.(event.pointerId);
    this.pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  }

  onPointerUp(event: PointerEvent): void {
    const start = this.pointerStart;
    this.pointerStart = undefined;
    this.releasePointerCapture(event);
    if (!start || start.pointerId !== event.pointerId || this.isControlTarget(event.target)) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < this.swipeThreshold || Math.abs(deltaY) > this.verticalSwipeTolerance || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    event.preventDefault();
    this.navigate.emit(deltaX < 0 ? 'next' : 'previous');
  }

  onPointerCancel(event?: PointerEvent): void {
    this.pointerStart = undefined;
    if (event) this.releasePointerCapture(event);
  }

  private releasePointerCapture(event: PointerEvent): void {
    const stage = event.currentTarget as HTMLElement;
    if (stage.hasPointerCapture?.(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }
  }

  private isControlTarget(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('.controls-bar, [stage-controls], [stage-top-controls], [stage-bottom-controls]');
  }

  private isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('button, input, select, textarea, label, [role="button"], a');
  }

  toggleControls(): void {
    this.controlsVisible.update((visible) => !visible);
  }

  hideControls(): void {
    this.controlsVisible.set(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.presentationMode()) {
      event.preventDefault();
      event.stopPropagation();
      this.exitPresentation.emit();
      return;
    }
    if (this.controlsVisible()) {
      this.hideControls();
      event.preventDefault();
      event.stopPropagation();
    } else {
      this.escapeWhileHidden.emit();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onToggleShortcut(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    const key = event.key.toLowerCase();
    if (this.presentationMode() && key === 'backspace') {
      event.preventDefault();
      this.exitPresentation.emit();
      return;
    }
    if (key === 'c') {
      event.preventDefault();
      this.toggleControls();
      return;
    }

    const actions: Record<string, PageNavigationAction> = {
      arrowleft: 'previous', arrowup: 'previous', pageup: 'previous', backspace: 'previous',
      arrowright: 'next', arrowdown: 'next', pagedown: 'next', ' ': 'next',
      home: 'first', end: 'last',
    };
    const action = actions[key];
    if (action) {
      event.preventDefault();
      this.navigate.emit(action);
    }
  }
}
