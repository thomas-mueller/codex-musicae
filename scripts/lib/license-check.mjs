// License allow-list logic (V2-M1 S2, PIP-015). Pure functions; scripts/check-licenses.mjs feeds them from package-lock.json.

/** Any identifier that contains GPL (GPL, AGPL, LGPL) is never allowed, whatever the allow-list says. */
const FORBIDDEN = /GPL/i;

const tokenize = (expression) => expression.match(/\(|\)|[^\s()]+/g) ?? [];

/** Evaluates an SPDX expression: OR needs one allowed side, AND needs both, WITH keeps the verdict of the license it modifies. */
export function isAllowed(expression, allowed) {
  if (typeof expression !== 'string' || expression.trim() === '') return false;
  const tokens = tokenize(expression);
  let position = 0;
  const parseOr = () => {
    let result = parseAnd();
    while (tokens[position] === 'OR') {
      position += 1;
      const right = parseAnd();
      result = result || right;
    }
    return result;
  };
  const parseAnd = () => {
    let result = parseTerm();
    while (tokens[position] === 'AND') {
      position += 1;
      const right = parseTerm();
      result = result && right;
    }
    return result;
  };
  const parseTerm = () => {
    const token = tokens[position];
    position += 1;
    if (token === '(') {
      const inner = parseOr();
      if (tokens[position] === ')') position += 1;
      return inner;
    }
    if (token === undefined || token === ')') return false;
    const id = token.replace(/\+$/, '');
    const ok = !FORBIDDEN.test(id) && allowed.includes(id);
    if (tokens[position] === 'WITH') {
      position += 2;
    }
    return ok;
  };
  const result = parseOr();
  return position >= tokens.length ? result : false;
}

/** packages: [{ name, version, license }]. Returns the table rows and one violation line per package outside the allow-list. */
export function checkLicenses(packages, allowed) {
  const rows = packages.map((pkg) => ({
    name: pkg.name,
    version: pkg.version ?? '',
    license: pkg.license ?? '(none)',
    ok: isAllowed(pkg.license, allowed),
  }));
  const violations = rows.filter((row) => !row.ok).map((row) => `${row.name}@${row.version}: license ${row.license} is not allowed (PIP-015)`);
  return { rows, violations };
}

export function formatTable(rows) {
  const widths = ['name', 'version', 'license'].map((key) => Math.max(key.length, ...rows.map((row) => row[key].length)));
  const line = (cells) => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join('  ').trimEnd();
  return [line(['name', 'version', 'license', 'allowed']), ...rows.map((row) => line([row.name, row.version, row.license, row.ok ? 'yes' : 'NO']))].join('\n');
}
