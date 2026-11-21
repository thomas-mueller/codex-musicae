export interface LockEntry {
  url: string;
  file: string;
  sha256: string;
}
export interface CorpusCache {
  read(file: string): Promise<Uint8Array | null>;
  write(file: string, bytes: Uint8Array): Promise<void>;
}
export const DOWNLOAD_TIMEOUT_MS: number;
export const MAX_DOWNLOAD_BYTES: number;
export function parseUrlList(text: string): { urls: string[]; invalid: string[] };
export function fileNameForUrl(url: string, taken: Iterable<string>): string;
export function sha256Hex(bytes: Uint8Array): string;
export function looksLikePdf(bytes: Uint8Array): boolean;
export function httpDownload(url: string): Promise<Uint8Array>;
export function fetchCorpus(options: {
  urls: string[];
  lock: LockEntry[];
  cache: CorpusCache;
  download: (url: string) => Promise<Uint8Array>;
  offline?: boolean;
  warn?: (message: string) => void;
}): Promise<{
  lock: LockEntry[];
  files: string[];
  summary: { downloaded: number; cached: number; skipped: number };
}>;
export function serializeLock(lock: readonly LockEntry[]): string;
