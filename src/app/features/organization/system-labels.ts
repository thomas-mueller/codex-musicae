import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import type { SystemInfo } from '../../core';

/**
 * ORG-011, ORG-012: the playing-order numbers of every music system of one page ("3, 9"), centered on the system. The
 * digits cover `T:layout.systemLabelHeightRatio` of the system height and have the color and transparency of the bars.
 * Positions are the system box × scale (page-local CSS px). Systems that are never played get no label.
 */
@Component({
  selector: 'app-system-labels',
  template: `
    @for (system of systems(); track system.index) {
      @let text = textOf(system);
      @if (text) {
        <span
          class="label"
          data-testid="system-label"
          [attr.data-system]="system.index"
          [style.left.px]="system.box.x * scale()"
          [style.top.px]="system.box.y * scale()"
          [style.width.px]="system.box.width * scale()"
          [style.height.px]="system.box.height * scale()"
          [style.font-size.px]="fontSize(system)"
        >{{ text }}</span>
      }
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; }
    .label {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      white-space: nowrap;
      line-height: 1;
      font-family: sans-serif;
      font-weight: bold;
      color: var(--cm-org-bar-tint);
      opacity: var(--cm-org-bar-opacity);
      pointer-events: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemLabels {
  readonly systems = input<readonly SystemInfo[]>([]);
  /** `numbers[i]` = playing-order numbers of system i + 1 (`systemNumbers`). */
  readonly numbers = input<readonly (readonly number[])[]>([]);
  readonly scale = input.required<number>();

  protected textOf(system: SystemInfo): string {
    return (this.numbers()[system.index - 1] ?? []).join(TUNABLES.layout.numberSeparator);
  }

  protected fontSize(system: SystemInfo): number {
    return (TUNABLES.layout.systemLabelHeightRatio * system.box.height * this.scale()) / TUNABLES.layout.systemLabelDigitEm;
  }
}
