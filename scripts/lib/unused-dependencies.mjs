// Unused dependencies (V2-M1 S2, PIP-014), pure logic. scripts/check-unused-dependencies.mjs gathers the module specifiers and the
// text of the configuration files.

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * declared: package names from package.json; specifiers: every non-relative module specifier found in sources and scripts;
 * configText: text of the files that name tools by string (angular.json, workflows, package.json scripts, ...);
 * exceptions: Set of package names that are used implicitly. Returns one line per finding, stale exceptions included.
 */
export function findUnusedDependencies({ declared, specifiers, configText, exceptions = new Set() }) {
  const isUsed = (name) => specifiers.some((specifier) => specifier === name || specifier.startsWith(`${name}/`))
    || new RegExp(`(?<![\\w@.-])${escape(name)}(?![\\w-])`).test(configText);
  const lines = [];
  for (const name of [...declared].sort()) {
    const used = isUsed(name);
    if (!used && !exceptions.has(name)) lines.push(`${name}: dependency is not used (PIP-014)`);
    if (used && exceptions.has(name)) lines.push(`${name}: exception is stale, the package is now found in use`);
  }
  for (const name of exceptions) {
    if (!declared.includes(name)) lines.push(`${name}: exception names a package that is not declared`);
  }
  return lines;
}
