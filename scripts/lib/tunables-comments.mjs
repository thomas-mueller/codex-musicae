// Every numeric tunable has a comment (V2-M1 S4, ARC-008). Pure logic; scripts/check-tunables-comments.mjs feeds it src/config/tunables.ts.

/** Removes string literals so that digits inside colors, ids and text are not counted as numbers. */
const withoutStrings = (code) => code.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
const NUMBER = /(?<![\w.$])\d+(?:\.\d+)?(?![\w.])/g;

/**
 * Returns `line: text` for every line with a numeric value (other than the ones in `obviousNumbers`) that has no `//` comment on the line
 * and no comment-only line directly above it. Lines inside block comments (`/* ... *\/`) are skipped.
 */
export function findUncommentedNumbers(text, obviousNumbers = []) {
  const lines = text.split('\n');
  const findings = [];
  let inBlock = false;
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes('*/')) inBlock = false;
      return;
    }
    if (trimmed.startsWith('/*')) {
      inBlock = !trimmed.includes('*/');
      return;
    }
    if (trimmed.startsWith('//')) return;
    const commentAt = withoutStrings(line).indexOf('//');
    const code = commentAt === -1 ? withoutStrings(line) : withoutStrings(line).slice(0, commentAt);
    const numbers = code.match(NUMBER) ?? [];
    if (numbers.every((value) => obviousNumbers.includes(Number(value)))) return;
    const above = (lines[index - 1] ?? '').trim();
    if (commentAt !== -1 || above.startsWith('//')) return;
    findings.push(`${index + 1}: ${trimmed}`);
  });
  return findings;
}
