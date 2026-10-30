import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = process.argv.slice(2);
const files = [];

async function collect(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      await collect(child);
    } else if (extname(entry.name) === '.html') {
      files.push(child);
    }
  }
}

for (const root of roots.length > 0 ? roots : ['src/app']) {
  if ((await readdir(root, { withFileTypes: true }).catch(() => [])).length > 0) {
    const statEntries = await readdir(root, { withFileTypes: true });
    if (statEntries.some((entry) => entry.isDirectory())) {
      await collect(root);
    } else if (extname(root) === '.html') {
      files.push(root);
    }
  } else if (extname(root) === '.html') {
    files.push(root);
  }
}

const violations = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, '');
  const withoutStyles = withoutComments.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '');
  const interpolationPattern = /\{\{([\s\S]*?)\}\}/g;
  let interpolation;
  while ((interpolation = interpolationPattern.exec(withoutStyles)) !== null) {
    const expression = interpolation[1];
    if (/[A-Za-z]/.test(expression) && !/(?:\|\s*transloco\b|\btransloco\b|\bt\s*\()/.test(expression)) {
      violations.push(`${file}: interpolation is not translated: ${expression.trim()}`);
    }
  }

  const text = withoutStyles
    .replace(interpolationPattern, '')
    .replace(/@let\b[^;]*;/g, '')
    .replace(/@(?:else\s+if|if|else|for|switch|case|default|empty|defer|placeholder|loading|error)\b[^{]*\{/g, '')
    .replace(/\}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&[A-Za-z0-9#]+;/g, '')
    .trim();
  if (/[A-Za-z]/.test(text)) {
    violations.push(`${file}: raw template text is not translated: ${text}`);
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
}
