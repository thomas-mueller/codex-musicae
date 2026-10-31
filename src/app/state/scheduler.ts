import { Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { pickNext, tasksToCancel } from '../core';
import type { SchedulerContext, TaskClass, TaskInfo } from '../core';
import { err, ok } from '../ports/result';
import type { Result } from '../ports/result';

interface Task {
  readonly info: TaskInfo;
  readonly run: (signal: AbortSignal) => Promise<unknown>;
  readonly controller: AbortController;
  readonly viewKey: string | undefined;
  readonly resolve: (result: Result<unknown, 'cancelled'>) => void;
}

export interface SubmitOptions {
  /** Render tasks carry the view they were made for; `setViewKey` cancels the others (NFR-008). */
  readonly viewKey?: string;
}

const IDLE_CONTEXT: SchedulerContext = {
  userActive: false,
  hidden: false,
  batterySaver: null,
  strokeInProgress: false,
};

/**
 * NFR-003: one work queue ranked input > visible > prefetch > save > detection (`core/scheduler`).
 * Every task has an AbortController; the work function must honor its signal.
 */
@Injectable({ providedIn: 'root' })
export class Scheduler {
  private queue: Task[] = [];
  private readonly running = new Set<Task>();
  private seq = 0;
  private context: SchedulerContext = IDLE_CONTEXT;
  private viewKey: string | undefined;

  /** Resolves ok(value), or err('cancelled') when the task was aborted or dropped. */
  submit<T>(cls: TaskClass, run: (signal: AbortSignal) => Promise<T>, options: SubmitOptions = {}): Promise<Result<T, 'cancelled'>> {
    return new Promise((resolve) => {
      const info: TaskInfo = { id: `task-${this.seq}`, cls, seq: this.seq++ };
      if (options.viewKey !== undefined && this.viewKey !== undefined && options.viewKey !== this.viewKey) {
        resolve(err('cancelled'));
        return;
      }
      const task: Task = {
        info,
        run,
        controller: new AbortController(),
        viewKey: options.viewKey,
        resolve: resolve as Task['resolve'],
      };
      const doomed = new Set(tasksToCancel([...this.running].map((t) => t.info), info));
      for (const t of this.running) {
        if (doomed.has(t.info.id)) {
          t.controller.abort();
        }
      }
      this.queue.push(task);
      this.pump();
    });
  }

  /** NFR-008: the view changed; tasks made for another view are cancelled (running) or dropped (queued). */
  setViewKey(key: string): void {
    this.viewKey = key;
    const stale = (t: Task): boolean => t.viewKey !== undefined && t.viewKey !== key;
    for (const t of this.running) {
      if (stale(t)) {
        t.controller.abort();
      }
    }
    const dropped = this.queue.filter(stale);
    this.queue = this.queue.filter((t) => !stale(t));
    for (const t of dropped) {
      t.resolve(err('cancelled'));
    }
  }

  setContext(patch: Partial<SchedulerContext>): void {
    this.context = { ...this.context, ...patch };
    this.pump();
  }

  private pump(): void {
    for (;;) {
      const runningPerClass = new Map<TaskClass, number>();
      for (const t of this.running) {
        runningPerClass.set(t.info.cls, (runningPerClass.get(t.info.cls) ?? 0) + 1);
      }
      const startable = this.queue.filter(
        (t) => (runningPerClass.get(t.info.cls) ?? 0) < TUNABLES.resources.schedulerMaxPerClass,
      );
      const next = pickNext(startable.map((t) => t.info), this.context);
      const task = next && startable.find((t) => t.info.id === next.id);
      if (!task) {
        return;
      }
      this.queue = this.queue.filter((t) => t !== task);
      this.start(task);
    }
  }

  private start(task: Task): void {
    this.running.add(task);
    const finish = (result: Result<unknown, 'cancelled'>): void => {
      this.running.delete(task);
      task.resolve(task.controller.signal.aborted ? err('cancelled') : result);
      this.pump();
    };
    void task.run(task.controller.signal).then(
      (value) => finish(ok(value)),
      () => finish(err('cancelled')),
    );
  }
}
