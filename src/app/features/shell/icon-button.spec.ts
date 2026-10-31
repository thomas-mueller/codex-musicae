import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { provideTestTransloco, translate } from '../../../testing/transloco';
import { IconButton } from './icon-button';

@Component({
  imports: [IconButton],
  template: `<button appIconButton icon="undo" labelKey="undo" [toggled]="toggled()" [disabled]="disabled()" (pressed)="count.set(count() + 1)"></button>`,
})
class Host {
  readonly toggled = signal(false);
  readonly disabled = signal(false);
  readonly count = signal(0);
}

describe('IconButton', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: [provideTestTransloco()] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, button };
  }

  it('GEN-010 aria-label comes from the translation file', async () => {
    const { button } = await setup();
    expect(button.getAttribute('aria-label')).toBe(translate('a11y.undo'));
  });

  it('UIX-011 toggled state is marked and untoggled is not', async () => {
    const { fixture, button } = await setup();
    expect(button.classList.contains('toggled')).toBe(false);
    fixture.componentInstance.toggled.set(true);
    await fixture.whenStable();
    expect(button.classList.contains('toggled')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('UIX-012 disabled buttons are unfocusable, aria-disabled and swallow clicks', async () => {
    const { fixture, button } = await setup();
    button.click();
    expect(fixture.componentInstance.count()).toBe(1);
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();
    button.click();
    expect(fixture.componentInstance.count()).toBe(1);
    expect(button.getAttribute('tabindex')).toBe('-1');
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });
});
