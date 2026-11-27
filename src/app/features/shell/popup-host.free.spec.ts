import { TestBed } from '@angular/core/testing';

import { ALL_FEATURES_ON, provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { FEATURE_FLAGS } from '../../ports/feature-flags';
import type { FeatureFlags } from '../../ports/feature-flags';
import { FILE_ACCESS } from '../../ports/file-access';
import { SessionStore } from '../../state/session.store';
import type { fakeFileAccess } from '../../state/testing/fake-ports';
import { UiStore } from '../../state/ui.store';
import { PopupHost } from './popup-host';

const FREE: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function open(flags: FeatureFlags) {
  TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts(), { provide: FEATURE_FLAGS, useValue: flags }] });
  const fixture = TestBed.createComponent(PopupHost);
  const store = TestBed.inject(UiStore);
  await TestBed.inject(SessionStore).openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
  await settle();
  store.hasDocument.set(true);
  store.openPopup('overflow-bottom');
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const button = el.querySelector(`button[aria-label="${translate('a11y.saveCopy')}"]`) as HTMLButtonElement;
  return { button, files: TestBed.inject(FILE_ACCESS) as ReturnType<typeof fakeFileAccess> };
}

describe('PopupHost in the free edition', () => {
  it('EDN-003 EDN-011 save a copy stays visible and disabled with a document open, and a click makes no write call', async () => {
    const { button, files } = await open(FREE);
    expect(button).not.toBeNull();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.click();
    await settle();
    expect(files.saveCopy).not.toHaveBeenCalled();
    expect(files.write).not.toHaveBeenCalled();
  });

  it('EDN-008 with the saveCopy switch on the button is enabled', async () => {
    const { button } = await open({ ...FREE, saveCopy: true });
    expect(button.getAttribute('aria-disabled')).toBeNull();
  });
});
