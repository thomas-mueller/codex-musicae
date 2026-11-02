import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../testing/provide-test-ports';
import { OPEN_WITH } from '../ports/open-with';
import type { OpenedFile } from '../ports/file-access';
import { IncomingFilesService } from './incoming-files.service';
import { SessionStore } from './session.store';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

function setup() {
  let deliver: ((files: readonly OpenedFile[]) => void) | null = null;
  TestBed.configureTestingModule({
    providers: [...provideTestPorts(), { provide: OPEN_WITH, useValue: { onIncomingFiles: (cb: typeof deliver) => { deliver = cb; return () => undefined; } } }],
  });
  TestBed.inject(IncomingFilesService);
  return { session: TestBed.inject(SessionStore), deliver: (files: readonly OpenedFile[]) => deliver?.(files) };
}

const file = (name: string, writable: boolean): OpenedFile => ({ ref: { id: name, name }, bytes: new Uint8Array([1]), writable });

describe('IncomingFilesService', () => {
  it('FIL-018 FIL-019 files handed over by the OS open as tabs', async () => {
    const { session, deliver } = setup();
    deliver([file('a.pdf', true), file('b.pdf', true)]);
    await settle();
    expect(session.tabs().map((t) => t.ref.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('FIL-018 a file without write access opens read-only', async () => {
    const { session, deliver } = setup();
    deliver([file('a.pdf', false)]);
    await settle();
    expect(session.activeDocument()?.readOnly()).toBe(true);
  });

  it('FIL-018 without an OpenWith provider the service does nothing', () => {
    TestBed.configureTestingModule({ providers: provideTestPorts() });
    expect(() => TestBed.inject(IncomingFilesService)).not.toThrow();
  });
});
