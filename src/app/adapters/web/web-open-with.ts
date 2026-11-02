import type { OpenedFile } from '../../ports/file-access';
import type { OpenWith } from '../../ports/open-with';
import type { FsFileHandle } from './web-file-access';

/** The Launch Handler API (desktop Chromium): the handles the app was launched with. */
export interface LaunchQueue {
  setConsumer(consumer: (params: { readonly files: readonly FsFileHandle[] }) => void): void;
}

/** FIL-019: files opened with the installed PWA. Other browsers never call back. */
export class WebOpenWith implements OpenWith {
  private readonly callbacks = new Set<(files: readonly OpenedFile[]) => void>();
  private consuming = false;

  constructor(
    private readonly adopt: (handle: FsFileHandle) => Promise<OpenedFile | null>,
    private readonly launchQueue: () => LaunchQueue | undefined = defaultLaunchQueue,
  ) {}

  onIncomingFiles(callback: (files: readonly OpenedFile[]) => void): () => void {
    this.callbacks.add(callback);
    if (!this.consuming) {
      this.consuming = true;
      this.launchQueue()?.setConsumer((params) => void this.deliver(params.files));
    }
    return () => this.callbacks.delete(callback);
  }

  private async deliver(handles: readonly FsFileHandle[]): Promise<void> {
    const opened: OpenedFile[] = [];
    for (const handle of handles) {
      const file = await this.adopt(handle);
      if (file) {
        opened.push(file);
      }
    }
    if (opened.length > 0) {
      for (const callback of [...this.callbacks]) {
        callback(opened);
      }
    }
  }
}

function defaultLaunchQueue(): LaunchQueue | undefined {
  return (window as unknown as { launchQueue?: LaunchQueue }).launchQueue;
}
