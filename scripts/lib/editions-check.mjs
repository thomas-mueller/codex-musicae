// Edition consistency checks (V2-M3 S4, EDN-010, EDN-013, GEN-011). Pure logic; scripts/check-editions.mjs feeds it the real files.
import { appIds, editionFiles } from './edition-files.mjs';

/** Findings for angular.json: web has no replacement; both native builds replace the web feature file; only native-paid defines EDITION. */
export function checkAngularConfigurations(angularJson) {
  const findings = [];
  const configurations = angularJson?.projects?.['codex-musicae']?.architect?.build?.configurations ?? {};
  const replaces = (name) => (configurations[name]?.fileReplacements ?? []).some(
    (r) => r.replace === 'src/config/features.web.ts' && r.with === 'src/config/features.native.ts',
  );
  const edition = (name) => configurations[name]?.define?.EDITION;
  if (!configurations.web) findings.push('angular.json: the build configuration web is missing');
  if ((configurations.web?.fileReplacements ?? []).length > 0 || configurations.web?.define) findings.push('angular.json: web must neither replace a file nor define EDITION');
  for (const name of ['native-free', 'native-paid']) {
    if (!replaces(name)) findings.push(`angular.json: ${name} must replace features.web.ts with features.native.ts`);
  }
  if (edition('native-paid') !== "'paid'") findings.push("angular.json: native-paid must define EDITION as 'paid'");
  if (edition('native-free') !== undefined) findings.push('angular.json: native-free must not define EDITION');
  if (angularJson?.projects?.['codex-musicae']?.architect?.build?.options?.define?.EDITION !== "'free'") {
    findings.push("angular.json: the build options must define EDITION as 'free' (the default of every build)");
  }
  return findings;
}

/** Findings for the generated edition files: free and paid IDs differ, each file carries its edition's ID, Gradle and Xcode read them. */
export function checkEditionFiles(tunables, buildGradle, xcconfig) {
  const findings = [];
  const ids = appIds(tunables);
  if (!ids.free || !ids.paid) return ['tunables.ts: appId and appIdPaid are required'];
  if (ids.free === ids.paid) findings.push('tunables.ts: the free and the paid app need distinct IDs');
  for (const [edition, id] of Object.entries(ids)) {
    const files = editionFiles(tunables, edition);
    if (!files['android/edition.properties'].includes(`appId=${id}\n`)) findings.push(`apply-edition: android/edition.properties does not carry the ${edition} ID`);
    if (!files['ios/edition.xcconfig'].includes(`APP_BUNDLE_ID = ${id}\n`)) findings.push(`apply-edition: ios/edition.xcconfig does not carry the ${edition} ID`);
  }
  if (!/edition\.properties/.test(buildGradle) || !/applicationId appId\b/.test(buildGradle)) findings.push('build.gradle: applicationId must come from edition.properties');
  if (!buildGradle.includes(`getProperty('appId', '${ids.free}')`)) findings.push(`build.gradle: the default applicationId must be ${ids.free} (the free app)`);
  if (!/#include\?\s+"edition\.xcconfig"/.test(xcconfig)) findings.push('app-id.xcconfig: must include edition.xcconfig');
  return findings;
}

/** Findings for a native workflow (android.yml, ios.yml): one run per edition, the matching web build, the edition applied first. */
export function checkEditionWorkflow(name, workflow, tunables) {
  const findings = [];
  const ids = appIds(tunables);
  const code = workflow.replace(/^\s*#.*$/gm, '');
  const matrixIds = [...code.matchAll(/^\s+appId:\s*(\S+)/gm)].map((m) => m[1]).sort();
  const editions = [...code.matchAll(/^\s+- edition:\s*(\S+)/gm)].map((m) => m[1]).sort();
  if (matrixIds.join() !== [ids.free, ids.paid].sort().join()) findings.push(`${name}: the matrix must build ${ids.free} and ${ids.paid}`);
  if (editions.join() !== 'free,paid') findings.push(`${name}: the matrix needs the editions free and paid`);
  if (!code.includes('node scripts/apply-edition.mjs ${{ matrix.edition }}')) findings.push(`${name}: must run apply-edition for the matrix edition`);
  if (!/script:\s*build:native-\$\{\{ matrix\.edition \}\}/.test(code)) findings.push(`${name}: must build build:native-<edition> (never the plain build)`);
  if (!code.includes('CAP_EDITION: ${{ matrix.edition }}')) findings.push(`${name}: cap sync must run with CAP_EDITION`);
  return findings;
}

/** Findings for a built native or web bundle: the web feature file holds the web-only switch, the native one must not. */
export function checkBuiltBundle(kind, bundleTexts) {
  const hasWebOnly = bundleTexts.some((text) => text.includes('webOrganizational'));
  if (kind === 'web' && !hasWebOnly) return ['the web build does not contain features.web.ts (webOrganizational is missing)'];
  if (kind === 'native' && hasWebOnly) return ['a native build contains features.web.ts (webOrganizational is present)'];
  return [];
}
