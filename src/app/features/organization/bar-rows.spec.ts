import { TUNABLES } from '../../../config/tunables';
import { EMPTY_MARKS } from '../../core';
import { barRows } from './bar-rows';

describe('barRows', () => {
  const numbers = [[1, 5], [2], [], [4, 8, 9]];
  const marks = { ...EMPTY_MARKS, breaks: [2], stops: [3] };

  it('ORG-012 junction j shows the numbers of the system above it, ascending and comma separated', () => {
    const rows = barRows(numbers, EMPTY_MARKS, 4);
    expect(rows.get(1)?.numbersText).toBe(['1', '5'].join(TUNABLES.layout.numberSeparator));
    expect(rows.get(2)?.numbersText).toBe('2');
    expect(rows.get(3)?.numbersText).toBe('');
    expect(rows.get(4)?.numbersText).toBe(['4', '8', '9'].join(TUNABLES.layout.numberSeparator));
  });

  it('ORG-012 junction 0 shows no numbers', () => {
    expect(barRows(numbers, EMPTY_MARKS, 4).get(0)?.numbersText).toBe('');
  });

  it('ORG-011 flags breaks and stops per junction and covers junctions 0..N', () => {
    const rows = barRows(numbers, marks, 4);
    expect([...rows.keys()]).toEqual([0, 1, 2, 3, 4]);
    expect(rows.get(2)).toMatchObject({ hasBreak: true, hasStop: false });
    expect(rows.get(3)).toMatchObject({ hasBreak: false, hasStop: true });
    expect(rows.get(1)).toMatchObject({ hasBreak: false, hasStop: false });
  });
});
