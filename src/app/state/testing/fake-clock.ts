import type { Clock } from '../clock';

/** Manual clock for specs: time only moves with `advance`. */
export class FakeClock implements Clock {
  private time = 0;
  private timers: Array<{ at: number; fn: () => void; cancelled: boolean }> = [];

  now(): number {
    return this.time;
  }

  schedule(ms: number, fn: () => void): () => void {
    const timer = { at: this.time + ms, fn, cancelled: false };
    this.timers.push(timer);
    return () => {
      timer.cancelled = true;
    };
  }

  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = this.timers.filter((t) => !t.cancelled && t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) {
        break;
      }
      this.time = due.at;
      due.cancelled = true;
      due.fn();
    }
    this.time = target;
  }
}
