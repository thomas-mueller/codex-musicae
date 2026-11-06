import { computed, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { classifyTrack, isDoubleTap, pointerPolicy, shouldIgnoreTouch, tapZoneOf } from '../core';
import type { PenEvent, PointerPolicy, PointerSample } from '../core';
import { SlideNavStore } from '../state/slide-nav.store';
import { StylusStore } from '../state/stylus.store';
import { UiStore } from '../state/ui.store';
import { CommandBus } from './command-bus';
import { InkInput } from './ink-input';
import type { Command, Point } from './command-bus';
import { WheelInput } from './wheel-input';

interface Track {
  readonly policy: PointerPolicy;
  readonly samples: PointerSample[];
  /** Started on a bar, marker, chip or popup: those handle the tap themselves. */
  readonly interactive: boolean;
}

/** Elements of organization mode that react to taps themselves; a double tap there is not a zoom. */
const OWN_TAP_TARGETS = '[data-bar],[data-marker],[data-chip],[data-popup]';

/**
 * The stage of all three modes. Turns pointer events into commands: `pointerPolicy` is called here and nowhere else
 * (ARC-006); it decides whether a pointer draws, navigates, pinches or selects. NAV-006..NAV-010, ANN-008
 */
@Directive({
  selector: '[appPointerStage]',
  host: {
    '[style.touch-action]': 'touchAction()',
    '(pointerdown)': 'onDown($event)',
    '(pointerup)': 'onUp($event)',
    '(pointercancel)': 'onCancel($event)',
    '(wheel)': 'onWheel($event)',
  },
})
export class PointerStage {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly ui = inject(UiStore);
  private readonly nav = inject(SlideNavStore);
  private readonly bus = inject(CommandBus);
  private readonly ink = inject(InkInput);
  private readonly stylus = inject(StylusStore);
  private readonly wheel = new WheelInput();
  /** Active pointers; only those with a single-pointer gesture role carry a track. */
  private readonly pointers = new Map<number, Track | null>();
  /** Latest stage position of every active pointer (pinch). */
  private readonly positions = new Map<number, Point>();
  /** Where each touch began (stage position); tells a resting palm from a deliberate gesture when the pen arrives. */
  private readonly touchStarts = new Map<number, Point>();
  /** Touches rejected as palms (STY-004): ignored until they lift. */
  private readonly ignored = new Set<number>();
  private pinchDistance: number | null = null;
  private lastTap: PointerSample | null = null;
  /** The pointer that draws a stroke (role 'draw'), if any. ANN-008 */
  private drawPointerId: number | null = null;
  /** Client position where the stroke began, and whether it has moved beyond the tap threshold since (STY-004). */
  private drawStartX = 0;
  private drawStartY = 0;
  private drawMoved = false;

  /** Organization mode scrolls natively (one finger, both axes) but never zooms the page itself. */
  protected readonly touchAction = computed(() => (this.ui.mode() === 'organization' ? 'pan-x pan-y' : 'none'));

  constructor() {
    // Native listener: a host binding would schedule change detection for every move, which a stroke must not cause (ANN-011).
    const onMove = (event: PointerEvent): void => this.onMove(event);
    const onLeave = (event: PointerEvent): void => this.trackPen(event, 'pen-leave');
    this.element.addEventListener('pointermove', onMove, { passive: true });
    this.element.addEventListener('pointerleave', onLeave, { passive: true });
    this.element.addEventListener('pointerout', onLeave, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      this.element.removeEventListener('pointermove', onMove);
      this.element.removeEventListener('pointerleave', onLeave);
      this.element.removeEventListener('pointerout', onLeave);
      this.cancelDrawing();
    });
  }

  protected onDown(event: PointerEvent): void {
    this.trackPen(event, 'pen-down');
    if (event.button !== 0 || this.ui.popup() !== null) {
      return;
    }
    if (this.isPalm(event)) {
      this.ignored.add(event.pointerId);
      return;
    }
    // A further pointer ends the single-pointer gestures in progress (pinch, S3) and discards a stroke being drawn.
    this.cancelDrawing();
    for (const id of this.pointers.keys()) {
      this.pointers.set(id, null);
    }
    this.pointers.set(event.pointerId, null);
    const policy = pointerPolicy({
      mode: this.ui.mode(),
      toolActive: this.ui.tool() !== null,
      pointerCount: this.pointers.size,
      zoomed: this.ui.mode() === 'annotation' && this.isZoomed(),
      stylusSeen: this.stylus.stylusSeen(),
      allowFingerDrawing: this.stylus.allowFingerDrawing(),
      pointerType: pointerTypeOf(event),
    });
    const first = this.sample(event);
    this.positions.set(event.pointerId, { x: first.x, y: first.y });
    if (event.pointerType === 'touch') {
      this.touchStarts.set(event.pointerId, { x: first.x, y: first.y });
    }
    if (policy.role === 'pinch') {
      this.pinchDistance = this.distance();
    } else if (policy.role === 'draw') {
      if (this.ink.begin({ x: event.clientX, y: event.clientY }, this.element.getBoundingClientRect())) {
        this.drawPointerId = event.pointerId;
        this.drawStartX = event.clientX;
        this.drawStartY = event.clientY;
        this.drawMoved = false;
        this.element.setPointerCapture(event.pointerId); // the stroke continues beyond the stage
      }
    } else if (policy.role === 'gestures' || policy.role === 'org-select') {
      const interactive = event.target instanceof Element && event.target.closest(OWN_TAP_TARGETS) !== null;
      this.pointers.set(event.pointerId, { policy, samples: [first], interactive });
      if (policy.role === 'gestures') {
        this.element.setPointerCapture(event.pointerId); // organization keeps the clicks of its own elements
      }
    }
  }

  private onMove(event: PointerEvent): void {
    this.trackPen(event, event.buttons !== 0 ? 'pen-move' : 'pen-hover');
    if (this.ignored.has(event.pointerId)) {
      return;
    }
    if (event.pointerId === this.drawPointerId) {
      this.drawMoved ||= Math.hypot(event.clientX - this.drawStartX, event.clientY - this.drawStartY) > TUNABLES.gestures.tapMaxMovePx;
      this.ink.move(clientPoints(event));
      return;
    }
    const sample = this.sample(event);
    if (this.positions.has(event.pointerId)) {
      this.positions.set(event.pointerId, { x: sample.x, y: sample.y });
    }
    if (this.pinchDistance !== null) {
      this.pinch();
      return;
    }
    const track = this.pointers.get(event.pointerId);
    const previous = track?.samples[track.samples.length - 1];
    track?.samples.push(sample);
    // NAV-014: one pointer pans a zoomed slide; organization mode scrolls natively.
    if (track?.policy.pan && previous !== undefined && this.ui.mode() !== 'organization') {
      this.bus.dispatch({ type: 'Pan', dx: sample.x - previous.x, dy: sample.y - previous.y });
    }
  }

  protected onWheel(event: WheelEvent): void {
    const rect = this.element.getBoundingClientRect();
    const mode = this.ui.mode();
    const result = this.wheel.handle(
      { deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, t: event.timeStamp },
      { mode, zoomed: mode === 'annotation' && this.isZoomed(), anchor: { x: event.clientX - rect.left, y: event.clientY - rect.top } },
    );
    if (result.preventDefault) {
      event.preventDefault();
    }
    if (result.command !== null) {
      this.bus.dispatch(result.command);
    }
  }

  protected onUp(event: PointerEvent): void {
    this.trackPen(event, 'pen-up');
    if (this.ignored.delete(event.pointerId)) {
      return;
    }
    if (event.pointerId === this.drawPointerId) {
      this.drawPointerId = null;
      this.ink.end();
    }
    const track = this.pointers.get(event.pointerId);
    this.forget(event.pointerId);
    if (!track) {
      return;
    }
    track.samples.push(this.sample(event));
    const command = this.commandFor(track);
    if (command !== null) {
      this.bus.dispatch(command);
    }
  }

  protected onCancel(event: PointerEvent): void {
    this.trackPen(event, 'pen-cancel');
    if (this.ignored.delete(event.pointerId)) {
      return;
    }
    if (event.pointerId === this.drawPointerId) {
      this.cancelDrawing();
    }
    this.forget(event.pointerId);
  }

  /** STY-001: any pen event marks the stylus as seen and feeds the pen state for palm rejection. */
  private trackPen(event: PointerEvent, type: PenEvent['type']): void {
    if (event.pointerType !== 'pen') {
      return;
    }
    void this.stylus.markSeen();
    const wasActive = this.stylus.penNow().active;
    this.stylus.feedPen({ type, t: event.timeStamp });
    if (!wasActive && this.stylus.penNow().active) {
      this.dropRestingTouches();
    }
  }

  /** STY-004: a touch (pen not yet near) that has hardly moved was a palm; touches that moved are deliberate and stay. */
  private isPalm(event: PointerEvent): boolean {
    return (
      event.pointerType === 'touch' &&
      this.stylus.stylusSeen() &&
      shouldIgnoreTouch(this.stylus.penNow(), event.timeStamp, TUNABLES.stylus.palmRejectionGraceMs)
    );
  }

  /** The pen has just come near: touches in progress that have not moved more than the tap threshold are cancelled. */
  private dropRestingTouches(): void {
    for (const [id, start] of [...this.touchStarts]) {
      const now = this.positions.get(id) ?? start;
      const moved = id === this.drawPointerId ? this.drawMoved : Math.hypot(now.x - start.x, now.y - start.y) > TUNABLES.gestures.tapMaxMovePx;
      if (moved) {
        continue;
      }
      if (id === this.drawPointerId) {
        this.cancelDrawing();
      }
      this.forget(id);
      this.ignored.add(id);
    }
  }

  private cancelDrawing(): void {
    if (this.drawPointerId !== null) {
      this.drawPointerId = null;
      this.ink.cancel();
    }
  }

  private forget(pointerId: number): void {
    this.pointers.delete(pointerId);
    this.positions.delete(pointerId);
    this.touchStarts.delete(pointerId);
    if (this.positions.size < 2) {
      this.pinchDistance = null;
    }
  }

  private distance(): number {
    const [a, b] = [...this.positions.values()];
    return a !== undefined && b !== undefined ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
  }

  /** NAV-014: factor = finger distance now / at the previous move, around the midpoint. */
  private pinch(): void {
    const [a, b] = [...this.positions.values()];
    const previous = this.pinchDistance;
    const distance = this.distance();
    if (a === undefined || b === undefined || previous === null || previous <= 0 || distance <= 0) {
      this.pinchDistance = distance;
      return;
    }
    this.pinchDistance = distance;
    this.bus.dispatch({ type: 'ZoomBy', factor: distance / previous, anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
  }

  private isZoomed(): boolean {
    return this.nav.view().zoom > 1 + TUNABLES.zoom.fitEpsilon;
  }

  private commandFor(track: Track): Command | null {
    const width = this.element.getBoundingClientRect().width;
    const kind = classifyTrack(track.samples, width, TUNABLES.gestures);
    const last = track.samples[track.samples.length - 1];
    if (track.policy.role === 'org-select') {
      return kind === 'tap' && !track.interactive && last !== undefined ? this.doubleTap(last) : null;
    }
    if (kind === 'tap' && track.policy.tapZones && last !== undefined) {
      const zone = tapZoneOf(last.x, width, TUNABLES.gestures.tapZones);
      return zone === 'left' ? { type: 'Previous' } : zone === 'right' ? { type: 'Next' } : { type: 'ToggleMode' };
    }
    if (track.policy.swipes && kind === 'swipe-left') {
      return { type: 'Next' };
    }
    if (track.policy.swipes && kind === 'swipe-right') {
      return { type: 'Previous' };
    }
    return null;
  }

  /** NAV-016: the second of two quick taps close together zooms; the pair is used up. */
  private doubleTap(tap: PointerSample): Command | null {
    const previous = this.lastTap;
    if (previous !== null && isDoubleTap(previous, tap, { intervalMs: TUNABLES.gestures.doubleTapMaxIntervalMs, distancePx: TUNABLES.gestures.doubleTapMaxDistancePx })) {
      this.lastTap = null;
      return { type: 'DoubleTapZoom', anchor: { x: tap.x, y: tap.y } };
    }
    this.lastTap = tap;
    return null;
  }

  private sample(event: PointerEvent): PointerSample {
    const rect = this.element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, t: event.timeStamp };
  }
}

/** Every sample of the move (coalesced events where the browser has them), oldest first. */
function clientPoints(event: PointerEvent): Point[] {
  const coalesced = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
  return (coalesced.length > 0 ? coalesced : [event]).map((e) => ({ x: e.clientX, y: e.clientY }));
}

function pointerTypeOf(event: PointerEvent): 'touch' | 'mouse' | 'pen' {
  return event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse';
}
