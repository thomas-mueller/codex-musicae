export interface PerfPdf {
  file: string;
  path: string;
  source?: 'folder' | 'url';
  bytes: number;
  pages: number;
  stress?: boolean;
}
export const CORPUS_FOLDERS: string[];
export const SMOKE_ENTRY_COUNT: number;
export const STRESS_MIN_PAGES: number;
export const MIN_PERF_SLIDE_CHANGES: number;
export function resolveCorpusEntry(options: { entry: { file: string }; exists: (path: string) => boolean }): { path: string | null; reason: string | null };
export function entriesOf<T extends { suites?: readonly string[] }>(entries: readonly T[], suite: string): T[];
export function enginesOf(entry: { engines?: readonly string[] }): string[];
export function profilesOf(entry: { profiles?: readonly string[] }, profiles: Record<string, { default?: boolean }>): string[];
export function expectedFor<T extends (number | null)[]>(
  entry: { systemsPerPage: T; deviations?: readonly { profile: string; engine?: string; systemsPerPage: T }[] },
  profile: string,
  engine: string,
): T;
export function smokeEntries<T>(entries: readonly T[], count?: number): T[];
export function pickPerfPdfs(files: readonly PerfPdf[]): { largest: PerfPdf | null; regular: PerfPdf | null; heavy: PerfPdf | null };
