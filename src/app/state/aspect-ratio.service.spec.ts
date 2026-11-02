import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { provideTestDetectionPorts, provideTestSavePorts } from '../../testing/provide-test-ports';
import { FILE_ACCESS } from '../ports/file-access';
import { PDF_RENDERER } from '../ports/pdf-renderer';
import { PREFERENCES } from '../ports/preferences';
import { AspectRatioService } from './aspect-ratio.service';
import { PreferencesStore } from './preferences.store';
import { SessionStore } from './session.store';
import { UiStore } from './ui.store';
import { fakeFileAccess, memoryPreferences } from './testing/fake-ports';
import { fakeRenderer } from './testing/fake-renderer';

async function setup(stored: Record<string, unknown> = {}, viewport = { width: 1200, height: 800 }) {
  TestBed.configureTestingModule({
    providers: [
      { provide: PDF_RENDERER, useValue: fakeRenderer() },
      { provide: FILE_ACCESS, useValue: fakeFileAccess() },
      { provide: PREFERENCES, useValue: memoryPreferences(stored) },
      ...provideTestDetectionPorts(),
      ...provideTestSavePorts(),
    ],
  });
  const preferences = TestBed.inject(PreferencesStore);
  await preferences.ready;
  TestBed.inject(UiStore).setViewport(viewport.width, viewport.height);
  const session = TestBed.inject(SessionStore);
  await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
  const doc = session.activeDocument();
  if (!doc) {
    throw new Error('no document');
  }
  return { service: TestBed.inject(AspectRatioService), preferences, doc };
}

describe('AspectRatioService', () => {
  it('SLD-014 without stored values the screen ratio of the orientation applies (1280x800 screen)', async () => {
    const { doc } = await setup();
    expect(doc.aspectRatio()).toBe(1.6);
  });

  it('SLD-014 the global default of the orientation beats the screen ratio', async () => {
    const { doc } = await setup({ 'ratio.landscape': 1.3 });
    expect(doc.aspectRatio()).toBe(1.3);
  });

  it('SLD-014 captureForOrientation stores the rounded ratio once per orientation', async () => {
    const { service, preferences } = await setup();
    await service.captureForOrientation(1000, 3);
    expect(preferences.globalRatios().landscape).toBe(2);
    await service.captureForOrientation(1000, 1000);
    expect(preferences.globalRatios().landscape).toBe(2);
    await service.captureForOrientation(900, 1200);
    expect(preferences.globalRatios().portrait).toBe(0.75);
  });

  it('SLD-015 showMore and showLess write the override of the current orientation', async () => {
    const { service, doc } = await setup();
    service.showMore();
    expect(doc.ratioOverride()).toEqual({ landscape: 1.5 });
    service.showLess();
    service.showLess();
    expect(doc.ratioOverride().landscape).toBe(1.7);
    expect(doc.ratioOverride().portrait).toBeUndefined();
  });

  it('SLD-015 an override works on a read-only document (memory only)', async () => {
    const { service, doc } = await setup();
    doc.readOnly.set(true);
    service.showMore();
    expect(doc.aspectRatio()).toBe(1.5);
  });

  it('SLD-013 the buttons are disabled when the step would not change the value', async () => {
    const { service, doc } = await setup();
    doc.ratioOverride.set({ landscape: TUNABLES.aspectRatio.min });
    expect(service.canShowMore()).toBe(false);
    expect(service.canShowLess()).toBe(true);
    doc.ratioOverride.set({ landscape: TUNABLES.aspectRatio.max });
    expect(service.canShowLess()).toBe(false);
    service.showLess();
    expect(doc.aspectRatio()).toBe(TUNABLES.aspectRatio.max);
  });
});
