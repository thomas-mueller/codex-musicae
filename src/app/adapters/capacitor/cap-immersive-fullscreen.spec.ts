import { CapImmersiveFullscreen } from './cap-immersive-fullscreen';
import type { ImmersivePluginApi } from './immersive-plugin';

function fakePlugin(fail = false): ImmersivePluginApi & { calls: string[] } {
  const calls: string[] = [];
  const respond = (): Promise<void> => (fail ? Promise.reject(new Error('native')) : Promise.resolve());
  return {
    calls,
    enter: () => { calls.push('enter'); return respond(); },
    exit: () => { calls.push('exit'); return respond(); },
    setKeepAwake: ({ on }) => { calls.push(`awake:${on}`); return respond(); },
  };
}

describe('CapImmersiveFullscreen', () => {
  it('PLT-006 enter calls the plugin and sets active; exit clears it', async () => {
    const plugin = fakePlugin();
    const fullscreen = new CapImmersiveFullscreen(plugin);
    expect((await fullscreen.enter()).ok).toBe(true);
    expect(fullscreen.active()).toBe(true);
    await fullscreen.exit();
    expect(fullscreen.active()).toBe(false);
    expect(plugin.calls).toEqual(['enter', 'exit']);
  });

  it('PLT-006 a plugin error becomes denied and leaves active false', async () => {
    const fullscreen = new CapImmersiveFullscreen(fakePlugin(true));
    expect(await fullscreen.enter()).toEqual({ ok: false, error: 'denied' });
    expect(fullscreen.active()).toBe(false);
  });

  it('PLT-006 exit never throws when the plugin fails', async () => {
    await expect(new CapImmersiveFullscreen(fakePlugin(true)).exit()).resolves.toBeUndefined();
  });
});
