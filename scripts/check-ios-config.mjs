// iOS shell configuration check (M18 S1, PLT-012, GEN-003): the only automated proof for the Xcode project and Info.plist
// besides the CI compile. Reads the expected values from src/config/tunables.ts. With a directory argument it checks that
// copy of the `ios` folder instead (used by the lint self-test); exits non-zero with one line per violation.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const iosDir = process.argv[2] ?? 'ios';
const tunables = await readFile('src/config/tunables.ts', 'utf8');
const capacitorConfig = await readFile('capacitor.config.ts', 'utf8');
const value = (key) => tunables.match(new RegExp(`\\b${key}:\\s*'([^']*)'`))?.[1];
const expected = {
  appName: value('appName'),
  appId: value('appId'),
  deploymentTarget: value('deploymentTarget'),
  contentType: value('pdfContentType'),
  role: value('pdfTypeRole'),
  rank: value('pdfHandlerRank'),
};
const violations = [];
for (const [key, found] of Object.entries(expected)) {
  if (!found) violations.push(`tunables.ts: ${key} not found`);
}

const plist = await readFile(join(iosDir, 'App/App/Info.plist'), 'utf8').catch(() => null);
const project = await readFile(join(iosDir, 'App/App.xcodeproj/project.pbxproj'), 'utf8').catch(() => null);
if (plist === null) violations.push('Info.plist is missing');
if (project === null) violations.push('project.pbxproj is missing');

/** The text of the balanced `<tag>…</tag>` element that starts at `from`. */
const balanced = (xml, from, tag) => {
  let depth = 0;
  for (const m of xml.slice(from).matchAll(new RegExp(`<(/?)${tag}>`, 'g'))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return xml.slice(from, from + m.index + m[0].length);
  }
  return null;
};

/** The element that follows `<key>name</key>` in a plist: string text, 'true' / 'false', or the whole array / dict. */
const entry = (xml, key) => {
  const marker = `<key>${key}</key>`;
  const at = xml.indexOf(marker);
  if (at < 0) return null;
  const rest = xml.slice(at + marker.length).replace(/^\s+/, '');
  const simple = rest.match(/^(?:<string>([^<]*)<\/string>|<(true|false)\/>)/);
  if (simple) return simple[1] ?? simple[2];
  const tag = rest.match(/^<(array|dict)>/)?.[1];
  return tag ? balanced(rest, 0, tag) : null;
};

if (plist !== null) {
  if (entry(plist, 'LSSupportsOpeningDocumentsInPlace') !== 'true') {
    violations.push('Info.plist: LSSupportsOpeningDocumentsInPlace must be true');
  }
  if (entry(plist, 'UIViewControllerBasedStatusBarAppearance') !== 'true') {
    violations.push('Info.plist: UIViewControllerBasedStatusBarAppearance must be true');
  }
  if (entry(plist, 'CFBundleDisplayName') !== expected.appName) {
    violations.push(`Info.plist: CFBundleDisplayName must be ${expected.appName}`);
  }
  const types = entry(plist, 'CFBundleDocumentTypes') ?? '';
  const dicts = [];
  for (let at = types.indexOf('<dict>'); at >= 0; ) {
    const dict = balanced(types, at, 'dict');
    if (!dict) break;
    dicts.push(dict);
    at = types.indexOf('<dict>', at + dict.length);
  }
  const pdfType = dicts.find((dict) => dict.includes(`<string>${expected.contentType}</string>`));
  if (!pdfType) {
    violations.push(`Info.plist: CFBundleDocumentTypes has no entry for ${expected.contentType}`);
  } else {
    if (!pdfType.includes(`<key>LSItemContentTypes</key>`)) violations.push('Info.plist: PDF document type has no LSItemContentTypes');
    if (entry(pdfType, 'CFBundleTypeRole') !== expected.role) violations.push(`Info.plist: PDF CFBundleTypeRole must be ${expected.role}`);
    if (entry(pdfType, 'LSHandlerRank') !== expected.rank) violations.push(`Info.plist: PDF LSHandlerRank must be ${expected.rank}`);
  }
}

if (project !== null) {
  const targets = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)].map((m) => m[1]);
  if (targets.length === 0) violations.push('project.pbxproj: no IPHONEOS_DEPLOYMENT_TARGET');
  for (const target of new Set(targets)) {
    if (target !== expected.deploymentTarget) {
      violations.push(`project.pbxproj: IPHONEOS_DEPLOYMENT_TARGET ${target} must be ${expected.deploymentTarget}`);
    }
  }
  const ids = [...project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) => m[1]);
  if (ids.length === 0) violations.push('project.pbxproj: no PRODUCT_BUNDLE_IDENTIFIER');
  for (const id of new Set(ids)) {
    if (id !== expected.appId) violations.push(`project.pbxproj: PRODUCT_BUNDLE_IDENTIFIER ${id} must be ${expected.appId}`);
  }
}

if (/\burl\s*:/.test(capacitorConfig)) violations.push('capacitor.config.ts: no remote server.url allowed');

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
}
