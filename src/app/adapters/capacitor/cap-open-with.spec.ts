import { CapFileAccess } from './cap-file-access';
import { CapOpenWith } from './cap-open-with';
import { fakeDocumentAccess } from './fake-document-access';
import type { OpenedFile } from '../../ports/file-access';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const plugin = fakeDocumentAccess();
  const access = new CapFileAccess(plugin, 4);
  const openWith = new CapOpenWith((file) => access.openIncoming(file), plugin);
  const received: OpenedFile[][] = [];
  return { plugin, openWith, received, listen: () => openWith.onIncomingFiles((files) => received.push([...files])) };
}

describe('CapOpenWith', () => {
  it('FIL-018 delivers files queued before registration (cold start) with their writable flag', async () => {
    const { plugin, received, listen } = setup();
    plugin.files.set('a', { bytes: Uint8Array.from([1, 2, 3, 4, 5]), writable: true });
    plugin.pending = [{ id: 'a', name: 'a.pdf', writable: false }];
    listen();
    await settle();
    expect(received.length).toBe(1);
    expect(received[0]?.[0]?.ref.name).toBe('a.pdf');
    expect(received[0]?.[0]?.bytes).toEqual(Uint8Array.from([1, 2, 3, 4, 5]));
    expect(received[0]?.[0]?.writable).toBe(false);
  });

  it('FIL-018 delivers later files when the incomingFile event fires, once each', async () => {
    const { plugin, received, listen } = setup();
    listen();
    await settle();
    expect(received.length).toBe(0);
    plugin.files.set('b', { bytes: Uint8Array.from([9]), writable: true });
    plugin.pending = [{ id: 'b', name: 'b.pdf', writable: true }];
    plugin.emitIncoming();
    await settle();
    plugin.emitIncoming();
    await settle();
    expect(received.length).toBe(1);
    expect(received[0]?.[0]?.ref.id).toBe('b');
  });

  it('FIL-018 a file that cannot be read is skipped and an unsubscribed callback gets nothing', async () => {
    const { plugin, openWith, received } = setup();
    const stop = openWith.onIncomingFiles((files) => received.push([...files]));
    await settle();
    stop();
    plugin.pending = [{ id: 'gone', name: 'g.pdf', writable: true }];
    plugin.emitIncoming();
    await settle();
    expect(received.length).toBe(0);
  });
});
