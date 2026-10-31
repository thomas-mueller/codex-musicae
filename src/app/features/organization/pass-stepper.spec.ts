import { TestBed } from '@angular/core/testing';

import { provideTestTransloco } from '../../../testing/transloco';
import { PassStepper, stepPass } from './pass-stepper';

describe('PassStepper', () => {
  it('ORG-016 stepPass never goes below 1', () => {
    expect(stepPass(1, -1)).toBe(1);
    expect(stepPass(1, 1)).toBe(2);
    expect(stepPass(3, -1)).toBe(2);
  });

  async function mount(pass: number) {
    TestBed.configureTestingModule({ providers: [provideTestTransloco()] });
    const fixture = TestBed.createComponent(PassStepper);
    fixture.componentRef.setInput('pass', pass);
    const emitted: number[] = [];
    fixture.componentInstance.passChange.subscribe((v) => emitted.push(v));
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const part = (id: string) => root.querySelector<HTMLElement>(`[data-testid="stepper-${id}"]`)!;
    return { fixture, part, emitted };
  }

  it('ORG-016 shows the pass, emits every step at once and disables minus at 1', async () => {
    const { fixture, part, emitted } = await mount(1);
    expect(part('value').textContent).toBe('1');
    expect(part('minus').classList.contains('disabled')).toBe(true);
    part('minus').click();
    part('plus').click();
    expect(emitted).toEqual([2]);
    fixture.componentRef.setInput('pass', 3);
    await fixture.whenStable();
    expect(part('minus').classList.contains('disabled')).toBe(false);
    part('minus').click();
    expect(emitted).toEqual([2, 2]);
  });
});
