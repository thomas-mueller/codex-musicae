import { TUNABLES } from '../../../config/tunables';
import { breakLabel, jumpLabel, numberText, stopLabel } from './mark-labels';

const { listArrow, passPrefix, breakSeparator, unknownNumber } = TUNABLES.layout;

describe('mark labels', () => {
  it('ORG-018 a jump reads "<previous> → <next> ×<pass>"', () => {
    expect(jumpLabel(4, 5, 2)).toBe(`4 ${listArrow} 5 ${passPrefix}2`);
  });

  it('ORG-021 a slide break reads "<previous> | <next>", a stop "<previous>"', () => {
    expect(breakLabel(3, 4)).toBe(`3 ${breakSeparator} 4`);
    expect(stopLabel(6)).toBe('6');
  });

  it('ORG-018 a missing number is the placeholder', () => {
    expect(numberText(null)).toBe(unknownNumber);
    expect(jumpLabel(null, 1, 1)).toBe(`${unknownNumber} ${listArrow} 1 ${passPrefix}1`);
    expect(breakLabel(5, null)).toBe(`5 ${breakSeparator} ${unknownNumber}`);
    expect(stopLabel(null)).toBe(unknownNumber);
  });
});
