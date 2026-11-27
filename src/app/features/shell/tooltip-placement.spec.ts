import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { TUNABLES } from '../../../config/tunables';
import { provideTestTransloco } from '../../../testing/transloco';
import { tunablesToCssVars } from '../../state/css-vars';
import { TooltipDirective } from './tooltip.directive';

@Component({
  imports: [TooltipDirective],
  template: `<div data-area="top"><button id="top" appTooltip="undo"></button></div>
    <div data-area="bottom"><button id="bottom" appTooltip="undo"></button></div>`,
})
class Host {}

const SIZE = { width: 100, height: 20 };
const SCREEN = { left: 0, top: 0, right: 400, bottom: 600 };

/** jsdom lays nothing out: the rectangles of the control, the safe-area probe and the tooltip are given. */
function layOut(control: { left: number; top: number }, shift = { x: 0, y: 0 }) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const box = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
    if (this.classList.contains('cm-safe-area')) {
      return box(0, 0, SCREEN.right, SCREEN.bottom);
    }
    if (this.classList.contains('cm-tooltip')) {
      // where its style puts it, plus what a transformed ancestor would add
      return box(parseFloat(this.style.left) + shift.x, parseFloat(this.style.top) + shift.y, SIZE.width, SIZE.height);
    }
    return box(control.left, control.top, 40, 40);
  });
}

describe('TooltipDirective placement', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function hover(id: 'top' | 'bottom') {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideTestTransloco()] });
    const fixture = TestBed.createComponent(Host);
    await vi.advanceTimersByTimeAsync(0);
    await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`#${id}`)!;
    const event = new Event('pointerenter');
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    button.dispatchEvent(event);
    vi.advanceTimersByTime(TUNABLES.layout.tooltipHoverDelayMs);
    const tooltip = button.querySelector<HTMLElement>('[role="tooltip"]')!;
    return { button, tooltip };
  }

  it('UIX-027 puts the tooltip below its control, pushed inside the screen', async () => {
    layOut({ left: 360, top: 0 });
    const { tooltip } = await hover('top');
    expect([tooltip.style.left, tooltip.style.top]).toEqual([`${SCREEN.right - TUNABLES.layout.tooltipEdgeGapPx - SIZE.width}px`, '40px']);
  });

  it('UIX-027 prefers above in the bottom bar', async () => {
    layOut({ left: 180, top: 300 });
    const { tooltip } = await hover('bottom');
    expect([tooltip.style.left, tooltip.style.top]).toEqual(['150px', `${300 - SIZE.height}px`]);
  });

  it('UIX-027 corrects for an ancestor that shifts a fixed element', async () => {
    layOut({ left: 180, top: 300 }, { x: 7, y: -3 });
    const { tooltip } = await hover('top');
    const shown = tooltip.getBoundingClientRect();
    expect([shown.left, shown.top]).toEqual([150, 340]);
  });

  it('UIX-027 leaves no probe behind, and stays a child of its control', async () => {
    layOut({ left: 180, top: 300 });
    const { button, tooltip } = await hover('top');
    expect(tooltip.parentElement).toBe(button);
    expect(button.ownerDocument.querySelector('.cm-safe-area')).toBeNull();
  });

  it('UIX-027 UIX-012 marks its control only while the tooltip is shown', async () => {
    layOut({ left: 180, top: 300 });
    const { button } = await hover('top');
    expect(button.classList).toContain('cm-tooltip-open');
    button.dispatchEvent(new Event('pointerleave'));
    expect(button.classList).not.toContain('cm-tooltip-open');
  });

  it('UIX-028 the maximum width and the edge gap come from the tunables', () => {
    const vars = tunablesToCssVars(TUNABLES);
    expect(vars['--cm-tooltip-max-width']).toBe(`${TUNABLES.layout.tooltipMaxWidthPx}px`);
    expect(vars['--cm-tooltip-edge-gap']).toBe(`${TUNABLES.layout.tooltipEdgeGapPx}px`);
  });
});
