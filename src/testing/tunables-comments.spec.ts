import { findUncommentedNumbers } from '../../scripts/lib/tunables-comments.mjs';

const OBVIOUS = [0, 1];

describe('tunables comments', () => {
  it('ARC-008 a number with a comment on its line passes', () => {
    expect(findUncommentedNumbers('  widthPx: 24, // icon width in CSS pixels', OBVIOUS)).toEqual([]);
  });

  it('ARC-008 a number under a comment-only line passes', () => {
    expect(findUncommentedNumbers('  // icon width in CSS pixels\n  widthPx: 24,', OBVIOUS)).toEqual([]);
  });

  it('ARC-008 a number without a comment is reported with its line', () => {
    expect(findUncommentedNumbers('const a = {\n  widthPx: 24,\n};', OBVIOUS)).toEqual(['2: widthPx: 24,']);
  });

  it('ARC-008 obvious numbers, strings with digits and block comments need no comment', () => {
    const text = ['  index: 0,', '  flag: 1,', "  color: '#1A73E8',", "  id: 'app.web.codex2',", '/**', ' * five 5 minutes', ' */'].join('\n');
    expect(findUncommentedNumbers(text, OBVIOUS)).toEqual([]);
  });

  it('ARC-008 a comment two lines above does not count and a // inside a string is not a comment', () => {
    expect(findUncommentedNumbers('  // about the first\n  first: 5,\n  second: 6,', OBVIOUS)).toEqual(['3: second: 6,']);
    expect(findUncommentedNumbers("  url: 'a//b', size: 7,", OBVIOUS)).toEqual(["1: url: 'a//b', size: 7,"]);
  });
});
