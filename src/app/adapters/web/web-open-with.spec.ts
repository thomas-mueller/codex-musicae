import { describe, expect, it, vi } from 'vitest';

import type { OpenedFile } from '../../ports/file-access';
import { WebOpenWith } from './web-open-with';
import type { LaunchQueue } from './web-open-with';
import type { FsFileHandle } from './web-file-access';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const handle = (name: string) => ({ name }) as unknown as FsFileHandle;
const opened = (name: string): OpenedFile => ({ ref: { id: name, name }, bytes: new Uint8Array([1]), writable: true });

function fakeQueue() {
  let consumer: ((params: { files: readonly FsFileHandle[] }) => void) | null = null;
  const queue: LaunchQueue = { setConsumer: (fn) => (consumer = fn) };
  return { queue, launch: (...names: string[]) => consumer?.({ files: names.map(handle) }) };
}

describe('WebOpenWith', () => {
  it('FIL-019 adopts the launched handles and delivers them as opened files', async () => {
    const { queue, launch } = fakeQueue();
    const adopt = vi.fn((h: FsFileHandle) => Promise.resolve(opened((h as unknown as { name: string }).name)));
    const received: string[][] = [];
    new WebOpenWith(adopt, () => queue).onIncomingFiles((files) => received.push(files.map((f) => f.ref.name)));
    launch('a.pdf', 'b.pdf');
    await settle();
    expect(received).toEqual([['a.pdf', 'b.pdf']]);
  });

  it('FIL-019 skips handles that cannot be adopted and stops after unsubscribe', async () => {
    const { queue, launch } = fakeQueue();
    const adopt = vi.fn(() => Promise.resolve(null));
    const callback = vi.fn();
    const stop = new WebOpenWith(adopt, () => queue).onIncomingFiles(callback);
    launch('a.pdf');
    await settle();
    expect(callback).not.toHaveBeenCalled();
    stop();
    expect(callback).not.toHaveBeenCalled();
  });

  it('FIL-019 without a launch queue (not desktop Chromium) nothing is ever delivered', () => {
    const callback = vi.fn();
    expect(() => new WebOpenWith(() => Promise.resolve(null), () => undefined).onIncomingFiles(callback)).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });
});
