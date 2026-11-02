import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../testing/provide-test-ports';
import { OrgViewStore } from './org-view.store';
import { SessionStore } from './session.store';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

async function setup(viewportWidth: number, viewportHeight: number) {
  TestBed.configureTestingModule({ providers: provideTestPorts() });
  const session = TestBed.inject(SessionStore);
  await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
  await settle();
  const org = TestBed.inject(OrgViewStore);
  org.viewport.set({ width: viewportWidth, height: viewportHeight });
  return { org, doc: session.activeDocument()! };
}

describe('OrgViewStore.anchorOf', () => {
  it('FIL-014 is null while the viewer is unmeasured', async () => {
    const { org, doc } = await setup(0, 0);
    expect(org.anchorOf(doc)).toBeNull();
  });

  it('FIL-014 scrolled to a page top gives that page and offset 0', async () => {
    const { org, doc } = await setup(600, 800);
    const page = org.layout()[1]!;
    doc.orgScroll.set({ x: 0, y: page.top });
    expect(org.anchorOf(doc)).toEqual({ page: 1, offset: 0 });
  });

  it('FIL-014 the offset is the display-space distance below the page top, so it survives a different scale', async () => {
    const { org, doc } = await setup(600, 800);
    const page = org.layout()[1]!;
    const scale = org.scale();
    doc.orgScroll.set({ x: 0, y: page.top + 30 * scale });
    const anchor = org.anchorOf(doc)!;
    expect(anchor.page).toBe(1);
    expect(anchor.offset).toBeCloseTo(30, 9);
    // restoring at another zoom puts the same page point at the top
    doc.orgZoom.set(2);
    doc.orgRestore.set(anchor);
    TestBed.tick();
    const restoredTop = org.layout()[1]!.top + anchor.offset * org.scale();
    expect(doc.orgScroll().y).toBeCloseTo(restoredTop, 6);
    expect(doc.orgRestore()).toBeNull();
  });
});
