export type CorpusSuite = 'detection' | 'load';
export type CorpusEngine = 'chromium' | 'firefox' | 'webkit';
export interface CorpusDeviation {
  profile: string;
  engine?: string;
  systemsPerPage: (number | null)[];
  note?: string;
}
export interface CorpusEntry {
  file: string;
  source?: 'folder' | 'url';
  suites: string[];
  tags?: string[];
  profiles?: string[];
  engines?: string[];
  systemsPerPage: (number | null)[];
  deviations?: CorpusDeviation[];
  pages?: number;
  note: string;
  reviewed?: boolean;
}
export const SUITES: readonly CorpusSuite[];
export const ENGINES: readonly CorpusEngine[];
export function validateEntry(entry: Partial<CorpusEntry>, profiles: Record<string, { default?: boolean }>): string[];
