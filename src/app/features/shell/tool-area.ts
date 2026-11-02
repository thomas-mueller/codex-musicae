import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import { MarkList, POPUP_MARK_LIST } from '../organization/mark-list';
import { OrgViewStore } from '../../state/org-view.store';
import { DetectionLevel, UiStore } from '../../state/ui.store';
import { IconKey } from './icon';
import { IconButton } from './icon-button';
import { ToolButton, ToolEntry } from './tool-button';

export const POPUP_TOOLS = 'tools';
export const POPUP_ORG = 'org';

export const TOOL_ENTRIES: readonly ToolEntry[] = [
  { tool: 'pen', icon: 'pen' },
  { tool: 'highlighter', icon: 'highlighter' },
  { tool: 'eraser', icon: 'eraser' },
];

export const LEVEL_ENTRIES: readonly { readonly level: DetectionLevel; readonly icon: IconKey }[] = [
  { level: 'fast', icon: 'levelFast' },
  { level: 'standard', icon: 'levelStandard' },
  { level: 'fine', icon: 'levelFine' },
];

/** Compact: one floating button. Expanded: vertical strip on the configured side. UIX-004, 005, 006 */
@Component({
  selector: 'app-tool-area',
  imports: [IconButton, MarkList, ToolButton],
  templateUrl: './tool-area.html',
  styleUrl: './tool-area.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-side]': 'side',
    '[attr.data-variant]': 'compact() ? "fab" : "strip"',
  },
})
export class ToolArea {
  protected readonly store = inject(UiStore);
  protected readonly view = inject(OrgViewStore);
  protected readonly markListId = POPUP_MARK_LIST;
  protected readonly side = TUNABLES.layout.toolStripSide;
  protected readonly tools = TOOL_ENTRIES;
  protected readonly levels = LEVEL_ENTRIES;
  protected readonly toolsId = POPUP_TOOLS;
  protected readonly orgId = POPUP_ORG;
  protected readonly compact = computed(() => this.store.sizeClass() === 'compact');
  protected readonly annotation = computed(() => this.store.mode() === 'annotation');
  protected readonly noDocument = computed(() => !this.store.hasDocument());
  protected readonly fabIcon = computed<IconKey>(
    () => TOOL_ENTRIES.find((entry) => entry.tool === this.store.tool())?.icon ?? 'pen',
  );
}
