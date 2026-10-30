import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';

export type IconKey = keyof typeof TUNABLES.icons;

const SPRITE_URL = 'assets/icons/sprite.svg';

/** One glyph of the self-hosted Material Symbols sprite. UIX-010 */
@Component({
  selector: 'app-icon',
  template: '<svg aria-hidden="true" focusable="false"><use [attr.href]="href()" /></svg>',
  styles: `
    :host { display: inline-flex; width: var(--cm-icon-size); height: var(--cm-icon-size); }
    svg { width: 100%; height: 100%; fill: currentColor; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconKey>();
  protected readonly href = computed(() => `${SPRITE_URL}#${TUNABLES.icons[this.name()]}`);
}
