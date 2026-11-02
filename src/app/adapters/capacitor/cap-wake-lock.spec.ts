import { CapWakeLock } from './cap-wake-lock';
import type { ImmersivePluginApi } from './immersive-plugin';

function fakePlugin(fail = false): ImmersivePluginApi & { awake: boolean[] } {
  const awake: boolean[] = [];
  return {
    awake,
    enter: () => Promise.resolve(),
    exit: () => Promise.resolve(),
    setKeepAwake: ({ on }) => {
      awake.push(on);
      return fail ? Promise.reject(new Error('native')) : Promise.resolve();
    },
  };
}

describe('CapWakeLock', () => {
  it('PLT-005 acquire and release set and clear the keep-awake flag', async () => {
    const plugin = fakePlugin();
    const lock = new CapWakeLock(plugin);
    expect((await lock.acquire()).ok).toBe(true);
    await lock.release();
    expect(plugin.awake).toEqual([true, false]);
  });

  it('PLT-005 a plugin error becomes denied', async () => {
    expect(await new CapWakeLock(fakePlugin(true)).acquire()).toEqual({ ok: false, error: 'denied' });
  });
});
