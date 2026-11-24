import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  fetchCorpus,
  fileNameForUrl,
  parseUrlList,
  serializeLock,
  sha256Hex,
  type CorpusCache,
  type LockEntry,
} from '../../scripts/lib/corpus.mjs';

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text);
const PDF_A = bytesOf('%PDF-1.7 a');
const PDF_B = bytesOf('%PDF-1.7 b');
const URL_A = 'https://example.org/scores/a.pdf';
const URL_B = 'https://example.org/scores/b.pdf';

function memoryCache(): CorpusCache & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    read: async (file) => files.get(file) ?? null,
    write: async (file, bytes) => void files.set(file, bytes),
  };
}

describe('corpus list and names', () => {
  it('TST-010 the URL list ignores blank lines, comments and duplicates and reports lines that are no http(s) URL', () => {
    const text = ['# scores', '', `  ${URL_A}  `, URL_A, 'ftp://example.org/x.pdf', 'not a url', URL_B].join('\r\n');
    expect(parseUrlList(text)).toEqual({ urls: [URL_A, URL_B], invalid: ['ftp://example.org/x.pdf', 'not a url'] });
  });

  it('TST-010 an empty list is valid', () => {
    expect(parseUrlList('')).toEqual({ urls: [], invalid: [] });
  });

  it('TST-010 the file name comes from the URL, gets .pdf and stays unique', () => {
    expect(fileNameForUrl('https://x.org/a/Bach%20Suite.PDF?dl=1', [])).toBe('Bach-Suite.pdf');
    expect(fileNameForUrl('https://x.org/download', [])).toBe('download.pdf');
    expect(fileNameForUrl('https://x.org/', [])).toBe('download.pdf');
    expect(fileNameForUrl('https://x.org/a.pdf', ['a.pdf', 'a-2.pdf'])).toBe('a-3.pdf');
  });

  it('TST-010 the lock file text is sorted and ends with a newline', () => {
    const lock: LockEntry[] = [
      { url: URL_B, file: 'b.pdf', sha256: 'bb' },
      { url: URL_A, file: 'a.pdf', sha256: 'aa' },
    ];
    const text = serializeLock(lock);
    expect(text.endsWith('\n')).toBe(true);
    expect((JSON.parse(text) as LockEntry[]).map((entry) => entry.file)).toEqual(['a.pdf', 'b.pdf']);
  });
});

describe('corpus download', () => {
  it('TST-011 the first download is cached and its checksum recorded in the lock', async () => {
    const cache = memoryCache();
    const result = await fetchCorpus({ urls: [URL_A], lock: [], cache, download: async () => PDF_A });
    expect(result.lock).toEqual([{ url: URL_A, file: 'a.pdf', sha256: sha256Hex(PDF_A) }]);
    expect(result.files).toEqual(['a.pdf']);
    expect(cache.files.get('a.pdf')).toEqual(PDF_A);
    expect(result.summary).toEqual({ downloaded: 1, cached: 0, skipped: 0 });
  });

  it('TST-011 a cached file with the recorded checksum is not downloaded again', async () => {
    const cache = memoryCache();
    const first = await fetchCorpus({ urls: [URL_A], lock: [], cache, download: async () => PDF_A });
    let calls = 0;
    const second = await fetchCorpus({
      urls: [URL_A],
      lock: first.lock,
      cache,
      download: async () => {
        calls += 1;
        return PDF_A;
      },
    });
    expect(calls).toBe(0);
    expect(second.summary).toEqual({ downloaded: 0, cached: 1, skipped: 0 });
  });

  it('TST-011 a download whose checksum differs from the lock is skipped with a warning and the lock stays', async () => {
    const lock: LockEntry[] = [{ url: URL_A, file: 'a.pdf', sha256: sha256Hex(PDF_A) }];
    const cache = memoryCache();
    const warnings: string[] = [];
    const result = await fetchCorpus({ urls: [URL_A], lock, cache, download: async () => PDF_B, warn: (m) => warnings.push(m) });
    expect(result.files).toEqual([]);
    expect(result.lock).toEqual(lock);
    expect(cache.files.size).toBe(0);
    expect(result.summary.skipped).toBe(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(URL_A);
  });

  it('TST-011 a failed download or an answer that is no PDF is skipped with a warning and the other URLs are still fetched', async () => {
    const warnings: string[] = [];
    const answers: Record<string, () => Promise<Uint8Array>> = {
      [URL_A]: async () => Promise.reject(new Error('HTTP 404')),
      'https://example.org/page.pdf': async () => bytesOf('<html>'),
      [URL_B]: async () => PDF_B,
    };
    const result = await fetchCorpus({
      urls: [URL_A, 'https://example.org/page.pdf', URL_B],
      lock: [],
      cache: memoryCache(),
      download: (url) => answers[url]!(),
      warn: (m) => warnings.push(m),
    });
    expect(result.files).toEqual(['b.pdf']);
    expect(result.summary).toEqual({ downloaded: 1, cached: 0, skipped: 2 });
    expect(warnings[0]).toContain('HTTP 404');
  });

  it('TST-011 offline mode never downloads and skips URLs that are not cached', async () => {
    const cache = memoryCache();
    const first = await fetchCorpus({ urls: [URL_A], lock: [], cache, download: async () => PDF_A });
    let calls = 0;
    const result = await fetchCorpus({
      urls: [URL_A, URL_B],
      lock: first.lock,
      cache,
      offline: true,
      download: async () => {
        calls += 1;
        return PDF_B;
      },
    });
    expect(calls).toBe(0);
    expect(result.summary).toEqual({ downloaded: 0, cached: 1, skipped: 1 });
  });
});

describe('corpus command', () => {
  it('TST-010 TST-011 with no PDFs and an empty URL list the command succeeds', () => {
    const root = mkdtempSync(join(tmpdir(), 'corpus-'));
    try {
      const result = spawnSync(process.execPath, ['scripts/corpus.mjs', '--offline', '--root', root], { encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('0 in folder');
      expect(result.stdout).toContain('0 URLs');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
