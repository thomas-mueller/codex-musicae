import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { translateSignal } from '@jsverse/transloco';

import { Icon, IconKey } from './icon';
import { TooltipDirective } from './tooltip.directive';

/** Icon-only control: monochrome, toggled/disabled looks, aria-label from a11y.<labelKey>. UIX-007, 011, 012, GEN-010 */
@Component({
  selector: 'button[appIconButton]',
  imports: [Icon],
  hostDirectives: [{ directive: TooltipDirective, inputs: ['appTooltip: labelKey'] }],
  template: '<app-icon [name]="icon()" />',
  styleUrl: './icon-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    '[attr.aria-label]': 'label()',
    '[attr.aria-pressed]': 'toggled() ? true : null',
    '[attr.aria-disabled]': 'disabled() ? true : null',
    '[attr.tabindex]': 'disabled() ? -1 : null',
    '[class.toggled]': 'toggled()',
    '[class.disabled]': 'disabled()',
    '(click)': 'onClick()',
  },
})
export class IconButton {
  readonly icon = input.required<IconKey>();
  readonly labelKey = input.required<string>();
  readonly toggled = input(false);
  readonly disabled = input(false);
  readonly pressed = output<void>();
  protected readonly label = translateSignal(computed(() => `a11y.${this.labelKey()}`));

  protected onClick(): void {
    if (!this.disabled()) {
      this.pressed.emit();
    }
  }
}
