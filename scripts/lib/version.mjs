// Version strings (V2-M1 S4, PIP-018, PIP-019, PIP-020). One place that turns `git describe --tags --always --long [--dirty]` into the
// forms the platforms need; generate-version.mjs, version-info.mjs (used by the workflows) and check-versions.mjs all use it.

const DESCRIBE = /^(v\d+\.\d+\.\d+)(?:-\d+-g[0-9a-f]+)?(?:-dirty)?$/;
export const NO_TAG_VERSION = 'v0.0.0';

/** `vX.Y.Z` of the nearest tag: v1.5.0-3-gabc1234-dirty -> v1.5.0, v2.0.0 -> v2.0.0, no tag (sha only, unknown) -> v0.0.0. */
export function displayVersion(raw) {
  return DESCRIBE.exec(String(raw).trim())?.[1] ?? NO_TAG_VERSION;
}

/** `X.Y.Z` without the `v` and without a describe suffix: Android versionName and iOS MARKETING_VERSION (the web shows the same numbers). */
export function platformVersionName(raw) {
  return displayVersion(raw).slice(1);
}
