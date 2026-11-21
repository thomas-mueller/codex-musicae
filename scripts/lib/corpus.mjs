// Real-PDF corpus (V2-M2 S1, TST-010, TST-011): the owner supplies only PDF files (e2e/corpus/real/) and URLs (e2e/corpus/urls.txt).
// This module holds the logic of `npm run corpus`; network and file access are injected so it can be tested without either.
import { createHash } from 'node:crypto';

/* global fetch, AbortSignal, TextDecoder */

/** Longest wait for one download in milliseconds. */
export const DOWNLOAD_TIMEOUT_MS = 60_000;
/** Largest accepted download in bytes (200 MiB). */
export const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;
const PDF_MAGIC = '%PDF-';
const NAME_FALLBACK = 'download';

/** URLs of a list file: one per line, blank lines and `#` comments ignored, duplicates dropped; lines that are not http(s) URLs are returned as `invalid`. */
export function parseUrlList(text) {
  const urls = [];
  const invalid = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    let ok;
    try {
      ok = /^https?:$/.test(new URL(line).protocol);
    } catch {
      ok = false;
    }
    if (!ok) invalid.push(line);
    else if (!urls.includes(line)) urls.push(line);
  }
  return { urls, invalid };
}

/** File name for a URL: last path segment, decoded and sanitized, `.pdf` appended when missing; a taken name gets `-2`, `-3`, … */
export function fileNameForUrl(url, taken) {
  let segment;
  try {
    segment = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
  } catch {
    segment = '';
  }
  let base = segment.replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  if (base === '') base = NAME_FALLBACK;
  const takenSet = new Set(taken);
  let name = `${base}.pdf`;
  for (let n = 2; takenSet.has(name); n += 1) name = `${base}-${n}.pdf`;
  return name;
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** True when `bytes` start like a PDF. */
export function looksLikePdf(bytes) {
  return new TextDecoder('latin1').decode(bytes.subarray(0, PDF_MAGIC.length)) === PDF_MAGIC;
}

/** The default downloader: `fetch` with timeout and size limit; returns bytes or throws. */
export async function httpDownload(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS), redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error('file too large');
  return bytes;
}

/**
 * Brings the URL list into the cache and the lock (`[{ url, file, sha256 }]`). Never throws: a failed download, a non-PDF answer or a
 * checksum that differs from the lock skips the entry with a warning (TST-011). The first download of a URL records its checksum.
 * `cache` is `{ read(file) -> bytes | null, write(file, bytes) }`; `download(url)` returns bytes or throws; `offline` never downloads.
 */
export async function fetchCorpus({ urls, lock, cache, download, offline = false, warn = () => {} }) {
  const nextLock = lock.map((entry) => ({ ...entry }));
  const files = [];
  const summary = { downloaded: 0, cached: 0, skipped: 0 };
  const skip = (url, reason) => {
    summary.skipped += 1;
    warn(`skipped ${url}: ${reason}`);
  };
  for (const url of urls) {
    const entry = nextLock.find((candidate) => candidate.url === url);
    if (entry) {
      const cached = await cache.read(entry.file);
      if (cached && sha256Hex(cached) === entry.sha256) {
        files.push(entry.file);
        summary.cached += 1;
        continue;
      }
    }
    if (offline) {
      skip(url, 'not cached (offline)');
      continue;
    }
    let bytes;
    try {
      bytes = await download(url);
    } catch (error) {
      skip(url, `download failed (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }
    if (!looksLikePdf(bytes)) {
      skip(url, 'the answer is not a PDF');
      continue;
    }
    const sha256 = sha256Hex(bytes);
    if (entry && entry.sha256 !== sha256) {
      skip(url, 'checksum differs from the lock file (delete its entry to accept the new file)');
      continue;
    }
    const file = entry?.file ?? fileNameForUrl(url, nextLock.map((candidate) => candidate.file));
    await cache.write(file, bytes);
    if (!entry) nextLock.push({ url, file, sha256 });
    files.push(file);
    summary.downloaded += 1;
  }
  return { lock: nextLock, files, summary };
}

/** Lock file text: stable order, trailing newline. */
export function serializeLock(lock) {
  return `${JSON.stringify([...lock].sort((a, b) => a.url.localeCompare(b.url)), null, 2)}\n`;
}
