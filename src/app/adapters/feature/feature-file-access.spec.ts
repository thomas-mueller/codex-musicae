import { ALL_FEATURES_ON } from '../../../testing/provide-test-ports';
import type { FeatureFlags } from '../../ports/feature-flags';
import { fakeFileAccess } from '../../state/testing/fake-ports';
import { FeatureFileAccess, persistsFileHandles } from './feature-file-access';

const REF = { id: 'a', name: 'a.pdf' };
const BYTES = new Uint8Array([1]);
const OFF: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;

describe('FeatureFileAccess', () => {
  it('EDN-001 EDN-011 without autosave and saveCopy no write, access request or copy reaches the adapter', async () => {
    const inner = fakeFileAccess();
    const access = new FeatureFileAccess(inner, OFF);
    for (const result of [await access.write(REF, BYTES), await access.requestWriteAccess(REF), await access.saveCopy('a.pdf', BYTES)]) {
      expect(result).toEqual({ ok: false, error: 'unsupported' });
    }
    expect(inner.write).not.toHaveBeenCalled();
    expect(inner.requestWriteAccess).not.toHaveBeenCalled();
    expect(inner.saveCopy).not.toHaveBeenCalled();
  });

  it('EDN-001 the switches decide separately: saveCopy allows copies only, autosave allows writes only', async () => {
    const copyOnly = fakeFileAccess();
    await new FeatureFileAccess(copyOnly, { ...OFF, saveCopy: true }).write(REF, BYTES);
    await new FeatureFileAccess(copyOnly, { ...OFF, saveCopy: true }).saveCopy('a.pdf', BYTES);
    expect(copyOnly.write).not.toHaveBeenCalled();
    expect(copyOnly.saveCopy).toHaveBeenCalledTimes(1);
    const writeOnly = fakeFileAccess();
    await new FeatureFileAccess(writeOnly, { ...OFF, autosave: true }).saveCopy('a.pdf', BYTES);
    await new FeatureFileAccess(writeOnly, { ...OFF, autosave: true }).write(REF, BYTES);
    expect(writeOnly.saveCopy).not.toHaveBeenCalled();
    expect(writeOnly.write).toHaveBeenCalledTimes(1);
  });

  it.each(['recentFiles', 'sessionRestore', 'persistFileChoices'] as const)('EDN-005 %s alone keeps stored handles usable', async (name) => {
    const inner = fakeFileAccess();
    const access = new FeatureFileAccess(inner, { ...OFF, [name]: true });
    expect(persistsFileHandles({ ...OFF, [name]: true })).toBe(true);
    await access.forget(REF);
    expect(inner.forget).toHaveBeenCalledWith(REF);
  });

  it('EDN-005 without a handle-persisting switch nothing is reopened or forgotten', async () => {
    const inner = fakeFileAccess();
    const reopen = vi.spyOn(inner, 'reopen');
    const access = new FeatureFileAccess(inner, OFF);
    expect(persistsFileHandles(OFF)).toBe(false);
    expect(await access.reopen(REF)).toEqual({ ok: false, error: 'not-found' });
    await access.forget(REF);
    expect(reopen).not.toHaveBeenCalled();
    expect(inner.forget).not.toHaveBeenCalled();
  });

  it('EDN-008 EDN-002 picking and comparing files work in every configuration', async () => {
    const access = new FeatureFileAccess(fakeFileAccess(), OFF);
    expect(await access.pickPdfs()).toEqual({ ok: false, error: 'cancelled' });
    expect(await access.isSame(REF, { id: 'b', name: 'a.pdf' })).toBe(true);
  });

  it('EDN-008 with every switch on all calls reach the adapter', async () => {
    const inner = fakeFileAccess();
    const access = new FeatureFileAccess(inner, ALL_FEATURES_ON);
    await access.write(REF, BYTES);
    await access.requestWriteAccess(REF);
    await access.saveCopy('a.pdf', BYTES);
    await access.forget(REF);
    expect(inner.write).toHaveBeenCalled();
    expect(inner.requestWriteAccess).toHaveBeenCalled();
    expect(inner.saveCopy).toHaveBeenCalled();
    expect(inner.forget).toHaveBeenCalled();
  });
});
