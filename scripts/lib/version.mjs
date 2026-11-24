// Version strings (V2-M1 S4, PIP-018, PIP-019, PIP-020). One place that turns `git describe --tags --always --long [--dirty]` into the
// forms the platforms need; generate-version.mjs, version-info.mjs (used by the workflows) and check-versions.mjs all use it.

const DESCRIBE = /^v(\d+)\.(\d+)\.(\d+)(?:-(\d+)-g[0-9a-f]+)?(?:-dirty)?$/;
export const NO_TAG_VERSION = 'v0.0.0';

/**
 * `vX.Y.Z` where X.Y come from the nearest tag and Z is the tag's patch number plus the number of commits since that tag (PIP-018).
 * v1.1.0-19-gabc1234-dirty -> v1.1.19, v1.1.5-3-gabc1234 -> v1.1.8, v2.0.0 -> v2.0.0, no tag (sha only, unknown) -> v0.0.0.
 * Neither the hash nor the dirty flag appear in the result.
 */
export function displayVersion(raw) {
  const match = DESCRIBE.exec(String(raw).trim());
  if (match === null) return NO_TAG_VERSION;
  const [, major, minor, patch, ahead] = match;
  return `v${major}.${minor}.${Number(patch) + Number(ahead ?? 0)}`;
}

/** `X.Y.Z` without the `v` and without a describe suffix: Android versionName and iOS MARKETING_VERSION (the web shows the same numbers). */
export function platformVersionName(raw) {
  return displayVersion(raw).slice(1);
}
