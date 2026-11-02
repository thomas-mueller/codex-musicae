import { computed, inject, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { sizeClassOf } from '../core';
import { PresentationPlatform } from './presentation-platform';

export type Mode = 'organization' | 'annotation' | 'presentation';
export type DetectionLevel = keyof typeof TUNABLES.detection.levels;
export type Tool = 'pen' | 'highlighter' | 'eraser';
export interface Popup {
  readonly id: string;
}
/** What organization mode has selected: a junction (both bars of a page change) or a jump (its markers). ORG-013, ORG-020 */
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
  private readonly platform = inject(PresentationPlatform);
  readonly mode = signal<Mode>('annotation');
  readonly tool = signal<Tool | null>(null);
  readonly popup = signal<Popup | null>(null);
  readonly selection = signal<Selection | null>(null);
  readonly pickingTarget = signal<PickingTarget | null>(null);
  /** DET-014: the level the user chose and has not yet confirmed (the dialog is open while it is set). */
  readonly pendingLevel = signal<DetectionLevel | null>(null);
  /** Set by the shell's resize observer; unmeasured (0x0) until its first callback. */
  /** Placeholder until the DocumentStore (M8): no document can be open yet. FIL-007 */
  readonly hasDocument = signal(false);
  /** ANN-013: true between the start and the end of a stroke; mirrors the active document's `changes` (set by the shell). */
  readonly strokeInProgress = signal(false);
  readonly viewport = signal<Viewport>({ width: 0, height: 0 });

  readonly sizeClass = computed(() =>
    sizeClassOf(this.viewport().width, this.viewport().height, TUNABLES.layout),
  );

  setMode(mode: Mode): void {
    if (mode === 'presentation' && !this.hasDocument()) {
      return;
    }
    const previous = this.mode();
    this.mode.set(mode);
    // PLT-004, PLT-005: synchronous, because the browser demands the user gesture that is still running.
    if (mode === 'presentation' && previous !== 'presentation') {
      this.platform.enter();
    } else if (mode !== 'presentation' && previous === 'presentation') {
      this.platform.leave();
    }
    this.selection.set(null);
    this.pickingTarget.set(null);
    this.pendingLevel.set(null);
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

  /** DET-014: asks for confirmation; nothing changes before it. */
  requestLevel(level: DetectionLevel): void {
    if (this.hasDocument()) {
      this.pendingLevel.set(level);
    }
  }

  cancelLevel(): void {
    this.pendingLevel.set(null);
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
