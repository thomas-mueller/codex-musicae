import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { HostPlatform } from '../state/host-platform';
import { UiStore } from '../state/ui.store';
import { CommandBus } from './command-bus';
import type { Command } from './command-bus';

/** The parts of a `KeyboardEvent` the mapping looks at. */
export interface KeyEventLike {
  readonly code: string;
  /** The character the keyboard layout gives the key; only the shortcuts look at it. */
  readonly key?: string;
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

const HISTORY_COMMAND_OF: ReadonlyArray<readonly ['undo' | 'redo', Command]> = [
  ['undo', { type: 'Undo' }],
  ['redo', { type: 'Redo' }],
];

/** The modifier of the shortcuts: Cmd on macOS and iOS, Ctrl elsewhere. */
export type CommandModifier = 'meta' | 'ctrl';

/** NAV-021: from the name the platform gives itself. */
export function commandModifier(platform: string): CommandModifier {
  return TUNABLES.platforms.appleNamePrefixes.some((prefix) => platform.startsWith(prefix)) ? 'meta' : 'ctrl';
}

/**
 * NAV-001..NAV-004, NAV-019, NAV-021: key id is `Shift+` plus `event.code`. Chords with Ctrl, Alt or Meta are ignored, except
 * the undo and redo shortcuts; repeats are ignored (by default).
 */
export function commandForKey(event: KeyEventLike, modifier: CommandModifier = 'ctrl'): Command | null {
  if (event.repeat && !TUNABLES.gestures.allowKeyRepeat) {
    return null;
  }
  if (event.ctrlKey || event.altKey || event.metaKey) {
    return historyCommandForKey(event, modifier);
  }
  const id = (event.shiftKey ? 'Shift+' : '') + event.code;
  for (const [name, command] of COMMAND_OF) {
    if ((TUNABLES.keymap[name] as readonly string[]).includes(id)) {
      return command;
    }
  }
  return null;
}

/** NAV-021: the command modifier alone, with Shift for redo. Alt rules it out, and so AltGr (Ctrl+Alt). */
function historyCommandForKey(event: KeyEventLike, modifier: CommandModifier): Command | null {
  const [held, other] = modifier === 'meta' ? [event.metaKey, event.ctrlKey] : [event.ctrlKey, event.metaKey];
  const letter = shortcutLetter(event);
  if (!held || other || event.altKey || letter === null) {
    return null;
  }
  const id = (event.shiftKey ? 'Shift+' : '') + letter;
  return HISTORY_COMMAND_OF.find(([name]) => (TUNABLES.keymap[name] as readonly string[]).includes(id))?.[1] ?? null;
}

/**
 * The letter printed on the key, so that the shortcut follows the layout (on a German keyboard `KeyZ` is the key labelled Y).
 * A layout without Latin letters falls back to the position of the key.
 */
function shortcutLetter({ key = '', code }: KeyEventLike): string | null {
  if (/^[a-z]$/i.test(key)) {
    return key.toLowerCase();
  }
  return /^Key[A-Z]$/.test(code) ? code.slice('Key'.length).toLowerCase() : null;
}

/** Text fields keep every key; a focused slider keeps its arrow keys. */
function isTypingTarget(target: EventTarget | null, code: string): boolean {
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
  private readonly ui = inject(UiStore);
  private readonly modifier = commandModifier(inject(HostPlatform).name);

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
    const command = commandForKey(event, this.modifier);
    if (command !== null && this.acts(command)) {
      event.preventDefault();
      this.bus.dispatch(command);
    }
  }

  private acts(command: Command): boolean {
    const mode = this.ui.mode();
    // NAV-022: the shortcuts belong to the two editing modes.
    if (command.type === 'Undo' || command.type === 'Redo') {
      return mode === 'annotation' || mode === 'organization';
    }
    // UIX-025: in the settings mode the other keys stay with the focused control and with scrolling.
    return mode !== 'settings' || command.type === 'Back';
  }
}
