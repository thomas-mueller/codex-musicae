// iOS shell configuration check (M18 S1-S4, PLT-012, PLT-013, PLT-014, PIP-004, PIP-010, GEN-003): the only automated proof for the Xcode project and Info.plist
// besides the CI compile. Reads the expected values from src/config/tunables.ts. With a directory argument it checks that
// copy of the `ios` folder and, as further arguments, that copy of the workflow and of the tester document (used by the lint self-test); exits non-zero with one line per violation.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const iosDir = process.argv[2] ?? 'ios';
const workflowPath = process.argv[3] ?? '.github/workflows/ios.yml';
const handoverPath = process.argv[4] ?? 'docs/ios-unverified.md';
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

const handover = await readFile(handoverPath, 'utf8').catch(() => null);
if (handover === null) violations.push('docs/ios-unverified.md is missing');

// Every Swift source of the app carries the UNVERIFIED(ios) marker and is part of the build (PLT-013).
const swiftFiles = (await readdir(join(iosDir, 'App/App')).catch(() => [])).filter((name) => name.endsWith('.swift'));
for (const name of swiftFiles) {
  const source = await readFile(join(iosDir, 'App/App', name), 'utf8');
  if (!source.includes('UNVERIFIED(ios)')) violations.push(`${name}: missing the UNVERIFIED(ios) marker`);
  if (handover !== null && !handover.includes(name)) violations.push(`${handoverPath}: ${name} is not in the table of unverified code`);
  if (project !== null && !project.includes(`${name} in Sources`)) violations.push(`project.pbxproj: ${name} is not in the Sources build phase`);
}

// The ios workflow (PIP-004, PIP-010): unsigned simulator build on a macOS runner after lint-test, then signed steps that only run
// when the Apple secrets exist and never leak them.
const SECRETS = ['IOS_CERTIFICATE_BASE64', 'IOS_CERTIFICATE_PASSWORD', 'IOS_PROVISIONING_PROFILE_BASE64', 'FIREBASE_SERVICE_ACCOUNT_CODEX_MUSICAE'];
const GATE = "steps.gate.outputs.available == 'true'";
const SIGNED = /security import|xcodebuild archive|-exportArchive|appdistribution|PlistBuddy/;
const workflow = await readFile(workflowPath, 'utf8').catch(() => null);
if (workflow === null) {
  violations.push('ios.yml is missing');
} else {
  const code = workflow.replace(/^\s*#.*$/gm, '');
  if (!/^name:\s*ios\s*$/m.test(code)) violations.push('ios.yml: name must be ios');
  if (!/^\s*runs-on:\s*macos-latest\s*$/m.test(code)) violations.push('ios.yml: runs-on must be macos-latest');
  if (!/workflow_run:[\s\S]*?workflows:\s*\n\s*-\s*lint-test\b/.test(code)) violations.push('ios.yml: must be triggered by workflow_run of lint-test');
  if (!code.includes('xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build')) {
    violations.push('ios.yml: the unsigned simulator build is missing');
  }
  for (const name of new Set([...code.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))) {
    if (!SECRETS.includes(name)) violations.push(`ios.yml: secret ${name} is not on the list`);
  }
  const steps = code.split(/^ {6}- name:/m).slice(1);
  const isGate = (step) => /\n\s+id:\s*gate\s*\n/.test(step);
  if (!steps.some(isGate)) violations.push('ios.yml: the signing gate step (id: gate) is missing');
  for (const step of steps) {
    const title = step.split('\n')[0].trim();
    if (!isGate(step) && (SIGNED.test(step) || /secrets\./.test(step)) && !step.includes(GATE)) {
      violations.push(`ios.yml: step "${title}" uses signing or secrets without the gate (${GATE})`);
    }
    if (/\bset -x\b|xtrace|\b(echo|cat|printenv)\b[^\n]*(CERTIFICATE|PASSWORD|PROFILE_BASE64|SERVICE_ACCOUNT)/.test(step)) {
      violations.push(`ios.yml: step "${title}" may print a secret`);
    }
  }
  const upload = steps.find((step) => step.includes('appdistribution:distribute')) ?? '';
  if (!upload.includes('FIREBASE_OWNERS_TESTER_GROUPS') || !upload.includes('head_branch')) {
    violations.push('ios.yml: the Firebase upload must send to the owners group and decide the iOS group by the branch');
  }
  if (/--groups\s+"\$FIREBASE_IOS_TESTER_GROUPS"/.test(upload)) violations.push('ios.yml: the iOS tester group must not be passed unconditionally');
  const expectedBundleId = [...code.matchAll(/EXPECTED_BUNDLE_ID:\s*(\S+)/g)].map((m) => m[1]);
  if (expectedBundleId.length === 0 || expectedBundleId.some((id) => id !== expected.appId)) violations.push(`ios.yml: EXPECTED_BUNDLE_ID must be ${expected.appId}`);
  if (!new RegExp(`EXPECTED_MIN_OS:\\s*'${expected.deploymentTarget}'`).test(code)) violations.push(`ios.yml: EXPECTED_MIN_OS must be ${expected.deploymentTarget}`);
}

if (/\burl\s*:/.test(capacitorConfig)) violations.push('capacitor.config.ts: no remote server.url allowed');

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
}
