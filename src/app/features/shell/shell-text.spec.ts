import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { SessionStore } from '../../state/session.store';
import { AppShell } from './app-shell';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));
/** Numbers and their separators: what GEN-009 allows next to the version string and error codes. */
const NUMBERS_ONLY = /^[\d\s/+·.:%-]*$/;

describe('visible text (GEN-009)', () => {
  it('GEN-009 the shell with a document shows no words: icons, numbers and the file name only', async () => {
    TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts()] });
    await TestBed.inject(SessionStore).openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    const fixture = TestBed.createComponent(AppShell);
    await settle();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const words: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      const element = node.parentElement;
      // the tab bar and the tab switcher show the user's file name; scripts and styles are not visible text
      if (text !== '' && element && !element.closest('.name, app-tab-switcher, script, style') && !NUMBERS_ONLY.test(text)) {
        words.push(text);
      }
    }
    expect(words).toEqual([]);
  });
});
