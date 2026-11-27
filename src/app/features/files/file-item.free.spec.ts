import { TestBed } from '@angular/core/testing';

import { ALL_FEATURES_ON, provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { FEATURE_FLAGS } from '../../ports/feature-flags';
import type { FeatureFlags } from '../../ports/feature-flags';
import { FILE_ACCESS } from '../../ports/file-access';
import { SessionStore } from '../../state/session.store';
import type { fakeFileAccess } from '../../state/testing/fake-ports';
import { FileItem } from './file-item';

const FREE: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function lockMarker(flags: FeatureFlags) {
  TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts(), { provide: FEATURE_FLAGS, useValue: flags }] });
  const session = TestBed.inject(SessionStore);
  await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: false }]);
  await settle();
  const fixture = TestBed.createComponent(FileItem);
  fixture.componentRef.setInput('tab', session.tabs()[0]);
  await fixture.whenStable();
  const marker = (fixture.nativeElement as HTMLElement).querySelector(`button.marker[aria-label="${translate('a11y.readOnly')}"]`) as HTMLButtonElement;
  return { marker, files: TestBed.inject(FILE_ACCESS) as ReturnType<typeof fakeFileAccess> };
}

describe('FileItem in the free edition', () => {
  it('EDN-003 EDN-011 the read-only lock marker stays visible but disabled and makes no copy', async () => {
    const { marker, files } = await lockMarker(FREE);
    expect(marker.getAttribute('aria-disabled')).toBe('true');
    marker.click();
    await settle();
    expect(files.saveCopy).not.toHaveBeenCalled();
  });

  it('EDN-008 with saveCopy on the marker saves a copy', async () => {
    const { marker, files } = await lockMarker({ ...FREE, saveCopy: true });
    expect(marker.getAttribute('aria-disabled')).toBe('false');
    marker.click();
    await settle();
    expect(files.saveCopy).toHaveBeenCalled();
  });
});
