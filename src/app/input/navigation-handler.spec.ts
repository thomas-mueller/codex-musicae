import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../testing/provide-test-ports';
import { TUNABLES } from '../../config/tunables';
import { FIT_VIEW } from '../core';
import { AspectRatioService } from '../state/aspect-ratio.service';
import type { DocumentStore } from '../state/document.store';
import { OrgViewStore } from '../state/org-view.store';
import { SlideNavStore } from '../state/slide-nav.store';
import { SessionStore } from '../state/session.store';
import { UiStore } from '../state/ui.store';
import { CommandBus } from './command-bus';
import type { Command } from './command-bus';
import { NavigationHandler } from './navigation-handler';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

async function setup(): Promise<{ doc: DocumentStore; ui: UiStore; send: (type: Command['type']) => void; dispatch: (command: Command) => void }> {
  TestBed.configureTestingModule({ providers: provideTestPorts() });
  const session = TestBed.inject(SessionStore);
  await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
  await settle();
  const doc = session.activeDocument() as DocumentStore;
  doc.detection.reset(2);
  const systems = [0, 1, 2].map((i) => ({ x: 50, y: 50 + i * 250, width: 500, height: 150 }));
  for (const pageIndex of [0, 1]) {
    doc.detection.finish(pageIndex, 'done', { pageIndex, width: 600, height: 800, systems });
  }
  const ui = TestBed.inject(UiStore);
  ui.hasDocument.set(true);
  TestBed.inject(NavigationHandler);
  const bus = TestBed.inject(CommandBus);
  return { doc, ui, send: (type) => bus.dispatch({ type } as Command), dispatch: (command) => bus.dispatch(command) };
}

describe('NavigationHandler', () => {
  it('NAV-003 Next and Previous move by slide and clamp at both ends', async () => {
    const { doc, send } = await setup();
    send('Previous');
    expect(doc.currentSlideIndex()).toBe(0);
    send('Next');
    expect(doc.currentSlideIndex()).toBe(1);
    send('Last');
    expect(doc.currentSlideIndex()).toBe(doc.slideCount() - 1);
    send('Next');
    expect(doc.currentSlideIndex()).toBe(doc.slideCount() - 1);
    send('First');
    expect(doc.currentSlideIndex()).toBe(0);
  });

  it('NAV-003 NAV-019 navigation works in presentation mode and with a tool active', async () => {
    const { doc, ui, send } = await setup();
    ui.setTool('pen');
    send('Next');
    expect(doc.currentSlideIndex()).toBe(1);
    ui.setMode('presentation');
    send('Next');
    expect(doc.currentSlideIndex()).toBe(2);
  });

  it('NAV-015 a slide change resets the slide view', async () => {
    const { doc, send } = await setup();
    doc.slideView.set({ zoom: 2, panX: 5, panY: 5 });
    send('Next');
    expect(doc.slideView()).toEqual(FIT_VIEW);
  });

  it('NAV-005 organization mode moves by page and zoom persists', async () => {
    const { ui, send } = await setup();
    const org = TestBed.inject(OrgViewStore);
    const next = vi.spyOn(org, 'next').mockImplementation(() => undefined);
    const previous = vi.spyOn(org, 'previous').mockImplementation(() => undefined);
    const goToPage = vi.spyOn(org, 'goToPage').mockImplementation(() => undefined);
    ui.setMode('organization');
    send('Next');
    send('Previous');
    send('First');
    send('Last');
    expect(next).toHaveBeenCalledTimes(1);
    expect(previous).toHaveBeenCalledTimes(1);
    expect(goToPage).toHaveBeenNthCalledWith(1, 0, true);
    expect(goToPage).toHaveBeenNthCalledWith(2, org.pageCount() - 1, true);
  });

  it('NAV-018 Back closes things in priority order', async () => {
    const { ui, send } = await setup();
    ui.setMode('presentation');
    ui.openPopup('info');
    ui.select({ kind: 'junction', junction: 1 });
    ui.startPicking({ originJunction: 1 });
    send('Back');
    expect(ui.popup()).toBeNull();
    expect(ui.pickingTarget()).not.toBeNull();
    send('Back');
    expect(ui.pickingTarget()).toBeNull();
    expect(ui.selection()).not.toBeNull();
    send('Back');
    expect(ui.selection()).toBeNull();
    expect(ui.mode()).toBe('presentation');
    send('Back');
    expect(ui.mode()).toBe('annotation');
    send('Back');
    expect(ui.mode()).toBe('annotation');
  });

  it('NAV-018 Back cancels a pending level change first', async () => {
    const { ui, send } = await setup();
    ui.requestLevel('fine');
    ui.openPopup('info');
    send('Back');
    expect(ui.pendingLevel()).toBeNull();
    expect(ui.popup()).not.toBeNull();
  });

  it('NAV-001 ToggleMode switches annotation and presentation; ExitPresentation returns', async () => {
    const { ui, send } = await setup();
    send('ToggleMode');
    expect(ui.mode()).toBe('presentation');
    send('ToggleMode');
    expect(ui.mode()).toBe('annotation');
    send('ToggleMode');
    send('ExitPresentation');
    expect(ui.mode()).toBe('annotation');
  });

  it('UIX-018 entering presentation clears tool and zoom and captures the ratio', async () => {
    const { doc, ui } = await setup();
    const capture = vi.spyOn(TestBed.inject(AspectRatioService), 'captureForOrientation').mockResolvedValue();
    ui.setViewport(1280, 800);
    ui.setTool('pen');
    doc.slideView.set({ zoom: 2, panX: 0, panY: 0 });
    ui.setMode('presentation');
    TestBed.tick();
    expect(ui.tool()).toBeNull();
    expect(doc.slideView()).toEqual(FIT_VIEW);
    expect(capture).toHaveBeenCalledWith(1280, 800);
  });

  const ANCHOR = { x: 150, y: 200 };

  it('NAV-013 NAV-014 zoom and pan commands move the slide view in annotation mode', async () => {
    const { doc, dispatch, send } = await setup();
    TestBed.inject(SlideNavStore).stage.set({ width: 300, height: 400 });
    dispatch({ type: 'ZoomBy', factor: 2, anchor: ANCHOR });
    expect(doc.slideView().zoom).toBe(2);
    dispatch({ type: 'Pan', dx: 20, dy: 0 });
    expect(doc.slideView().panX).toBe(20);
    dispatch({ type: 'ZoomBy', factor: 100, anchor: ANCHOR });
    expect(doc.slideView().zoom).toBe(TUNABLES.zoom.max);
    send('ZoomReset');
    expect(doc.slideView()).toEqual(FIT_VIEW);
  });

  it('NAV-017 presentation mode ignores zoom, pan and double-tap commands', async () => {
    const { doc, ui, dispatch } = await setup();
    TestBed.inject(SlideNavStore).stage.set({ width: 300, height: 400 });
    const org = TestBed.inject(OrgViewStore);
    const zoomAt = vi.spyOn(org, 'zoomAt');
    const toggle = vi.spyOn(org, 'toggleDoubleTapZoom');
    ui.setMode('presentation');
    dispatch({ type: 'ZoomBy', factor: 2, anchor: ANCHOR });
    dispatch({ type: 'Pan', dx: 20, dy: 20 });
    dispatch({ type: 'DoubleTapZoom', anchor: ANCHOR });
    expect(doc.slideView()).toEqual(FIT_VIEW);
    expect(zoomAt).not.toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled();
  });

  it('NAV-013 NAV-016 organization mode zooms around the anchor and toggles on a double tap; annotation ignores it', async () => {
    const { ui, dispatch, doc } = await setup();
    const org = TestBed.inject(OrgViewStore);
    const zoomAt = vi.spyOn(org, 'zoomAt').mockImplementation(() => undefined);
    const toggle = vi.spyOn(org, 'toggleDoubleTapZoom').mockImplementation(() => undefined);
    dispatch({ type: 'DoubleTapZoom', anchor: ANCHOR });
    expect(toggle).not.toHaveBeenCalled();
    ui.setMode('organization');
    dispatch({ type: 'ZoomBy', factor: 1.5, anchor: ANCHOR });
    dispatch({ type: 'DoubleTapZoom', anchor: ANCHOR });
    dispatch({ type: 'Pan', dx: 5, dy: 5 });
    expect(zoomAt).toHaveBeenCalledWith(1.5, ANCHOR);
    expect(toggle).toHaveBeenCalledWith(ANCHOR);
    expect(doc.slideView()).toEqual(FIT_VIEW);
  });
});
