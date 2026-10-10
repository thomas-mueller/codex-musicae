import { Component, HostListener, input, linkedSignal, output } from '@angular/core';

@Component({
  selector: 'app-pdf-canvas-stage',
  standalone: true,
  templateUrl: './pdf-canvas-stage.html',
  styleUrl: './pdf-canvas-stage.css',
})
export class PdfCanvasStage {
  readonly controlsVisibleInitially = input(true);
  readonly escapeWhileHidden = output<void>();
  readonly controlsVisible = linkedSignal(() => this.controlsVisibleInitially());

  onStageClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('[stage-controls]')) {
      return;
    }
    this.toggleControls();
  }

  toggleControls(): void {
    this.controlsVisible.update((visible) => !visible);
  }

  hideControls(): void {
    this.controlsVisible.set(false);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
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
    if (
      event.key.toLowerCase() !== 'c' ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.defaultPrevented
    ) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    event.preventDefault();
    this.toggleControls();
  }
}
