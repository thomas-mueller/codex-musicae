import { inject, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { PREFERENCES } from '../ports/preferences';
import type { Tool } from './ui.store';

export type StyledTool = Exclude<Tool, 'eraser'>;

export interface ToolSetting {
  readonly color: string;
  readonly widthIndex: number;
}

/** What a stroke of the tool looks like. ANN-004 */
export interface StrokeStyle {
  readonly color: string;
  readonly widthPt: number;
  readonly opacity: number;
  readonly multiply: boolean;
}

const KEYS = { pen: 'tool.pen', highlighter: 'tool.highlighter' } as const;

export function toolPresets(tool: StyledTool): readonly string[] {
  return tool === 'pen' ? TUNABLES.colors.penPresets : TUNABLES.colors.highlighterPresets;
}

export function toolWidths(tool: StyledTool): readonly number[] {
  return tool === 'pen' ? TUNABLES.annotation.penWidthsPt : TUNABLES.annotation.highlighterWidthsPt;
}

function defaultSetting(tool: StyledTool): ToolSetting {
  return tool === 'pen' ? TUNABLES.annotation.defaultPen : TUNABLES.annotation.defaultHighlighter;
}

function isValidColor(tool: StyledTool, color: unknown): color is string {
  return typeof color === 'string' && toolPresets(tool).includes(color);
}

function isValidWidthIndex(tool: StyledTool, index: unknown): index is number {
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < toolWidths(tool).length;
}

/** Invalid parts of a stored value fall back to the default. */
function validated(tool: StyledTool, stored: unknown): ToolSetting {
  const fallback = defaultSetting(tool);
  const value = typeof stored === 'object' && stored !== null ? (stored as Partial<Record<keyof ToolSetting, unknown>>) : {};
  return {
    color: isValidColor(tool, value.color) ? value.color : fallback.color,
    widthIndex: isValidWidthIndex(tool, value.widthIndex) ? value.widthIndex : fallback.widthIndex,
  };
}

/** Color and width index of the pen and the highlighter, remembered across sessions. ANN-003, ANN-004 */
@Injectable({ providedIn: 'root' })
export class ToolSettingsStore {
  private readonly preferences = inject(PREFERENCES);
  private readonly penSignal = signal<ToolSetting>(defaultSetting('pen'));
  private readonly highlighterSignal = signal<ToolSetting>(defaultSetting('highlighter'));
  private pending: Promise<void>;

  readonly pen = this.penSignal.asReadonly();
  readonly highlighter = this.highlighterSignal.asReadonly();
  /** Resolves when the stored settings have been read (and queued changes are written). */
  get ready(): Promise<void> {
    return this.pending;
  }

  constructor() {
    this.pending = this.load();
  }

  setting(tool: StyledTool): ToolSetting {
    return tool === 'pen' ? this.penSignal() : this.highlighterSignal();
  }

  /** Reactive when read inside `computed()`. */
  style(tool: StyledTool): StrokeStyle {
    const { color, widthIndex } = this.setting(tool);
    return {
      color,
      widthPt: toolWidths(tool)[widthIndex] ?? 0,
      opacity: tool === 'pen' ? 1 : TUNABLES.annotation.highlighterOpacity,
      multiply: tool === 'highlighter',
    };
  }

  /** Colors that are not a preset of the tool are ignored. */
  setColor(tool: StyledTool, color: string): Promise<void> {
    if (!isValidColor(tool, color)) {
      return this.pending;
    }
    return this.change(tool, { ...this.setting(tool), color });
  }

  setWidthIndex(tool: StyledTool, widthIndex: number): Promise<void> {
    if (!isValidWidthIndex(tool, widthIndex)) {
      return this.pending;
    }
    return this.change(tool, { ...this.setting(tool), widthIndex });
  }

  private change(tool: StyledTool, next: ToolSetting): Promise<void> {
    (tool === 'pen' ? this.penSignal : this.highlighterSignal).set(next);
    return this.enqueue(() => this.preferences.set(KEYS[tool], next));
  }

  private async load(): Promise<void> {
    this.penSignal.set(validated('pen', await this.preferences.get<unknown>(KEYS.pen)));
    this.highlighterSignal.set(validated('highlighter', await this.preferences.get<unknown>(KEYS.highlighter)));
  }

  private enqueue(change: () => Promise<void>): Promise<void> {
    this.pending = this.pending.then(change, change);
    return this.pending;
  }
}
