import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { CommandBus } from './command-bus';
import type { Command } from './command-bus';

/** The parts of a `KeyboardEvent` the mapping looks at. */
export interface KeyEventLike {
  readonly code: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
}

const COMMAND_OF: ReadonlyArray<readonly [keyof typeof TUNABLES.keymap, Command]> = [
  ['next', { type: 'Next' }],
  ['previous', { type: 'Previous' }],
  ['first', { type: 'First' }],
  ['last', { type: 'Last' }],
  ['back', { type: 'Back' }],
];

/** NAV-001..NAV-004, NAV-019: key id is `Shift+` plus `event.code`; modifier chords and (by default) repeats are ignored. */
export function commandForKey(event: KeyEventLike): Command | null {
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return null;
  }
  if (event.repeat && !TUNABLES.gestures.allowKeyRepeat) {
    return null;
  }
  const id = (event.shiftKey ? 'Shift+' : '') + event.code;
  for (const [name, command] of COMMAND_OF) {
    if ((TUNABLES.keymap[name] as readonly string[]).includes(id)) {
      return command;
    }
  }
  return null;
}

/** Text fields keep every key; a focused slider keeps its arrow keys. */
export function isTypingTarget(target: EventTarget | null, code: string): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) {
    return true;
  }
  if (target instanceof HTMLInputElement) {
    return target.type === 'range' ? code.startsWith('Arrow') : true;
  }
  return false;
}

/** One `keydown` listener on the document turns pedal and keyboard keys into commands. */
@Injectable({ providedIn: 'root' })
export class KeyboardInput {
  private readonly bus = inject(CommandBus);

  constructor() {
    const doc = inject(DOCUMENT);
    const listener = (event: KeyboardEvent): void => this.onKeydown(event);
    doc.addEventListener('keydown', listener);
    inject(DestroyRef).onDestroy(() => doc.removeEventListener('keydown', listener));
  }

  private onKeydown(event: KeyboardEvent): void {
    if (isTypingTarget(event.target, event.code)) {
      return;
    }
    const command = commandForKey(event);
    if (command !== null) {
      event.preventDefault();
      this.bus.dispatch(command);
    }
  }
}
