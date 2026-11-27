import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { ALL_FEATURES_ON, provideTestPorts } from '../../testing/provide-test-ports';
import { FEATURE_FLAGS } from '../ports/feature-flags';
import type { FeatureFlags } from '../ports/feature-flags';
import { FILE_ACCESS } from '../ports/file-access';
import type { OpenedFile } from '../ports/file-access';
import { PREFERENCES } from '../ports/preferences';
import { err, ok } from '../ports/result';
import { CLOCK } from './clock';
import { FilePrompts } from './file-prompts';
import type { FilePrompt } from './file-prompts';
import { SessionStore } from './session.store';
import { FakeClock } from './testing/fake-clock';
import { memoryPreferences } from './testing/fake-ports';
import type { fakeFileAccess } from './testing/fake-ports';

const IDLE = TUNABLES.saving.autosaveIdleMs;
const STROKE = { id: 's1', pageIndex: 0, points: [{ x: 1, y: 1 }], color: '#000000', widthPt: 1, opacity: 1, multiply: false };
const FREE: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const file = (name: string, writable = true): OpenedFile => ({ ref: { id: `id-${name}`, name }, bytes: new Uint8Array([1]), writable });

type Overwrite = FilePrompt & { kind: 'overwrite' };
type Close = FilePrompt & { kind: 'close' };

async function setup(flags: FeatureFlags = ALL_FEATURES_ON, opened: OpenedFile[] = [file('a.pdf')]) {
  const clock = new FakeClock();
  const preferences = memoryPreferences();
  TestBed.configureTestingModule({
    providers: [
      provideTestPorts(),
      { provide: FEATURE_FLAGS, useValue: flags },
      { provide: PREFERENCES, useValue: preferences },
      { provide: CLOCK, useValue: clock },
    ],
  });
  const session = TestBed.inject(SessionStore);
  const prompts = TestBed.inject(FilePrompts);
  const files = TestBed.inject(FILE_ACCESS) as ReturnType<typeof fakeFileAccess>;
  await session.openFiles(opened);
  await settle();
  TestBed.tick();
  const draw = async (id = 's1') => {
    session.activeDocument()!.addStroke({ ...STROKE, id });
    clock.advance(IDLE);
    await settle();
    await settle();
  };
  const idOf = (name: string) => session.tabs().find((tab) => tab.name === name)!.id;
  return { session, prompts, files, clock, preferences, draw, idOf };
}

describe('overwrite question (V2-M6 S2)', () => {
  it('FIL-033 FIL-034 the first autosave asks and writes nothing until the answer', async () => {
    const { session, prompts, files, draw, idOf } = await setup();
    await draw();
    expect(prompts.current()).toEqual({ kind: 'overwrite', tabId: idOf('a.pdf'), closing: false });
    expect(files.write).not.toHaveBeenCalled();
    expect(session.activeTab()?.unsaved).toBe(true);
  });

  it('FIL-033 FIL-036 Overwrite writes the waiting changes, and the file is not asked about again', async () => {
    const { session, prompts, files, draw } = await setup();
    await draw();
    await session.answerOverwrite(prompts.current() as Overwrite, 'overwrite');
    await settle();
    expect(files.write).toHaveBeenCalledTimes(1);
    expect(session.activeTab()?.unsaved).toBe(false);
    await draw('s2');
    expect(prompts.current()).toBeNull();
    expect(files.write).toHaveBeenCalledTimes(2);
  });

  it('FIL-036 Cancel writes nothing for the whole session, whatever triggers a save', async () => {
    const { session, prompts, files, draw } = await setup(ALL_FEATURES_ON, [file('b.pdf'), file('a.pdf')]);
    await draw();
    await session.answerOverwrite(prompts.current() as Overwrite, 'cancel');
    await draw('s2');
    session.setActive(session.tabs()[0]!.id); // a tab switch forces a save
    await settle();
    expect(files.write).not.toHaveBeenCalled();
    expect(prompts.current()).toBeNull();
    expect(session.tabs()[1]?.unsaved).toBe(true);
  });

  it('FIL-049 after Cancel closing asks to discard; Cancel keeps the file, Discard drops the changes', async () => {
    const { session, prompts, files, draw, idOf } = await setup();
    await draw();
    await session.answerOverwrite(prompts.current() as Overwrite, 'cancel');
    expect(await session.closeTab(idOf('a.pdf'))).toBe(false);
    expect(prompts.current()?.kind).toBe('close');
    await session.answerClose(prompts.current() as Close, 'cancel');
    expect(session.tabs()).toHaveLength(1);
    await session.closeTab(idOf('a.pdf'));
    await session.answerClose(prompts.current() as Close, 'discard');
    expect(session.tabs()).toHaveLength(0);
    expect(files.write).not.toHaveBeenCalled();
  });

  it('FIL-033 FIL-006 closing with the question open asks it as part of closing: Overwrite saves, then closes', async () => {
    const { session, prompts, files, idOf } = await setup();
    session.activeDocument()!.addStroke(STROKE);
    expect(await session.closeTab(idOf('a.pdf'))).toBe(false);
    expect(prompts.current()).toMatchObject({ kind: 'overwrite', closing: true });
    await session.answerOverwrite(prompts.current() as Overwrite, 'overwrite');
    await settle();
    expect(files.write).toHaveBeenCalledTimes(1);
    expect(session.tabs()).toHaveLength(0);
  });

  it('FIL-036 Cancel to a question from closing keeps the file open', async () => {
    const { session, prompts, files, idOf } = await setup();
    session.activeDocument()!.addStroke(STROKE);
    await session.closeTab(idOf('a.pdf'));
    await session.answerOverwrite(prompts.current() as Overwrite, 'cancel');
    expect(session.tabs()).toHaveLength(1);
    expect(files.write).not.toHaveBeenCalled();
  });

  for (const scope of ['file', 'all'] as const) {
    it(`FIL-038 Overwrite with "do not ask again" (${scope}) stores it`, async () => {
      const { session, prompts, preferences, draw } = await setup();
      await draw();
      await session.answerOverwrite(prompts.current() as Overwrite, 'overwrite', scope);
      expect(preferences.data.get('overwrite')).toEqual(scope === 'all' ? { all: true, names: [] } : { all: false, names: ['a.pdf'] });
    });
  }

  it('FIL-038 a ticked box counts with Overwrite only', async () => {
    const { session, prompts, preferences, draw } = await setup();
    await draw();
    await session.answerOverwrite(prompts.current() as Overwrite, 'cancel', 'all');
    expect(preferences.data.has('overwrite')).toBe(false);
  });

  it('FIL-038 "for all files" also answers the questions that are waiting', async () => {
    const { session, prompts, files, clock } = await setup(ALL_FEATURES_ON, [file('a.pdf'), file('b.pdf')]);
    for (const tab of session.tabs()) {
      session.setActive(tab.id);
      session.activeDocument()!.addStroke(STROKE);
      clock.advance(IDLE);
      await settle();
    }
    expect(prompts.waiting()).toHaveLength(2);
    await session.answerOverwrite(prompts.current() as Overwrite, 'overwrite', 'all');
    await settle();
    expect(prompts.waiting()).toHaveLength(0);
    expect(files.write).toHaveBeenCalledTimes(2);
  });
});

describe('save as new file (V2-M6 S2)', () => {
  async function asked() {
    const all = await setup();
    await all.draw();
    return { ...all, prompt: all.prompts.current() as Overwrite };
  }

  it('FIL-036 FIL-037 the new file becomes the file of the entry; the old one is not written and later saves go to the new one', async () => {
    const { session, prompts, files, prompt, draw } = await asked();
    await session.answerOverwrite(prompt, 'saveAs');
    await settle();
    expect(files.createFile).toHaveBeenCalledWith('a (annotated).pdf');
    expect(files.write.mock.calls.map((call) => call[0].name)).toEqual(['a (annotated).pdf']);
    expect(session.activeTab()).toMatchObject({ name: 'a (annotated).pdf', unsaved: false, readOnly: false });
    expect(session.activeDocument()!.strokes()).toHaveLength(1);
    expect(prompts.current()).toBeNull();
    await draw('s2');
    expect(prompts.current()).toBeNull();
    expect(files.write.mock.calls.map((call) => call[0].name)).toEqual(['a (annotated).pdf', 'a (annotated).pdf']);
  });

  it('FIL-037 a cancelled picker changes nothing and the question stays', async () => {
    const { session, prompts, files, prompt } = await asked();
    files.createFile.mockResolvedValueOnce(err('cancelled'));
    await session.answerOverwrite(prompt, 'saveAs');
    expect(files.write).not.toHaveBeenCalled();
    expect(prompts.current()).toEqual(prompt);
    expect(session.activeTab()).toMatchObject({ name: 'a.pdf', unsaved: true });
  });

  it('FIL-037 a failed write keeps the old file and shows the error marker', async () => {
    const { session, files, prompt } = await asked();
    files.write.mockResolvedValueOnce(err('write-failed'));
    await session.answerOverwrite(prompt, 'saveAs');
    expect(session.activeTab()).toMatchObject({ name: 'a.pdf', saveFailed: true });
    expect(files.forget).toHaveBeenCalledWith(expect.objectContaining({ name: 'a (annotated).pdf' }));
  });

  it('FIL-037 PLT-010 where no file can be chosen a copy is downloaded and the entry stays as it was', async () => {
    const { session, files, idOf } = await asked();
    files.createFile.mockResolvedValueOnce(err('unsupported'));
    expect(await session.saveAsNewFile(idOf('a.pdf'))).toBe('copied');
    expect(files.saveCopy).toHaveBeenCalledWith('a (annotated).pdf', expect.any(Uint8Array));
    expect(session.activeTab()).toMatchObject({ name: 'a.pdf', unsaved: true });
  });

  it('FIL-037 a place that is another open file is not written', async () => {
    const { session, files, idOf } = await setup(ALL_FEATURES_ON, [file('b.pdf'), file('a.pdf')]);
    files.createFile.mockResolvedValueOnce(ok({ id: 'x', name: 'b.pdf' }));
    expect(await session.saveAsNewFile(idOf('a.pdf'))).toBe('failed');
    expect(files.write).not.toHaveBeenCalled();
  });

  it('FIL-049 "save as new file" in the close question saves and then closes', async () => {
    const { session, prompts, files, idOf, prompt } = await asked();
    await session.answerOverwrite(prompt, 'cancel');
    await session.closeTab(idOf('a.pdf'));
    await session.answerClose(prompts.current() as Close, 'saveAs');
    await settle();
    expect(files.write).toHaveBeenCalledTimes(1);
    expect(session.tabs()).toHaveLength(0);
  });

  it('EDN-001 in the free edition no file is created', async () => {
    const { session, files } = await setup(FREE);
    expect(await session.saveAsNewFile()).toBe('failed');
    expect(files.createFile).not.toHaveBeenCalled();
  });
});

describe('closing and unwritable files (V2-M6 S2)', () => {
  it('FIL-047 a file without changes closes at once, also after nothing but opening it', async () => {
    for (const writable of [true, false]) {
      TestBed.resetTestingModule();
      const { session, prompts, idOf } = await setup(FREE, [file('a.pdf', writable)]);
      expect(await session.closeTab(idOf('a.pdf'))).toBe(true);
      expect(prompts.current()).toBeNull();
    }
  });

  it('FIL-046 in free and web closing a changed file asks every time', async () => {
    const { session, prompts, files, draw, idOf } = await setup(FREE);
    await draw();
    expect(prompts.current()).toBeNull(); // nothing is ever written, so nothing is asked before closing
    for (let i = 0; i < 2; i++) {
      expect(await session.closeTab(idOf('a.pdf'))).toBe(false);
      expect(prompts.current()?.kind).toBe('close');
      await session.answerClose(prompts.current() as Close, 'cancel');
    }
    expect(files.write).not.toHaveBeenCalled();
  });

  it('FIL-049 in the paid edition closing a changed read-only file asks too', async () => {
    const { session, prompts, draw, idOf } = await setup(ALL_FEATURES_ON, [file('a.pdf', false)]);
    await draw();
    expect(await session.closeTab(idOf('a.pdf'))).toBe(false);
    expect(prompts.current()?.kind).toBe('close');
  });

  it('FIL-039 a file that cannot be written gets one notice per session and keeps the modified marker', async () => {
    const { session, prompts, draw, idOf } = await setup(ALL_FEATURES_ON, [file('a.pdf', false)]);
    await draw();
    expect(prompts.notice()).toBe(idOf('a.pdf'));
    expect(session.activeTab()).toMatchObject({ unsaved: true, readOnly: true });
    prompts.dismissNotice(idOf('a.pdf'));
    await draw('s2');
    expect(prompts.notice()).toBeNull();
  });

  it('FIL-039 FIL-049 a file that turns out unwritable while closing stays open and asks', async () => {
    const { session, prompts, files, idOf } = await setup();
    session.activeDocument()!.addStroke(STROKE);
    files.write.mockResolvedValue(err('denied'));
    await session.closeTab(idOf('a.pdf'));
    await session.answerOverwrite(prompts.current() as Overwrite, 'overwrite');
    await settle();
    await settle();
    expect(session.tabs()).toHaveLength(1);
    expect(prompts.current()?.kind).toBe('close');
    expect(prompts.notice()).toBe(idOf('a.pdf'));
  });

  it('FIL-039 in free and web no notice shows: the modified marker is the only indicator', async () => {
    const { prompts, draw } = await setup(FREE, [file('a.pdf', false)]);
    await draw();
    expect(prompts.notice()).toBeNull();
  });
});
