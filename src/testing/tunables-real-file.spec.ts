import { readFileSync } from 'node:fs';

import { findUncommentedNumbers } from '../../scripts/lib/tunables-comments.mjs';

describe('tunables file', () => {
  it('ARC-008 every numeric value in src/config/tunables.ts has a comment with its unit and meaning', () => {
    const { obviousNumbers } = JSON.parse(readFileSync('scripts/tunables-comment-allow-list.json', 'utf8')) as { obviousNumbers: number[] };
    expect(findUncommentedNumbers(readFileSync('src/config/tunables.ts', 'utf8'), obviousNumbers)).toEqual([]);
  });
});
