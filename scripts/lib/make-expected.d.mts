export interface CorpusPdf {
  file: string;
  source: 'folder' | 'url';
}
export interface ExpectedEntry {
  file: string;
  source?: 'folder' | 'url';
  suites?: string[];
  tags?: string[];
  profiles?: string[];
  engines?: string[];
  systemsPerPage: (number | null)[];
  deviations?: { profile: string; engine?: string; systemsPerPage: (number | null)[]; note?: string }[];
  pages?: number;
  note: string;
  reviewed?: boolean;
}
export const PROPOSAL_PROFILE: string;
export function proposeSuites(measurement: (number | null)[] | { load: true; pages: number }): string[];
export function listCorpusPdfs(options: { realFiles: string[]; cacheFiles: string[] }): { pdfs: CorpusPdf[]; warnings: string[] };
export function isReviewed(entry: { reviewed?: boolean }): boolean;
export function selectToMeasure(options: { pdfs: CorpusPdf[]; entries: ExpectedEntry[]; force?: boolean }): CorpusPdf[];
export function mergeProposals(options: {
  entries: ExpectedEntry[];
  pdfs: CorpusPdf[];
  measured: Record<string, (number | null)[] | { load: true; pages: number }>;
  force?: boolean;
  profiles?: Record<string, { default?: boolean }>;
}): { entries: ExpectedEntry[]; added: string[]; refreshed: string[]; kept: string[]; warnings: string[]; problems: string[] };
export function serializeExpected(entries: readonly ExpectedEntry[]): string;
