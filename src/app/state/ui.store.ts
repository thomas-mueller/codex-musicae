import { computed, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { sizeClassOf } from '../core';

export type Mode = 'organization' | 'annotation' | 'presentation';
export type Tool = 'pen' | 'highlighter' | 'eraser';
export interface Popup {
  readonly id: string;
}
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** Global UI state: mode, tool, popup, viewport. UIX-001, UIX-003 */
@Injectable({ providedIn: 'root' })
export class UiStore {
  readonly mode = signal<Mode>('annotation');
  readonly tool = signal<Tool | null>(null);
  readonly popup = signal<Popup | null>(null);
  /** Set by the shell's resize observer; unmeasured (0x0) until its first callback. */
  readonly viewport = signal<Viewport>({ width: 0, height: 0 });

  readonly sizeClass = computed(() =>
    sizeClassOf(this.viewport().width, this.viewport().height, TUNABLES.layout),
  );

  setMode(mode: Mode): void {
    this.mode.set(mode);
    if (mode !== 'annotation') {
      this.tool.set(null);
    }
  }

  setTool(tool: Tool | null): void {
    this.tool.set(tool);
  }

  openPopup(id: string): void {
    this.popup.set({ id });
  }

  closePopup(): void {
    this.popup.set(null);
  }

  setViewport(width: number, height: number): void {
    this.viewport.set({ width, height });
  }
}
