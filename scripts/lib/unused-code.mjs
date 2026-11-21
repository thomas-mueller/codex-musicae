// Unused files and exports (V2-M1 S2, PIP-013), pure logic over a set of source texts. Uses the TypeScript parser only (no type checker),
// so it is fast and has no new dependency. scripts/check-unused-code.mjs feeds it the application sources.
import ts from 'typescript';

const ALL = '*';

/** Reads the exports and the references to other modules of one source text. */
export function parseModule(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const exports = new Set();
  /** Reference to another module: `names` is a Set of imported names or ALL. */
  const references = [];
  /** `export { a as b } from './x'`: b of this module is a of x. */
  const forwards = [];
  const hasModifier = (node, kind) => node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const names = new Set();
      if (clause === undefined) names.add(ALL);
      if (clause?.name) names.add('default');
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) names.add(ALL);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) names.add((element.propertyName ?? element.name).text);
      }
      references.push({ specifier: node.moduleSpecifier.text, names });
    } else if (ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined;
      if (specifier === undefined) {
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) exports.add(element.name.text);
        }
      } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.add(element.name.text);
          forwards.push({ specifier, from: (element.propertyName ?? element.name).text, as: element.name.text });
        }
      } else {
        // `export * from` forwards every name; `export * as ns from` exports one namespace that uses everything.
        if (node.exportClause && ts.isNamespaceExport(node.exportClause)) exports.add(node.exportClause.name.text);
        references.push({ specifier, names: new Set([ALL]), star: node.exportClause === undefined });
      }
    } else if (ts.isExportAssignment(node)) {
      exports.add('default');
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteralLike(node.arguments[0])) {
      references.push({ specifier: node.arguments[0].text, names: new Set([ALL]) });
    } else if (ts.isNewExpression(node) && node.expression.getText(source) === 'URL' && node.arguments?.length === 2
      && ts.isStringLiteralLike(node.arguments[0]) && node.arguments[1].getText(source) === 'import.meta.url') {
      references.push({ specifier: node.arguments[0].text, names: new Set([ALL]) });
    }
    if (ts.isVariableStatement(node) && hasModifier(node, ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of node.declarationList.declarations) collectNames(declaration.name, exports);
    } else if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
        || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) && hasModifier(node, ts.SyntaxKind.ExportKeyword)
    ) {
      if (hasModifier(node, ts.SyntaxKind.DefaultKeyword)) exports.add('default');
      else if (node.name) exports.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { exports, references, forwards };
}

function collectNames(name, into) {
  if (ts.isIdentifier(name)) {
    into.add(name.text);
  } else {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) collectNames(element.name, into);
    }
  }
}

/** Resolves a relative specifier against the known source paths; anything else (a package) is not ours. */
export function resolveSpecifier(from, specifier, paths) {
  if (!specifier.startsWith('.')) return null;
  const parts = from.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  const base = parts.join('/');
  return [base, `${base}.ts`, `${base}/index.ts`, base.replace(/\.js$/, '.ts')].find((candidate) => paths.has(candidate)) ?? null;
}

/** `- **key** reason` lines of an exceptions file → Map(key → reason). */
export function parseExceptions(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const match = line.match(/^- \*\*([^*]+)\*\*\s+(\S.*)$/);
    if (match?.[1] && match[2]) map.set(match[1], match[2]);
  }
  return map;
}

/**
 * sources: { path: text } of the application files (no specs, no test helpers); entries: paths that start the app.
 * exceptions: Set of `path` or `path#export` keys. Returns one line per finding, stale exceptions included.
 */
export function findUnused({ sources, entries, exceptions = new Set() }) {
  const paths = new Set(Object.keys(sources));
  const modules = new Map(Object.entries(sources).map(([path, text]) => [path, parseModule(path, text)]));
  const resolved = new Map();
  for (const [path, module] of modules) {
    resolved.set(path, [
      ...module.references.map((reference) => ({ ...reference, target: resolveSpecifier(path, reference.specifier, paths) })),
      ...module.forwards.map((forward) => ({ ...forward, target: resolveSpecifier(path, forward.specifier, paths) })),
    ]);
  }

  // Files reachable from the entries.
  const reachable = new Set();
  const queue = entries.filter((entry) => paths.has(entry));
  while (queue.length > 0) {
    const path = queue.pop();
    if (reachable.has(path)) continue;
    reachable.add(path);
    for (const edge of resolved.get(path) ?? []) {
      if (edge.target !== null) queue.push(edge.target);
    }
  }

  // Names used by importers (only importers that are themselves reachable count).
  const used = new Map([...paths].map((path) => [path, new Set()]));
  const markUsed = (path, name) => used.get(path)?.add(name);
  const forwardedBy = [];
  for (const path of reachable) {
    for (const edge of resolved.get(path) ?? []) {
      if (edge.target === null) continue;
      if (entries.includes(path) && (edge.from !== undefined || edge.star === true)) {
        // What an entry re-exports is its public surface.
        markUsed(edge.target, edge.from ?? ALL);
      } else if (edge.from !== undefined) {
        forwardedBy.push({ path, ...edge });
      } else if (edge.star === true) {
        forwardedBy.push({ path, ...edge, from: ALL, as: ALL });
      } else {
        for (const name of edge.names) markUsed(edge.target, name);
      }
    }
  }
  // A re-export uses the original only as far as the re-exporting module's own name is used.
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of forwardedBy) {
      const own = used.get(edge.path);
      const target = used.get(edge.target);
      if (!own || !target) continue;
      const names = edge.as === ALL ? [...own] : own.has(edge.as) || own.has(ALL) ? [edge.from] : [];
      for (const name of names) {
        if (!target.has(name)) {
          target.add(name);
          changed = true;
        }
      }
    }
  }

  const findings = new Map();
  for (const path of [...paths].sort()) {
    if (!reachable.has(path)) {
      findings.set(path, `${path}: file is not used`);
      continue;
    }
    if (entries.includes(path)) continue;
    const usedNames = used.get(path) ?? new Set();
    if (usedNames.has(ALL)) continue;
    for (const name of [...(modules.get(path)?.exports ?? [])].sort()) {
      if (!usedNames.has(name)) findings.set(`${path}#${name}`, `${path}: export ${name} is not used`);
    }
  }
  const lines = [];
  for (const [key, line] of findings) {
    if (!exceptions.has(key) && !exceptions.has(key.split('#')[0] ?? key)) lines.push(line);
  }
  for (const key of exceptions) {
    const file = key.split('#')[0] ?? key;
    const covers = [...findings.keys()].some((found) => found === key || (key === file && found.split('#')[0] === file));
    if (!covers) lines.push(`${key}: exception is stale, the finding is gone`);
  }
  return lines;
}
