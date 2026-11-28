import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../testing/provide-test-ports';
import { FilePrompts } from './file-prompts';
import { UiStore } from './ui.store';

describe('FilePrompts', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideTestPorts()] });
    return { prompts: TestBed.inject(FilePrompts), ui: TestBed.inject(UiStore) };
  }
  const overwrite = (tabId: string, closing = false) => ({ kind: 'overwrite' as const, tabId, closing });

  it('FIL-033 questions show one at a time and a file is asked about once', () => {
    const { prompts } = setup();
    prompts.ask(overwrite('a'));
    prompts.ask(overwrite('b'));
    prompts.ask(overwrite('a'));
    expect(prompts.current()).toEqual(overwrite('a'));
    expect(prompts.waiting()).toHaveLength(2);
    prompts.dismiss('a');
    expect(prompts.current()).toEqual(overwrite('b'));
  });

  it('FIL-049 a question that comes from closing goes first and replaces the waiting one of that file', () => {
    const { prompts } = setup();
    prompts.ask(overwrite('a'));
    prompts.ask(overwrite('b'));
    prompts.ask({ kind: 'close', tabId: 'b' });
    expect(prompts.current()).toEqual({ kind: 'close', tabId: 'b' });
    expect(prompts.waiting()).toHaveLength(2);
    prompts.ask(overwrite('a', true));
    expect(prompts.current()).toEqual(overwrite('a', true));
  });

  it('FIL-050 in presentation mode and during a stroke no question and no notice shows; they wait', () => {
    const { prompts, ui } = setup();
    ui.hasDocument.set(true);
    prompts.ask(overwrite('a'));
    prompts.showNotice('b');
    for (const hold of [() => ui.setMode('presentation'), () => ui.strokeInProgress.set(true)]) {
      hold();
      expect(prompts.current()).toBeNull();
      expect(prompts.notice()).toBeNull();
      ui.setMode('annotation');
      ui.strokeInProgress.set(false);
    }
    expect(prompts.current()).toEqual(overwrite('a'));
    expect(prompts.notice()).toBe('b');
  });

  it('FIL-039 notices queue; a tapped one goes first; a closed file takes its question and notice along', () => {
    const { prompts } = setup();
    prompts.showNotice('a');
    prompts.showNotice('b');
    expect(prompts.notice()).toBe('a');
    prompts.showNotice('b', true);
    expect(prompts.notice()).toBe('b');
    prompts.ask(overwrite('b'));
    prompts.drop('b');
    expect(prompts.current()).toBeNull();
    expect(prompts.notice()).toBe('a');
    prompts.dismissNotice('a');
    expect(prompts.notice()).toBeNull();
  });
});
