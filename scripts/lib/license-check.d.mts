export interface LicensePackage {
  name: string;
  version?: string;
  license?: string;
}
export interface LicenseRow {
  name: string;
  version: string;
  license: string;
  ok: boolean;
}
export function isAllowed(expression: string | undefined, allowed: readonly string[]): boolean;
export function checkLicenses(packages: readonly LicensePackage[], allowed: readonly string[]): { rows: LicenseRow[]; violations: string[] };
export function formatTable(rows: readonly LicenseRow[]): string;
