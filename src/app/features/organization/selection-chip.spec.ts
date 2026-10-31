import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestTransloco } from '../../../testing/transloco';
import { SelectionChip } from './selection-chip';

describe('SelectionChip', () => {
  async function mount(inputs: { markable: boolean; hasBreak?: boolean; hasStop?: boolean; hasItems?: boolean }) {
    TestBed.configureTestingModule({ providers: [provideTestTransloco()] });
    const fixture = TestBed.createComponent(SelectionChip);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const button = (id: string) => root.querySelector<HTMLElement>(`[data-testid="chip-${id}"]`);
    return { fixture, button };
  }

  it('ORG-014 a middle junction enables jump, break and stop; delete only with items', async () => {
    const { button } = await mount({ markable: true });
    expect(button('jump')).not.toBeNull();
    expect(button('break')?.classList.contains('disabled')).toBe(false);
    expect(button('stop')?.classList.contains('disabled')).toBe(false);
    expect(button('delete')).toBeNull();
  });

  it('ORG-014 junctions 0 and N (not markable) disable break and stop but keep jump', async () => {
    const { button } = await mount({ markable: false, hasItems: true });
    expect(button('break')?.classList.contains('disabled')).toBe(true);
    expect(button('stop')?.classList.contains('disabled')).toBe(true);
    expect(button('jump')?.classList.contains('disabled')).toBe(false);
    expect(button('delete')).not.toBeNull();
  });

  it('ORG-022 ORG-023 break and stop show the toggled look when present', async () => {
    const { button } = await mount({ markable: true, hasBreak: true, hasStop: false, hasItems: true });
    expect(button('break')?.classList.contains('toggled')).toBe(true);
    expect(button('stop')?.classList.contains('toggled')).toBe(false);
  });

  it('ORG-014 buttons emit their action; disabled buttons do not', async () => {
    const { fixture, button } = await mount({ markable: true, hasItems: true });
    const chip = fixture.componentInstance;
    const emitted: string[] = [];
    chip.jump.subscribe(() => emitted.push('jump'));
    chip.toggleBreak.subscribe(() => emitted.push('break'));
    chip.toggleStop.subscribe(() => emitted.push('stop'));
    chip.clear.subscribe(() => emitted.push('clear'));
    for (const id of ['jump', 'break', 'stop', 'delete']) {
      button(id)?.click();
    }
    expect(emitted).toEqual(['jump', 'break', 'stop', 'clear']);
    fixture.componentRef.setInput('markable', false);
    await fixture.whenStable();
    button('break')?.click();
    expect(emitted).toHaveLength(4);
  });

  it('ORG-014 touch targets are at least minTouchTargetPx', () => {
    expect(TUNABLES.layout.minTouchTargetPx).toBeGreaterThanOrEqual(44);
  });
});
