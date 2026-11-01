import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { provideTestPorts } from '../../testing/provide-test-ports';
import { CommandBus } from './command-bus';
import type { Command } from './command-bus';
import { PointerStage } from './pointer-input';
import { UiStore } from '../state/ui.store';
import type { Mode } from '../state/ui.store';

const WIDTH = 1000;
const HEIGHT = 600;
const SWIPE_DX = 0.2 * WIDTH;
const SWIPE_MS = 150;
const SLOW_MS = 1000;

@Component({ selector: 'app-host', imports: [PointerStage], template: '<div appPointerStage class="stage"></div>' })
class Host {}

describe('PointerStage', () => {
  let fixture: ComponentFixture<Host>;
  let stage: HTMLElement;
  let ui: UiStore;
  let commands: Command[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestPorts() });
    ui = TestBed.inject(UiStore);
    commands = [];
    TestBed.inject(CommandBus).commands$.subscribe((c) => commands.push(c));
    fixture = TestBed.createComponent(Host);
    stage = fixture.nativeElement.querySelector('.stage') as HTMLElement;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT, right: WIDTH, bottom: HEIGHT, x: 0, y: 0 }) as DOMRect;
    stage.setPointerCapture = vi.fn();
  });

  function fire(type: string, id: number, x: number, y: number, t: number, pointerType = 'mouse', button = 0): void {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'timeStamp', { value: t });
    Object.assign(event, { pointerId: id, pointerType, button, clientX: x, clientY: y });
    stage.dispatchEvent(event);
  }

  const tap = (x: number, pointerType = 'mouse'): void => {
    fire('pointerdown', 1, x, 300, 0, pointerType);
    fire('pointerup', 1, x, 300, 100, pointerType);
  };
  const drag = (dx: number, dy = 0, ms = SWIPE_MS, pointerType = 'mouse'): void => {
    const start = WIDTH / 2;
    fire('pointerdown', 1, start, 300, 0, pointerType);
    fire('pointermove', 1, start + dx / 2, 300 + dy / 2, ms / 2, pointerType);
    fire('pointerup', 1, start + dx, 300 + dy, ms, pointerType);
  };
  const types = (): string[] => commands.map((c) => c.type);
  const setMode = (mode: Mode): void => {
    ui.hasDocument.set(true);
    ui.setMode(mode);
  };

  it('NAV-006 NAV-007 taps in the left, center and right zones are previous, toggle mode and next', () => {
    tap(0.1 * WIDTH);
    tap(0.5 * WIDTH);
    tap(0.9 * WIDTH);
    expect(types()).toEqual(['Previous', 'ToggleMode', 'Next']);
  });

  it('NAV-007 touch taps work like mouse clicks', () => {
    tap(0.9 * WIDTH, 'touch');
    expect(types()).toEqual(['Next']);
  });

  it('NAV-008 swipes turn slides in annotation mode without a tool', () => {
    drag(-SWIPE_DX);
    drag(SWIPE_DX);
    expect(types()).toEqual(['Next', 'Previous']);
  });

  it('NAV-008 swipes turn slides in presentation mode', () => {
    setMode('presentation');
    drag(-SWIPE_DX);
    expect(types()).toEqual(['Next']);
  });

  it('NAV-010 vertical, short and slow drags do nothing', () => {
    drag(0, SWIPE_DX);
    drag(0.05 * WIDTH);
    drag(-SWIPE_DX, 0, SLOW_MS);
    expect(commands).toEqual([]);
  });

  it('ANN-008 NAV-009 with a tool active a pointer neither taps nor swipes', () => {
    ui.hasDocument.set(true);
    ui.setTool('pen');
    tap(0.9 * WIDTH);
    drag(-SWIPE_DX);
    expect(commands).toEqual([]);
  });

  it('NAV-009 organization mode never navigates by pointer and keeps native scrolling', () => {
    setMode('organization');
    tap(0.9 * WIDTH);
    drag(-SWIPE_DX);
    fixture.detectChanges();
    expect(commands).toEqual([]);
    expect(stage.style.touchAction).toBe('');
  });

  it('NAV-009 annotation and presentation take over touch handling', () => {
    fixture.detectChanges();
    expect(stage.style.touchAction).toBe('none');
  });

  it('NAV-009 a tap while a popup is open is ignored', () => {
    ui.openPopup('info');
    tap(0.9 * WIDTH);
    expect(commands).toEqual([]);
  });

  it('NAV-009 a second pointer cancels the single-pointer gesture', () => {
    fire('pointerdown', 1, 900, 300, 0);
    fire('pointerdown', 2, 100, 300, 10);
    fire('pointerup', 2, 100, 300, 50);
    fire('pointerup', 1, 900, 300, 60);
    expect(commands).toEqual([]);
  });

  it('NAV-007 pointercancel drops the track; the right button is ignored', () => {
    fire('pointerdown', 1, 900, 300, 0);
    fire('pointercancel', 1, 900, 300, 10);
    fire('pointerup', 1, 900, 300, 20);
    fire('pointerdown', 3, 900, 300, 30, 'mouse', 2);
    fire('pointerup', 3, 900, 300, 40, 'mouse', 2);
    expect(commands).toEqual([]);
  });

  it('NAV-007 the tap duration limit applies', () => {
    fire('pointerdown', 1, 900, 300, 0);
    fire('pointerup', 1, 900, 300, TUNABLES.gestures.tapMaxDurationMs + 1);
    expect(commands).toEqual([]);
  });
});
