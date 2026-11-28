import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import type { Provider } from '@angular/core';

import type { SystemMarks } from '../app/core';
import { FEATURE_FLAGS } from '../app/ports/feature-flags';
import type { FeatureFlags } from '../app/ports/feature-flags';
import { FILE_ACCESS } from '../app/ports/file-access';
import type { FileAccessError, OpenedFile } from '../app/ports/file-access';
import { PDF_WRITER } from '../app/ports/pdf-writer';
import { err, ok } from '../app/ports/result';
import { CrossFilePlayback } from '../app/state/cross-file-playback.service';
import { CrossFileService } from '../app/state/cross-file.service';
import { PreferencesStore } from '../app/state/preferences.store';
import { SessionStore } from '../app/state/session.store';
import type { FakePdfWriter, fakeFileAccess } from '../app/state/testing/fake-ports';
import { UiStore } from '../app/state/ui.store';
import { testFile, testMetadata } from './cross-file-files';
import { ALL_FEATURES_ON, provideTestPorts } from './provide-test-ports';

/** A file that leads on takes several rounds: load, read its data, open the next one. */
const ROUNDS = 4;
const ROUND_MS = 5;

export const settle = async (): Promise<void> => {
  for (let i = 0; i < ROUNDS; i++) {
    await new Promise((resolve) => setTimeout(resolve, ROUND_MS));
    TestBed.tick();
  }
};

interface Options {
  /** Marks of each file by name; a file without an entry has none. */
  readonly marks?: Readonly<Record<string, Partial<SystemMarks>>>;
  /** Names of the files in the recent list, which `reopen` can read. */
  readonly stored?: readonly string[];
  readonly flags?: FeatureFlags;
  readonly providers?: Provider[];
  /** False: `restore()` has not run yet. */
  readonly restored?: boolean;
}

/**
 * Files with two detected pages of three systems. `open(name)` opens one as the user does; every file named in `stored` is in
 * the recent list and can be re-opened by the app. Files are told apart by the id of their reference.
 */
export async function crossFileSetup(options: Options = {}) {
  TestBed.configureTestingModule({
    providers: [provideTestPorts(), { provide: FEATURE_FLAGS, useValue: options.flags ?? ALL_FEATURES_ON }, ...(options.providers ?? [])],
  });
  const names: string[] = [];
  const keyOf = (name: string) => (names.includes(name) ? names.indexOf(name) : names.push(name) - 1) + 1;
  const file = (name: string, id?: string): OpenedFile => testFile(name, keyOf(name), id);
  const writer = TestBed.inject(PDF_WRITER) as FakePdfWriter;
  writer.readEmbeddedJson.mockImplementation((bytes: Uint8Array) => {
    const name = names[bytes[0]! - 1]!;
    return Promise.resolve(ok(testMetadata(options.marks?.[name])));
  });
  const files = TestBed.inject(FILE_ACCESS) as ReturnType<typeof fakeFileAccess>;
  files.isSame = (a, b) => Promise.resolve(a.id === b.id);
  const reopen = vi.fn(async (ref: { id: string; name: string }): ReturnType<typeof files.reopen> =>
    options.stored?.includes(ref.name) ? ok(file(ref.name, ref.id)) : err<FileAccessError>('not-found'),
  );
  files.reopen = reopen;
  const preferences = TestBed.inject(PreferencesStore);
  await preferences.ready;
  for (const name of options.stored ?? []) {
    await preferences.addRecent(file(name).ref);
  }
  const session = TestBed.inject(SessionStore);
  const crossFile = TestBed.inject(CrossFileService);
  const playback = TestBed.inject(CrossFilePlayback);
  const ui = TestBed.inject(UiStore);
  if (options.restored !== false) {
    await session.restore();
  }
  const open = async (name: string, id?: string) => {
    await session.openFiles([file(name, id)]);
    await settle();
  };
  const idOf = (name: string) => session.tabs().find((tab) => tab.name === name)!.id;
  const doc = (name: string) => session.sessionEntries().find((entry) => entry.ref.name === name)!.document;
  const openNames = () => session.tabs().map((tab) => tab.name);
  const current = () => session.activeTab()?.name;
  /** Where the player is: the current file and the first system on its slide. */
  const here = () => `${current()}:${session.activeDocument()!.position().system}`;
  /** Turns pages until the last slide of the current file. */
  const toEnd = () => session.activeDocument()!.goToSlide(session.activeDocument()!.slideCount() - 1);
  return { session, crossFile, playback, ui, preferences, files, reopen, writer, file, open, idOf, doc, openNames, current, here, toEnd };
}
