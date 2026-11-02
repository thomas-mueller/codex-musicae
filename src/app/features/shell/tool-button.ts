import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import { StyledTool } from '../../state/tool-settings.store';
import { Tool, UiStore } from '../../state/ui.store';
import { ToolPopup } from '../annotation/tool-popup';
import { LongPressDirective } from '../organization/long-press.directive';
import { IconKey } from './icon';
import { IconButton } from './icon-button';

export const POPUP_TOOL_SETTINGS = 'toolSettings';

export interface ToolEntry {
  readonly tool: Tool;
  readonly icon: IconKey;
}

/**
 * One tool button. Tap toggles the tool; a long press, or the small settings button on the active pen/highlighter,
 * opens the color/width popup (beside the button when `panel`, else the popup host shows it as a sheet). The eraser has none. ANN-001, ANN-002
 */
@Component({
  selector: 'app-tool-button',
  imports: [IconButton, LongPressDirective, ToolPopup],
  templateUrl: './tool-button.html',
  styleUrl: './tool-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolButton {
  readonly entry = input.required<ToolEntry>();
  readonly panel = input(false);
  protected readonly store = inject(UiStore);
  protected readonly side = TUNABLES.layout.toolStripSide;
  protected readonly noDocument = computed(() => !this.store.hasDocument());
  /** The tool when it has settings (pen, highlighter), else null. */
  protected readonly styled = computed<StyledTool | null>(() => {
    const tool = this.entry().tool;
    return tool === 'eraser' ? null : tool;
  });
  protected readonly active = computed(() => this.store.tool() === this.entry().tool);
  protected readonly settingsOpen = computed(() => this.store.popup()?.id === POPUP_TOOL_SETTINGS);

  protected onLongPress(): void {
    if (this.styled() === null || this.noDocument()) {
      return;
    }
    this.store.setTool(this.entry().tool);
    this.store.openPopup(POPUP_TOOL_SETTINGS);
  }
}
