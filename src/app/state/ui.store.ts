import { computed, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { sizeClassOf } from '../core';

export type Mode = 'organization' | 'annotation' | 'presentation';
export type DetectionLevel = keyof typeof TUNABLES.detection.levels;
export type Tool = 'pen' | 'highlighter' | 'eraser';
export interface Popup {
  readonly id: string;
}
/** What organization mode has selected: a junction (both bars of a page change) or a jump badge (S3). ORG-013 */
export type Selection =
  | { readonly kind: 'junction'; readonly junction: number }
  | { readonly kind: 'jump'; readonly id: number };
/** ORG-015: the user is choosing the target bar of a new jump, or of `editJumpId` (change target). */
export interface PickingTarget {
  readonly originJunction: number;
  readonly editJumpId?: number;
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
  /** Selected detection level (organization mode). DET-013 */
  readonly level = signal<DetectionLevel>(TUNABLES.detection.defaultLevel);
  readonly popup = signal<Popup | null>(null);
  readonly selection = signal<Selection | null>(null);
  readonly pickingTarget = signal<PickingTarget | null>(null);
  /** Set by the shell's resize observer; unmeasured (0x0) until its first callback. */
  /** Placeholder until the DocumentStore (M8): no document can be open yet. FIL-007 */
  readonly hasDocument = signal(false);
  readonly viewport = signal<Viewport>({ width: 0, height: 0 });

  readonly sizeClass = computed(() =>
    sizeClassOf(this.viewport().width, this.viewport().height, TUNABLES.layout),
  );

  setMode(mode: Mode): void {
    if (mode === 'presentation' && !this.hasDocument()) {
      return;
    }
    this.mode.set(mode);
    this.selection.set(null);
    this.pickingTarget.set(null);
    if (mode !== 'annotation') {
      this.tool.set(null);
    }
  }

  setTool(tool: Tool | null): void {
    this.tool.set(tool);
  }

  /** Tapping the active tool deactivates it; tools need a document and annotation mode. FIL-007, ANN-007 */
  toggleTool(tool: Tool): void {
    if (!this.hasDocument() || this.mode() !== 'annotation') {
      return;
    }
    this.tool.set(this.tool() === tool ? null : tool);
  }

  setLevel(level: DetectionLevel): void {
    if (this.hasDocument()) {
      this.level.set(level);
    }
  }

  select(selection: Selection): void {
    this.selection.set(selection);
  }

  deselect(): void {
    this.selection.set(null);
  }

  startPicking(target: PickingTarget): void {
    this.pickingTarget.set(target);
  }

  cancelPicking(): void {
    this.pickingTarget.set(null);
  }

  togglePopup(id: string): void {
    this.popup.set(this.popup()?.id === id ? null : { id });
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
