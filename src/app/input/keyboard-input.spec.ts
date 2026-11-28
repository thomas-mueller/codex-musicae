import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { UiStore } from '../state/ui.store';
import { CommandBus } from './command-bus';
import type { Command } from './command-bus';
import { commandForKey, commandModifier, KeyboardInput } from './keyboard-input';
import type { CommandModifier, KeyEventLike } from './keyboard-input';
import { HostPlatform } from '../state/host-platform';

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

describe('KeyboardInput in the settings mode', () => {
  it('UIX-025 NAV-018 only Back is mapped; every other key keeps its default for the controls and for scrolling', () => {
    const commands: Command[] = [];
    TestBed.inject(CommandBus).commands$.subscribe((c) => commands.push(c));
    TestBed.inject(KeyboardInput);
    TestBed.inject(UiStore).setMode('settings');
    const body = TestBed.inject(DOCUMENT).body;
    const press = (code: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code });
      body.dispatchEvent(event);
      return event;
    };
    for (const code of ['Space', 'ArrowDown', 'PageDown', 'Home']) {
      expect(press(code).defaultPrevented, code).toBe(false);
    }
    expect(commands).toEqual([]);
    expect(press('Escape').defaultPrevented).toBe(true);
    expect(commands).toEqual([{ type: 'Back' }]);
  });
});

describe('commandModifier', () => {
  const platforms: ReadonlyArray<[string, CommandModifier]> = [
    ['MacIntel', 'meta'], ['iPhone', 'meta'], ['iPad', 'meta'], ['iPod', 'meta'],
    ['Win32', 'ctrl'], ['Linux x86_64', 'ctrl'], ['Linux armv8l', 'ctrl'], ['', 'ctrl'],
  ];
  for (const [platform, modifier] of platforms) {
    it(`NAV-021 "${platform}" uses ${modifier}`, () => {
      expect(commandModifier(platform)).toBe(modifier);
    });
  }
});

describe('commandForKey: undo and redo', () => {
  const MAPPINGS = [
    { modifier: 'meta', held: { metaKey: true }, wrong: { ctrlKey: true } },
    { modifier: 'ctrl', held: { ctrlKey: true }, wrong: { metaKey: true } },
  ] as const;

  for (const { modifier, held, wrong } of MAPPINGS) {
    const z = (extra: Partial<KeyEventLike> = {}) => key('KeyZ', { key: 'z', ...extra });

    it(`NAV-021 ${modifier}+Z is undo and ${modifier}+Shift+Z is redo`, () => {
      expect(commandForKey(z(held), modifier)).toEqual({ type: 'Undo' });
      // with Shift held the browser reports the capital letter
      expect(commandForKey(z({ ...held, key: 'Z', shiftKey: true }), modifier)).toEqual({ type: 'Redo' });
    });

    it(`NAV-021 ${modifier}: the other modifier, both, Alt, no modifier, other letters and repeats give nothing`, () => {
      for (const event of [
        z(wrong), z({ ...held, ...wrong }), z({ ...held, altKey: true }), z({ altKey: true }), z(),
        key('KeyY', { key: 'y', ...held }), key('KeyA', { key: 'a', ...held }), key('ArrowRight', { key: 'ArrowRight', ...held }),
        key('Space', { key: ' ', ...held }), z({ ...held, repeat: true }),
      ]) {
        expect(commandForKey(event, modifier), JSON.stringify(event)).toBeNull();
      }
    });
  }

  it('NAV-021 the letter on the key counts, not its position (German layout)', () => {
    expect(commandForKey(key('KeyY', { key: 'z', ctrlKey: true }))).toEqual({ type: 'Undo' });
    expect(commandForKey(key('KeyZ', { key: 'y', ctrlKey: true }))).toBeNull();
  });

  it('NAV-021 a layout without Latin letters uses the position of the key', () => {
    expect(commandForKey(key('KeyZ', { key: '\u044f', ctrlKey: true }))).toEqual({ type: 'Undo' });
    expect(commandForKey(key('KeyZ', { key: '\u042f', ctrlKey: true, shiftKey: true }))).toEqual({ type: 'Redo' });
  });
});

describe('KeyboardInput: undo and redo', () => {
  function setup(platform: string) {
    TestBed.configureTestingModule({ providers: [{ provide: HostPlatform, useValue: { name: platform } }] });
    const commands: Command[] = [];
    TestBed.inject(CommandBus).commands$.subscribe((c) => commands.push(c));
    TestBed.inject(KeyboardInput);
    const body = TestBed.inject(DOCUMENT).body;
    const press = (init: KeyboardEventInit, target: HTMLElement = body): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'KeyZ', key: 'z', ...init });
      target.dispatchEvent(event);
      return event;
    };
    return { commands, press, body, ui: TestBed.inject(UiStore) };
  }

  it('NAV-021 on macOS the platform decides: Cmd acts, Ctrl keeps its default', () => {
    const { commands, press } = setup('MacIntel');
    expect(press({ ctrlKey: true }).defaultPrevented).toBe(false);
    expect(press({ metaKey: true }).defaultPrevented).toBe(true);
    expect(commands).toEqual([{ type: 'Undo' }]);
  });

  it('NAV-022 the shortcuts act in annotation and organization mode only', () => {
    const { commands, press, ui } = setup('Win32');
    ui.hasDocument.set(true);
    for (const [mode, acts] of [['annotation', true], ['organization', true], ['presentation', false], ['settings', false]] as const) {
      ui.setMode(mode);
      commands.length = 0;
      expect(press({ ctrlKey: true }).defaultPrevented, mode).toBe(acts);
      expect(press({ ctrlKey: true, shiftKey: true }).defaultPrevented, mode).toBe(acts);
      expect(commands, mode).toEqual(acts ? [{ type: 'Undo' }, { type: 'Redo' }] : []);
    }
  });

  it('NAV-022 a text field keeps the shortcuts', () => {
    const { commands, press, body } = setup('Win32');
    const fields = [body.appendChild(body.ownerDocument.createElement('input')), body.appendChild(body.ownerDocument.createElement('textarea'))];
    for (const field of fields) {
      expect(press({ ctrlKey: true }, field).defaultPrevented).toBe(false);
      field.remove();
    }
    expect(commands).toEqual([]);
  });
});
