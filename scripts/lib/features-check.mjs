// Feature-configuration check (V2-M3 S1, EDN-013). Pure logic; scripts/check-features.mjs feeds it the two files in src/config/.

/** Switches that exist in the web file only (R-22l, EDN-009). */
export const WEB_ONLY_KEYS = ['webOrganizational'];

/** Returns { key: { value, commented } } for every `key: true|false|other,` line of the exported object. */
export function parseSwitches(text) {
  const switches = {};
  for (const line of text.split('\n')) {
    const match = /^\s{2}(\w+):\s*([^,]+),(.*)$/.exec(line);
    if (match) switches[match[1]] = { value: match[2].trim(), commented: match[3].includes('//') };
  }
  return switches;
}

/** One message per violation: shared key missing in a file, web-only key in the native file, non-boolean value, switch without comment. */
export function checkFeatureFiles(webText, nativeText) {
  const web = parseSwitches(webText);
  const native = parseSwitches(nativeText);
  const findings = [];
  const shared = new Set([...Object.keys(web), ...Object.keys(native)].filter((key) => !WEB_ONLY_KEYS.includes(key)));
  for (const key of shared) {
    if (!(key in web)) findings.push(`${key} is missing in features.web.ts`);
    if (!(key in native)) findings.push(`${key} is missing in features.native.ts`);
  }
  for (const key of WEB_ONLY_KEYS) {
    if (!(key in web)) findings.push(`web-only ${key} is missing in features.web.ts`);
    if (key in native) findings.push(`web-only ${key} must not be in features.native.ts`);
  }
  for (const [file, switches] of [['features.web.ts', web], ['features.native.ts', native]]) {
    for (const [key, { value, commented }] of Object.entries(switches)) {
      if (value !== 'true' && value !== 'false') findings.push(`${key} in ${file} is not a boolean literal`);
      if (!commented) findings.push(`${key} in ${file} has no comment`);
    }
  }
  return findings;
}
