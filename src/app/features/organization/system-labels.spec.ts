import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import type { SystemInfo } from '../../core';
import { SystemLabels } from './system-labels';

const SCALE = 0.5;
const systems: SystemInfo[] = [
  { index: 1, pageIndex: 0, box: { x: 40, y: 100, width: 500, height: 80 } },
  { index: 2, pageIndex: 0, box: { x: 40, y: 300, width: 500, height: 100 } },
  { index: 3, pageIndex: 0, box: { x: 40, y: 500, width: 500, height: 100 } },
];

describe('SystemLabels', () => {
  function mount(numbers: number[][]) {
    const fixture = TestBed.createComponent(SystemLabels);
    fixture.componentRef.setInput('systems', systems);
    fixture.componentRef.setInput('numbers', numbers);
    fixture.componentRef.setInput('scale', SCALE);
    return fixture;
  }
  const labels = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('[data-testid="system-label"]'));

  it('ORG-012 shows the playing-order numbers ascending and comma separated on the system', async () => {
    const fixture = mount([[1, 5], [2], [4, 8, 9]]);
    await fixture.whenStable();
    expect(labels(fixture).map((l) => l.textContent)).toEqual([
      ['1', '5'].join(TUNABLES.layout.numberSeparator),
      '2',
      ['4', '8', '9'].join(TUNABLES.layout.numberSeparator),
    ]);
  });

  it('ORG-012 a system that is never played has no label', async () => {
    const fixture = mount([[1], [], [3]]);
    await fixture.whenStable();
    expect(labels(fixture).map((l) => l.dataset['system'])).toEqual(['1', '3']);
  });

  it('ORG-012 the label sits on the system box, centered, scaled', async () => {
    const fixture = mount([[1], [2], [3]]);
    await fixture.whenStable();
    const [first] = labels(fixture);
    expect(parseFloat(first!.style.left)).toBeCloseTo(40 * SCALE);
    expect(parseFloat(first!.style.top)).toBeCloseTo(100 * SCALE);
    expect(parseFloat(first!.style.width)).toBeCloseTo(500 * SCALE);
    expect(parseFloat(first!.style.height)).toBeCloseTo(80 * SCALE);
  });

  it('ORG-012 the digits cover systemLabelHeightRatio of the system height', async () => {
    const fixture = mount([[1], [2], [3]]);
    await fixture.whenStable();
    const [first] = labels(fixture);
    const digitHeight = parseFloat(first!.style.fontSize) * TUNABLES.layout.systemLabelDigitEm;
    expect(digitHeight).toBeCloseTo(TUNABLES.layout.systemLabelHeightRatio * 80 * SCALE);
  });
});
