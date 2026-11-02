import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { provideTestPorts } from '../../testing/provide-test-ports';
import { CommandBus } from './command-bus';
import { InkInput } from './ink-input';
import type { Command } from './command-bus';
import { PointerStage } from './pointer-input';
import { SlideNavStore } from '../state/slide-nav.store';
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
    expect(stage.style.touchAction).toBe('pan-x pan-y');
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

  describe('pinch, pan and double tap', () => {
    const touch = 'touch';
    const zoomView = (zoom: number): void => {
      Object.defineProperty(TestBed.inject(SlideNavStore), 'view', { value: () => ({ zoom, panX: 0, panY: 0 }) });
    };

    it('NAV-014 two pointers dispatch ZoomBy with the distance ratio around the midpoint', () => {
      fire('pointerdown', 1, 400, 300, 0, touch);
      fire('pointerdown', 2, 600, 300, 5, touch);
      fire('pointermove', 2, 700, 300, 10, touch);
      fire('pointermove', 2, 800, 300, 15, touch);
      expect(commands).toEqual([
        { type: 'ZoomBy', factor: 300 / 200, anchor: { x: 550, y: 300 } },
        { type: 'ZoomBy', factor: 400 / 300, anchor: { x: 600, y: 300 } },
      ]);
    });

    it('NAV-014 lifting a finger ends the pinch and the remaining finger does not tap or pan', () => {
      fire('pointerdown', 1, 400, 300, 0, touch);
      fire('pointerdown', 2, 600, 300, 5, touch);
      fire('pointerup', 2, 600, 300, 10, touch);
      fire('pointermove', 1, 100, 300, 20, touch);
      fire('pointerup', 1, 100, 300, 30, touch);
      expect(commands).toEqual([]);
    });

    it('NAV-014 a zoomed one-finger drag pans by the pointer deltas and does not swipe', () => {
      zoomView(2);
      fire('pointerdown', 1, 500, 300, 0, touch);
      fire('pointermove', 1, 450, 320, 50, touch);
      fire('pointermove', 1, 400, 330, 100, touch);
      fire('pointerup', 1, 400, 330, 120, touch);
      expect(commands).toEqual([
        { type: 'Pan', dx: -50, dy: 20 },
        { type: 'Pan', dx: -50, dy: 10 },
      ]);
    });

    it('NAV-014 organization pointers never pan (native scrolling)', () => {
      setMode('organization');
      fire('pointerdown', 1, 500, 300, 0, touch);
      fire('pointermove', 1, 450, 320, 50, touch);
      fire('pointerup', 1, 450, 320, 60, touch);
      expect(commands).toEqual([]);
    });

    it('NAV-016 two quick taps close together in organization mode zoom once', () => {
      setMode('organization');
      tap(500);
      fire('pointerdown', 1, 505, 300, 200);
      fire('pointerup', 1, 505, 300, 250);
      expect(commands).toEqual([{ type: 'DoubleTapZoom', anchor: { x: 505, y: 300 } }]);
      fire('pointerdown', 1, 505, 300, 300);
      fire('pointerup', 1, 505, 300, 350);
      expect(commands).toHaveLength(1); // the pair is used up
    });

    it('NAV-016 taps too late or too far apart do not zoom', () => {
      setMode('organization');
      tap(500);
      fire('pointerdown', 1, 500, 300, 100 + TUNABLES.gestures.doubleTapMaxIntervalMs + 1);
      fire('pointerup', 1, 500, 300, 100 + TUNABLES.gestures.doubleTapMaxIntervalMs + 50);
      fire('pointerdown', 1, 500 + TUNABLES.gestures.doubleTapMaxDistancePx + 5, 300, 1000);
      fire('pointerup', 1, 500 + TUNABLES.gestures.doubleTapMaxDistancePx + 5, 300, 1050);
      expect(commands).toEqual([]);
    });

    it('NAV-016 taps on a bar are not double taps', () => {
      setMode('organization');
      const bar = stage.appendChild(stage.ownerDocument.createElement('div'));
      bar.setAttribute('data-bar', '');
      const tapBar = (t: number): void => {
        for (const type of ['pointerdown', 'pointerup']) {
          const event = new Event(type, { bubbles: true });
          Object.defineProperty(event, 'timeStamp', { value: t });
          Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 500, clientY: 300 });
          bar.dispatchEvent(event);
          t += 10;
        }
      };
      tapBar(0);
      tapBar(100);
      expect(commands).toEqual([]);
    });

    it('NAV-016 a double tap in annotation mode only taps', () => {
      tap(0.9 * WIDTH);
      fire('pointerdown', 1, 0.9 * WIDTH, 300, 150);
      fire('pointerup', 1, 0.9 * WIDTH, 300, 250);
      expect(types()).toEqual(['Next', 'Next']);
    });
  });
});

describe('PointerStage drawing (M14 S3)', () => {
  let stage: HTMLElement;
  let ink: { begin: ReturnType<typeof vi.fn>; move: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> };
  let commands: Command[];

  function setup(begins = true): void {
    ink = { begin: vi.fn(() => begins), move: vi.fn(), end: vi.fn(), cancel: vi.fn() };
    TestBed.configureTestingModule({ providers: [provideTestPorts(), { provide: InkInput, useValue: ink }] });
    const ui = TestBed.inject(UiStore);
    ui.hasDocument.set(true);
    ui.setTool('pen');
    commands = [];
    TestBed.inject(CommandBus).commands$.subscribe((c) => commands.push(c));
    const fixture = TestBed.createComponent(Host);
    stage = fixture.nativeElement.querySelector('.stage') as HTMLElement;
    stage.getBoundingClientRect = () => ({ left: 10, top: 20, width: WIDTH, height: HEIGHT, right: WIDTH, bottom: HEIGHT, x: 10, y: 20 }) as DOMRect;
    stage.setPointerCapture = vi.fn();
  }

  function fire(type: string, id: number, x: number, y: number, extra: object = {}): void {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: id, pointerType: 'mouse', button: 0, clientX: x, clientY: y }, extra);
    stage.dispatchEvent(event);
  }

  it('ANN-008 one pointer with a tool draws: down begins a stroke at the client position, moves feed it, up ends it', () => {
    setup();
    fire('pointerdown', 1, 100, 200);
    expect(ink.begin).toHaveBeenCalledWith({ x: 100, y: 200 }, expect.objectContaining({ x: 10, y: 20, width: WIDTH, height: HEIGHT }));
    expect(stage.setPointerCapture).toHaveBeenCalledWith(1);
    fire('pointermove', 1, 110, 210);
    expect(ink.move).toHaveBeenCalledWith([{ x: 110, y: 210 }]);
    fire('pointerup', 1, 120, 220);
    expect(ink.end).toHaveBeenCalledTimes(1);
  });

  it('ANN-008 tap zones and swipes are off while a tool is active: nothing is dispatched', () => {
    setup();
    fire('pointerdown', 1, 0.9 * WIDTH, 300);
    fire('pointermove', 1, 0.5 * WIDTH, 300);
    fire('pointerup', 1, 0.1 * WIDTH, 300);
    expect(commands).toEqual([]);
  });

  it('ANN-011 all coalesced events of a move are used, in order', () => {
    setup();
    fire('pointerdown', 1, 100, 200);
    const coalesced = [{ clientX: 101, clientY: 201 }, { clientX: 102, clientY: 202 }, { clientX: 103, clientY: 203 }];
    fire('pointermove', 1, 103, 203, { getCoalescedEvents: () => coalesced });
    expect(ink.move).toHaveBeenCalledWith([{ x: 101, y: 201 }, { x: 102, y: 202 }, { x: 103, y: 203 }]);
  });

  it('ANN-011 without coalesced events (or an empty list) the event itself is used', () => {
    setup();
    fire('pointerdown', 1, 100, 200);
    fire('pointermove', 1, 105, 205, { getCoalescedEvents: () => [] });
    expect(ink.move).toHaveBeenCalledWith([{ x: 105, y: 205 }]);
  });

  it('ANN-008 a second pointer discards the stroke and turns into a pinch', () => {
    setup();
    fire('pointerdown', 1, 100, 200);
    fire('pointerdown', 2, 300, 200);
    expect(ink.cancel).toHaveBeenCalledTimes(1);
    fire('pointermove', 1, 90, 200);
    fire('pointerup', 1, 90, 200);
    expect(ink.move).not.toHaveBeenCalled();
    expect(ink.end).not.toHaveBeenCalled();
  });

  it('ANN-011 pointercancel discards the stroke', () => {
    setup();
    fire('pointerdown', 1, 100, 200);
    fire('pointercancel', 1, 100, 200);
    fire('pointerup', 1, 100, 200);
    expect(ink.cancel).toHaveBeenCalledTimes(1);
    expect(ink.end).not.toHaveBeenCalled();
  });

  it('ANN-010 a gesture the ink input refuses is ignored for its whole length', () => {
    setup(false);
    fire('pointerdown', 1, 100, 200);
    fire('pointermove', 1, 110, 210);
    fire('pointerup', 1, 110, 210);
    expect(stage.setPointerCapture).not.toHaveBeenCalled();
    expect(ink.move).not.toHaveBeenCalled();
    expect(ink.end).not.toHaveBeenCalled();
    expect(commands).toEqual([]);
  });
});
