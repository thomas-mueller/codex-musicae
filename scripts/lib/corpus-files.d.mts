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
export function smokeEntries<T>(entries: readonly T[], count?: number): T[];
export function pickPerfPdfs(files: readonly PerfPdf[]): { largest: PerfPdf | null; regular: PerfPdf | null; heavy: PerfPdf | null };
