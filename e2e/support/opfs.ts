import type { Page } from '@playwright/test';

import { scoreBytes } from './score';

/** The browser-side objects used below (the lint rules keep bare platform globals out of e2e code). */
interface OpfsWritable {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}
interface OpfsHandle {
  createWritable(): Promise<OpfsWritable>;
  getFile(): Promise<{ size: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}
interface OpfsGlobals {
  navigator: { storage: { getDirectory(): Promise<{ getFileHandle(name: string, options?: { create: boolean }): Promise<OpfsHandle> }> } };
  showOpenFilePicker?: unknown;
  showSaveFilePicker?: unknown;
}

/**
 * Chromium only: the open and save pickers answer with real files of the browser-private file system (OPFS), which the app
 * can write in place and the test can read. Opening gives `name`, filled with the score the first time; saving gives a new
 * file of the proposed name. Call before `page.goto`.
 */
export async function useWritableFiles(page: Page, name = 'score.pdf'): Promise<void> {
  await page.addInitScript(
    ({ fileName, base64 }) => {
      const globals = globalThis as unknown as OpfsGlobals;
      globals.showOpenFilePicker = async () => {
        const root = await globals.navigator.storage.getDirectory();
        const handle = await root.getFileHandle(fileName, { create: true });
        if ((await handle.getFile()).size === 0) {
          const writable = await handle.createWritable();
          await writable.write(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
          await writable.close();
        }
        return [handle];
      };
      globals.showSaveFilePicker = async (options: { suggestedName: string }) => {
        const root = await globals.navigator.storage.getDirectory();
        return root.getFileHandle(options.suggestedName, { create: true });
      };
    },
    { fileName: name, base64: scoreBytes.toString('base64') },
  );
}

/** The content of a file the app was given, as it is now. */
export async function readWritableFile(page: Page, name: string): Promise<Buffer> {
  const base64 = await page.evaluate(async (fileName) => {
    const root = await (globalThis as unknown as OpfsGlobals).navigator.storage.getDirectory();
    const file = await (await root.getFileHandle(fileName)).getFile();
    let binary = '';
    for (const byte of new Uint8Array(await file.arrayBuffer())) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }, name);
  return Buffer.from(base64, 'base64');
}
