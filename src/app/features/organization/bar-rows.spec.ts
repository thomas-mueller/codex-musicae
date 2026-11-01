import { EMPTY_MARKS } from '../../core';
import { barRows } from './bar-rows';

describe('barRows', () => {
  const marks = { ...EMPTY_MARKS, breaks: [2], stops: [3] };

  it('ORG-011 flags breaks and stops per junction and covers junctions 0..N', () => {
    const rows = barRows(marks, 4);
    expect([...rows.keys()]).toEqual([0, 1, 2, 3, 4]);
    expect(rows.get(2)).toEqual({ hasBreak: true, hasStop: false });
    expect(rows.get(3)).toEqual({ hasBreak: false, hasStop: true });
    expect(rows.get(1)).toEqual({ hasBreak: false, hasStop: false });
  });

  it('ORG-011 the bars carry no numbers any more (they are shown on the systems)', () => {
    expect(Object.keys(barRows(marks, 1).get(0)!)).toEqual(['hasBreak', 'hasStop']);
  });
});
