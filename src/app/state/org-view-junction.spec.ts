import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { provideTestPorts } from '../../testing/provide-test-ports';
import { OrgViewStore } from './org-view.store';
import { SessionStore } from './session.store';
import { UiStore } from './ui.store';

const VIEW = { width: 300, height: 400 };
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const SYSTEMS = [{ x: 0, y: 100, width: PAGE_WIDTH, height: 100 }, { x: 0, y: 500, width: PAGE_WIDTH, height: 100 }];

describe('OrgViewStore.scrollToJunction', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideTestPorts()] }));

  async function setup() {
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    const doc = session.activeDocument()!;
    TestBed.inject(UiStore).setMode('organization');
    await new Promise((resolve) => setTimeout(resolve, 10)); // organization mode starts detection; wait before faking results
    doc.detection.reset(2);
    doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: SYSTEMS });
    doc.detection.finish(1, 'done', { pageIndex: 1, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: SYSTEMS });
    const view = TestBed.inject(OrgViewStore);
    view.viewport.set(VIEW);
    return { doc, view };
  }

  it('ORG-019 requests an animated scroll that centers the first bar of the junction', async () => {
    const { doc, view } = await setup();
    // Junction 4 is the bottom bar of page 1 (two systems per page): a bar on the second page.
    view.scrollToJunction(doc.bars(), 4);
    const request = view.scrollRequest()!;
    const bar = doc.bars().find((b) => b.junction === 4)!;
    const page = view.layout()[bar.pageIndex]!;
    const barTop = page.top + view.offsetY() + bar.y * view.scale();
    const barHeight = Math.max(bar.height * view.scale(), TUNABLES.colors.orgBar.minHeightPx);
    expect(request.animate).toBe(true);
    expect(request.top).toBeCloseTo(Math.max(0, barTop + barHeight / 2 - VIEW.height / 2));
  });

  it('ORG-019 a junction without bars requests nothing', async () => {
    const { doc, view } = await setup();
    view.scrollToJunction(doc.bars(), 99);
    expect(view.scrollRequest()).toBeNull();
  });
});

describe('UiStore picking', () => {
  it('ORG-015 picking starts, cancels and is cleared by a mode change', () => {
    const ui = TestBed.inject(UiStore);
    ui.startPicking({ originJunction: 2 });
    expect(ui.pickingTarget()).toEqual({ originJunction: 2 });
    ui.cancelPicking();
    expect(ui.pickingTarget()).toBeNull();
    ui.startPicking({ originJunction: 2, editJumpId: 1 });
    ui.setMode('organization');
    expect(ui.pickingTarget()).toBeNull();
  });
});

describe('OrgViewStore.level', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideTestPorts()] }));

  it('DET-013 without a document the level is the default level', () => {
    expect(TestBed.inject(OrgViewStore).level()).toBe(TUNABLES.detection.defaultLevel);
  });

  it('DET-014 with a document it is the level of the results on display', async () => {
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    const doc = session.activeDocument()!;
    const other = TUNABLES.detection.defaultLevel === 'fine' ? 'fast' : 'fine';
    doc.detection.level.set(other);
    expect(TestBed.inject(OrgViewStore).level()).toBe(other);
  });
});
