import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { CommandBus } from './command-bus';
import type { Command } from './command-bus';
import { commandForKey, KeyboardInput } from './keyboard-input';
import type { KeyEventLike } from './keyboard-input';

const key = (code: string, extra: Partial<KeyEventLike> = {}): KeyEventLike => ({
  code, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false, ...extra,
});

describe('commandForKey', () => {
  const table: ReadonlyArray<[keyof typeof TUNABLES.keymap, Command['type']]> = [
    ['next', 'Next'], ['previous', 'Previous'], ['first', 'First'], ['last', 'Last'], ['back', 'Back'],
  ];
  for (const [name, type] of table) {
    for (const id of TUNABLES.keymap[name]) {
      it(`NAV-002 ${id} is ${type}`, () => {
        const shift = id.startsWith('Shift+');
        expect(commandForKey(key(shift ? id.slice('Shift+'.length) : id, { shiftKey: shift }))?.type).toBe(type);
      });
    }
  }

  it('NAV-002 Shift+Space is previous, Space is next', () => {
    expect(commandForKey(key('Space', { shiftKey: true }))?.type).toBe('Previous');
    expect(commandForKey(key('Space'))?.type).toBe('Next');
  });

  it('NAV-003 Ctrl, Alt and Meta chords are ignored', () => {
    expect(commandForKey(key('ArrowRight', { ctrlKey: true }))).toBeNull();
    expect(commandForKey(key('ArrowRight', { altKey: true }))).toBeNull();
    expect(commandForKey(key('ArrowRight', { metaKey: true }))).toBeNull();
  });

  it('NAV-004 repeats are ignored unless allowed', () => {
    expect(commandForKey(key('PageDown', { repeat: true }))).toBeNull();
  });

  it('NAV-002 unmapped keys give nothing', () => {
    expect(commandForKey(key('KeyA'))).toBeNull();
  });
});

describe('KeyboardInput', () => {
  let commands: Command[];
  let doc: Document;
  let body: HTMLElement;
  beforeEach(() => {
    commands = [];
    TestBed.inject(CommandBus).commands$.subscribe((c) => commands.push(c));
    TestBed.inject(KeyboardInput);
    doc = TestBed.inject(DOCUMENT);
    body = doc.body;
  });

  const press = (target: EventTarget, init: KeyboardEventInit): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };

  it('NAV-001 NAV-019 a mapped key dispatches its command and prevents the default', () => {
    const event = press(body, { code: 'PageDown' });
    expect(commands).toEqual([{ type: 'Next' }]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('NAV-002 unmapped keys keep their default', () => {
    const event = press(body, { code: 'KeyA' });
    expect(commands).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it('NAV-001 text fields keep their keys; a focused slider keeps its arrows only', () => {
    const text = body.appendChild(doc.createElement('input'));
    const range = body.appendChild(doc.createElement('input'));
    range.type = 'range';
    press(text, { code: 'ArrowRight' });
    press(range, { code: 'ArrowRight' });
    expect(commands).toEqual([]);
    press(range, { code: 'PageDown' });
    expect(commands).toEqual([{ type: 'Next' }]);
    text.remove();
    range.remove();
  });
});
