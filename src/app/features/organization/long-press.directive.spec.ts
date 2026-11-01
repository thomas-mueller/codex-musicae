import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { LongPressDirective } from './long-press.directive';

@Component({
  imports: [LongPressDirective],
  template: `<button appLongPress #press="appLongPress" (longPress)="count = count + 1" (click)="clicks.push(press.consumeClick())"></button>`,
})
class Host {
  count = 0;
  clicks: boolean[] = [];
}

describe('LongPressDirective', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const fire = (type: string, x = 0, y = 0) =>
      button.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y }));
    return { host: fixture.componentInstance, button, fire };
  }

  it('ORG-019 fires after longPressMs of holding and swallows the following click once', () => {
    const { host, button, fire } = setup();
    fire('pointerdown');
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs - 1);
    expect(host.count).toBe(0);
    vi.advanceTimersByTime(1);
    expect(host.count).toBe(1);
    fire('pointerup');
    button.click();
    button.click();
    expect(host.clicks).toEqual([true, false]);
  });

  it('ORG-019 a short press does not fire and its click is not swallowed', () => {
    const { host, button, fire } = setup();
    fire('pointerdown');
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs / 2);
    fire('pointerup');
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs);
    button.click();
    expect(host.count).toBe(0);
    expect(host.clicks).toEqual([false]);
  });

  it('ORG-019 moving beyond the tap threshold or a pointer cancel stops the timer', () => {
    const { host, fire } = setup();
    fire('pointerdown');
    fire('pointermove', TUNABLES.gestures.tapMaxMovePx + 1, 0);
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs * 2);
    expect(host.count).toBe(0);
    fire('pointerdown');
    fire('pointermove', 1, 1); // jitter below the threshold keeps it alive
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs);
    expect(host.count).toBe(1);
    fire('pointerdown');
    fire('pointercancel');
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs * 2);
    expect(host.count).toBe(1); // unchanged: the cancelled press did not fire
  });
});
