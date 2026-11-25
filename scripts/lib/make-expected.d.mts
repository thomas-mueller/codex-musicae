export interface CorpusPdf {
  file: string;
  source: 'folder' | 'url';
}
export interface ExpectedEntry {
  file: string;
  source?: 'folder' | 'url';
  level: string;
  suites?: string[];
  systemsPerPage: (number | null)[];
  pages?: number;
  stress?: boolean;
  note: string;
  knownLimitation: string | null;
  reviewed?: boolean;
}
export const PROPOSAL_LEVEL: string;
export function listCorpusPdfs(options: { realFiles: string[]; cacheFiles: string[] }): { pdfs: CorpusPdf[]; warnings: string[] };
export function isReviewed(entry: { reviewed?: boolean }): boolean;
export function selectToMeasure(options: { pdfs: CorpusPdf[]; entries: ExpectedEntry[]; force?: boolean }): CorpusPdf[];
export function mergeProposals(options: {
  entries: ExpectedEntry[];
  pdfs: CorpusPdf[];
  measured: Record<string, (number | null)[] | { stress: true; pages: number }>;
  force?: boolean;
}): { entries: ExpectedEntry[]; added: string[]; refreshed: string[]; kept: string[]; warnings: string[] };
export function serializeExpected(entries: readonly ExpectedEntry[]): string;
