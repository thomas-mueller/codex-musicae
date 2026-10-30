import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { TUNABLES } from '../../../config/tunables';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { TooltipDirective } from './tooltip.directive';

@Component({ imports: [TooltipDirective], template: `<button appTooltip="undo"></button>` })
class Host {}

function pointer(type: string, pointerType: string): Event {
  const event = new Event(type);
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

describe('TooltipDirective', () => {
  let button: HTMLButtonElement;
  const tooltip = () => button.querySelector('.cm-tooltip');

  beforeEach(async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideTestTransloco()] });
    const fixture = TestBed.createComponent(Host);
    await vi.advanceTimersByTimeAsync(0);
    button = fixture.nativeElement.querySelector('button');
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
  });
  afterEach(() => vi.useRealTimers());

  it('UIX-014 hover shows the tooltip after the hover delay and leave hides it', () => {
    button.dispatchEvent(pointer('pointerenter', 'mouse'));
    vi.advanceTimersByTime(TUNABLES.layout.tooltipHoverDelayMs - 1);
    expect(tooltip()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(tooltip()?.textContent).toBe(translate('tooltip.undo'));
    button.dispatchEvent(pointer('pointerleave', 'mouse'));
    expect(tooltip()).toBeNull();
  });

  it('UIX-014 touch long press shows the tooltip after the long-press time, release hides it', () => {
    button.dispatchEvent(pointer('pointerdown', 'touch'));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs - 1);
    expect(tooltip()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(tooltip()).not.toBeNull();
    button.dispatchEvent(pointer('pointerup', 'touch'));
    expect(tooltip()).toBeNull();
  });

  it('UIX-014 a short touch never shows the tooltip', () => {
    button.dispatchEvent(pointer('pointerdown', 'touch'));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs - 1);
    button.dispatchEvent(pointer('pointerup', 'touch'));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs);
    expect(tooltip()).toBeNull();
  });
});
