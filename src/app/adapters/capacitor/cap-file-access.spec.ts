import { CapFileAccess } from './cap-file-access';
import { fakeDocumentAccess } from './fake-document-access';

const CHUNK = 4;
const bytesOf = (n: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 1) % 256);

function setup() {
  const plugin = fakeDocumentAccess();
  return { plugin, access: new CapFileAccess(plugin, CHUNK) };
}

describe('CapFileAccess', () => {
  it('PLT-008 pickPdfs assembles the chunks into one array and keeps the writable flag', async () => {
    const { plugin, access } = setup();
    const content = bytesOf(10);
    plugin.files.set('a', { bytes: content, writable: true });
    plugin.picked = [{ id: 'a', name: 'a.pdf', size: 10, lastModified: 5, writable: false }];
    const result = await access.pickPdfs();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.bytes).toEqual(content);
    expect(result.value[0]?.writable).toBe(false);
    expect(result.value[0]?.ref).toEqual({ id: 'a', name: 'a.pdf', size: 10, lastModified: 5 });
    expect(plugin.calls.filter((c) => c.startsWith('readChunk'))).toEqual(['readChunk:0:4', 'readChunk:4:4', 'readChunk:8:2']);
    expect(plugin.calls).toContain('closeRead');
  });

  it('PLT-008 an empty pick is cancelled and a plugin error maps to its code', async () => {
    const { plugin, access } = setup();
    expect(await access.pickPdfs()).toEqual({ ok: false, error: 'cancelled' });
    plugin.fail.set('pickDocuments', 'denied');
    expect(await access.pickPdfs()).toEqual({ ok: false, error: 'denied' });
  });

  it('PLT-008 reopen: ok, not-found for an unknown id, denied when the permission is gone', async () => {
    const { plugin, access } = setup();
    plugin.files.set('a', { bytes: bytesOf(6), writable: true });
    const ref = { id: 'a', name: 'a.pdf' };
    const opened = await access.reopen(ref);
    expect(opened.ok && opened.value.writable).toBe(true);
    expect(await access.reopen({ id: 'zzz', name: 'x.pdf' })).toEqual({ ok: false, error: 'not-found' });
    plugin.fail.set('openRead', 'denied');
    expect(await access.reopen(ref)).toEqual({ ok: false, error: 'denied' });
  });

  it('PLT-008 FIL-018 a failing read closes the handle and reports read-failed', async () => {
    const { plugin, access } = setup();
    plugin.files.set('a', { bytes: bytesOf(6), writable: true });
    plugin.fail.set('readChunk', 'weird');
    expect(await access.reopen({ id: 'a', name: 'a.pdf' })).toEqual({ ok: false, error: 'read-failed' });
    expect(plugin.calls).toContain('closeRead');
  });

  it('PLT-008 write sends chunks to a temp file and commits once', async () => {
    const { plugin, access } = setup();
    plugin.files.set('a', { bytes: bytesOf(3), writable: true });
    const content = bytesOf(9);
    expect(await access.write({ id: 'a', name: 'a.pdf' }, content)).toEqual({ ok: true, value: undefined });
    expect(plugin.calls.filter((c) => c === 'writeChunk').length).toBe(3);
    expect(plugin.calls.filter((c) => c === 'commitWrite').length).toBe(1);
    expect(plugin.files.get('a')?.bytes).toEqual(content);
  });

  it('PLT-008 any write error aborts the temp file and answers write-failed; the original is untouched', async () => {
    const { plugin, access } = setup();
    const original = bytesOf(3);
    plugin.files.set('a', { bytes: original, writable: true });
    plugin.fail.set('writeChunk', 'denied');
    expect(await access.write({ id: 'a', name: 'a.pdf' }, bytesOf(9))).toEqual({ ok: false, error: 'write-failed' });
    expect(plugin.calls).toContain('abortWrite');
    expect(plugin.calls).not.toContain('commitWrite');
    expect(plugin.files.get('a')?.bytes).toEqual(original);
  });

  it('PLT-008 saveCopy writes the new document and forgets its reference; cancel answers cancelled', async () => {
    const { plugin, access } = setup();
    expect(await access.saveCopy('x.pdf', bytesOf(5))).toEqual({ ok: false, error: 'cancelled' });
    plugin.created = 'copy';
    const content = bytesOf(5);
    expect((await access.saveCopy('x.pdf', content)).ok).toBe(true);
    expect(plugin.files.get('copy')?.bytes).toEqual(content);
    expect(plugin.calls).toContain('forget:copy');
  });

  it('PLT-008 requestWriteAccess is unsupported; isSame compares ids, then name size and date; forget calls the plugin', async () => {
    const { plugin, access } = setup();
    expect(await access.requestWriteAccess()).toEqual({ ok: false, error: 'unsupported' });
    const a = { id: 'a', name: 'n.pdf', size: 1, lastModified: 2 };
    expect(await access.isSame(a, { ...a })).toBe(true);
    expect(await access.isSame(a, { ...a, id: 'b' })).toBe(true);
    expect(await access.isSame(a, { ...a, id: 'b', size: 9 })).toBe(false);
    expect(await access.isSame({ id: 'a', name: 'n' }, { id: 'b', name: 'n' })).toBe(false);
    await access.forget(a);
    expect(plugin.calls).toContain('forget:a');
  });
});
