import { WebWakeLock } from './web-wake-lock';
import type { WakeLockEnv } from './web-wake-lock';

function fakeEnv(supported = true) {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const sentinels: Array<{ released: boolean; release(): Promise<void> }> = [];
  const env: WakeLockEnv = {
    document: doc,
    wakeLock: supported
      ? {
          request: () => {
            const sentinel = {
              released: false,
              release: () => {
                sentinel.released = true;
                return Promise.resolve();
              },
            };
            sentinels.push(sentinel);
            return Promise.resolve(sentinel);
          },
        }
      : undefined,
  };
  return { env, doc, sentinels };
}

describe('WebWakeLock', () => {
  it('PLT-005 acquires and releases the sentinel', async () => {
    const { env, sentinels } = fakeEnv();
    const lock = new WebWakeLock(env);
    expect((await lock.acquire()).ok).toBe(true);
    expect(sentinels.length).toBe(1);
    await lock.release();
    expect(sentinels[0]!.released).toBe(true);
  });

  it('PLT-005 re-acquires when the page becomes visible again while wanted', async () => {
    const { env, doc, sentinels } = fakeEnv();
    const lock = new WebWakeLock(env);
    await lock.acquire();
    sentinels[0]!.released = true; // the browser drops the lock when the page is hidden
    doc.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(sentinels.length).toBe(2);
  });

  it('PLT-005 does not re-acquire after release()', async () => {
    const { env, doc, sentinels } = fakeEnv();
    const lock = new WebWakeLock(env);
    await lock.acquire();
    await lock.release();
    doc.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(sentinels.length).toBe(1);
  });

  it('PLT-005 returns unsupported without the API', async () => {
    expect(await new WebWakeLock(fakeEnv(false).env).acquire()).toEqual({ ok: false, error: 'unsupported' });
  });
});
