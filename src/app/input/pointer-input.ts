import { computed, Directive, ElementRef, inject } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { classifyTrack, pointerPolicy, tapZoneOf } from '../core';
import type { PointerPolicy, PointerSample } from '../core';
import { SlideNavStore } from '../state/slide-nav.store';
import { UiStore } from '../state/ui.store';
import { CommandBus } from './command-bus';
import type { Command } from './command-bus';

interface Track {
  readonly policy: PointerPolicy;
  readonly samples: PointerSample[];
}

/**
 * The stage of all three modes. Turns pointer events into commands: `pointerPolicy` is called here and nowhere else
 * (ARC-006); it decides whether a pointer draws, navigates, pinches or selects. NAV-006..NAV-010, ANN-008
 */
@Directive({
  selector: '[appPointerStage]',
  host: {
    '[style.touch-action]': 'touchAction()',
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'onUp($event)',
    '(pointercancel)': 'onCancel($event)',
  },
})
export class PointerStage {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly ui = inject(UiStore);
  private readonly nav = inject(SlideNavStore);
  private readonly bus = inject(CommandBus);
  /** Active pointers; only those with a single-pointer gesture role carry a track. */
  private readonly pointers = new Map<number, Track | null>();

  /** Organization mode keeps native scrolling and browser pinch handling. */
  protected readonly touchAction = computed(() => (this.ui.mode() === 'organization' ? null : 'none'));

  protected onDown(event: PointerEvent): void {
    if (event.button !== 0 || this.ui.popup() !== null) {
      return;
    }
    // A further pointer ends the single-pointer gestures in progress (pinch, S3).
    for (const id of this.pointers.keys()) {
      this.pointers.set(id, null);
    }
    this.pointers.set(event.pointerId, null);
    const policy = pointerPolicy({
      mode: this.ui.mode(),
      toolActive: this.ui.tool() !== null,
      pointerCount: this.pointers.size,
      zoomed: this.ui.mode() === 'annotation' && this.nav.view().zoom > 1 + TUNABLES.zoom.fitEpsilon,
      stylusSeen: false,
      allowFingerDrawing: false,
      pointerType: pointerTypeOf(event),
    });
    if (policy.role === 'gestures') {
      this.pointers.set(event.pointerId, { policy, samples: [this.sample(event)] });
      this.element.setPointerCapture(event.pointerId);
    }
  }

  protected onMove(event: PointerEvent): void {
    this.pointers.get(event.pointerId)?.samples.push(this.sample(event));
  }

  protected onUp(event: PointerEvent): void {
    const track = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
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
    this.pointers.delete(event.pointerId);
  }

  private commandFor(track: Track): Command | null {
    const width = this.element.getBoundingClientRect().width;
    const kind = classifyTrack(track.samples, width, TUNABLES.gestures);
    const last = track.samples[track.samples.length - 1];
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

  private sample(event: PointerEvent): PointerSample {
    const rect = this.element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, t: event.timeStamp };
  }
}

function pointerTypeOf(event: PointerEvent): 'touch' | 'mouse' | 'pen' {
  return event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse';
}
