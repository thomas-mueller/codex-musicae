import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { provideTestPorts } from '../../testing/provide-test-ports';
import { FilePrompts } from '../state/file-prompts';
import { SessionStore } from '../state/session.store';
import { UiStore } from '../state/ui.store';
import { CommandBus } from './command-bus';
import { NavigationHandler } from './navigation-handler';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

const STROKE = {
  id: 's', pageIndex: 0, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: TUNABLES.colors.penPresets[0] as string, widthPt: 1, opacity: 1, multiply: false,
};

/** A document with one stroke in the annotation history and one deleted bookmark in the organization history. */
async function setup() {
  TestBed.configureTestingModule({ providers: provideTestPorts() });
  const ui = TestBed.inject(UiStore);
  const session = TestBed.inject(SessionStore);
  TestBed.inject(NavigationHandler);
  const bus = TestBed.inject(CommandBus);
  await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
  await settle();
  ui.hasDocument.set(true);
  const doc = session.activeDocument()!;
  doc.addStroke(STROKE);
  doc.replaceMarks({ ...doc.systemMarks(), bookmarks: [{ id: 1, at: { pageIndex: 0, system: 1 } }], nextBookmarkId: 2 });
  doc.removeMark({ kind: 'bookmark', id: 1 });
  const state = () => ({ strokes: doc.strokes().length, bookmarks: doc.systemMarks().bookmarks.length });
  return { ui, doc, state, undo: () => bus.dispatch({ type: 'Undo' }), redo: () => bus.dispatch({ type: 'Redo' }) };
}

describe('NavigationHandler: undo and redo', () => {
  it('NAV-022 ANN-015 in annotation mode they act on the ink, in organization mode on the marks', async () => {
    const { ui, state, undo, redo } = await setup();
    ui.setMode('annotation');
    undo();
    expect(state()).toEqual({ strokes: 0, bookmarks: 0 });
    redo();
    expect(state()).toEqual({ strokes: 1, bookmarks: 0 });
    ui.setMode('organization');
    undo();
    expect(state()).toEqual({ strokes: 1, bookmarks: 1 });
    redo();
    expect(state()).toEqual({ strokes: 1, bookmarks: 0 });
  });

  it('NAV-022 nothing happens in presentation and settings mode', async () => {
    const { ui, state, undo } = await setup();
    for (const mode of ['presentation', 'settings'] as const) {
      ui.setMode(mode);
      undo();
      expect(state(), mode).toEqual({ strokes: 1, bookmarks: 0 });
    }
  });

  it('ANN-013 nothing happens during a stroke, and nothing is kept for later', async () => {
    const { ui, state, undo } = await setup();
    ui.strokeInProgress.set(true);
    undo();
    ui.strokeInProgress.set(false);
    expect(state()).toEqual({ strokes: 1, bookmarks: 0 });
  });

  it('NAV-022 nothing happens while a question covers the tools', async () => {
    const { ui, doc, state, undo } = await setup();
    const prompts = TestBed.inject(FilePrompts);
    prompts.ask({ kind: 'close', tabId: doc.tabId });
    undo();
    prompts.dismiss(doc.tabId);
    ui.requestLevel('fine');
    undo();
    ui.cancelLevel();
    ui.setMode('settings');
    ui.requestReset();
    undo();
    ui.closeSettings();
    expect(state()).toEqual({ strokes: 1, bookmarks: 0 });
    undo();
    expect(state()).toEqual({ strokes: 0, bookmarks: 0 });
  });
});

describe('NavigationHandler: undo without a document', () => {
  it('NAV-022 does nothing', () => {
    TestBed.configureTestingModule({ providers: provideTestPorts() });
    TestBed.inject(NavigationHandler);
    expect(() => TestBed.inject(CommandBus).dispatch({ type: 'Undo' })).not.toThrow();
  });
});
