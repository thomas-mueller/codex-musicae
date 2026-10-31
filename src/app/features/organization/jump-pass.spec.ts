import { EMPTY_MARKS } from '../../core';
import type { DocMarks } from '../../core';
import { nextPass } from './jump-pass';

const marks = (origins: number[]): DocMarks => ({
  ...EMPTY_MARKS,
  jumps: origins.map((origin, i) => ({ origin, target: 0, pass: 1, id: i + 1 })),
  nextJumpId: origins.length + 1,
});

describe('nextPass', () => {
  it('ORG-016 the first jump of a bar starts at occurrence 1', () => {
    expect(nextPass(EMPTY_MARKS, 3)).toBe(1);
    expect(nextPass(marks([2, 5]), 3)).toBe(1);
  });

  it('ORG-016 further jumps start after the existing jumps of the same origin', () => {
    expect(nextPass(marks([3]), 3)).toBe(2);
    expect(nextPass(marks([3, 2, 3]), 3)).toBe(3);
  });

  it('ORG-016 other origins do not count and deleting a jump lowers the number again', () => {
    expect(nextPass(marks([1, 1, 4]), 4)).toBe(2);
    expect(nextPass(marks([1]), 1)).toBe(2);
    expect(nextPass(EMPTY_MARKS, 1)).toBe(1);
  });
});
