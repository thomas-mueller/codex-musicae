import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { StyledTool, ToolSettingsStore, toolPresets, toolWidths } from '../../state/tool-settings.store';

/** Color grid and width samples of the pen or the highlighter; every change applies and persists at once. ANN-002, ANN-003, ANN-004 */
@Component({
  selector: 'app-tool-popup',
  imports: [TranslocoPipe],
  templateUrl: './tool-popup.html',
  styleUrl: './tool-popup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolPopup {
  readonly tool = input.required<StyledTool>();
  protected readonly settings = inject(ToolSettingsStore);
  protected readonly colors = computed(() => toolPresets(this.tool()));
  protected readonly widths = computed(() => toolWidths(this.tool()));
  protected readonly current = computed(() => this.settings.setting(this.tool()));

  protected pickColor(color: string): void {
    void this.settings.setColor(this.tool(), color);
  }

  protected pickWidth(index: number): void {
    void this.settings.setWidthIndex(this.tool(), index);
  }
}
