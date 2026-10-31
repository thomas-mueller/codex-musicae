/**
 * core/scheduler — priority rules of the work scheduler. Requirements: NFR-003, DET-017.
 * Priority order (highest first): input > visible > prefetch > save > detection.
 */

export type TaskClass = 'input' | 'visible' | 'prefetch' | 'save' | 'detection';

export interface TaskInfo {
  readonly id: string;
  readonly cls: TaskClass;
  /** Submission order; smaller = submitted earlier. */
  readonly seq: number;
}

export interface SchedulerContext {
  /** The user touched, scrolled, typed or drew within the idle window (DET-017). */
  readonly userActive: boolean;
  /** The app/page is hidden. */
  readonly hidden: boolean;
  /** true = battery saver on, false = off, null = not detectable. */
  readonly batterySaver: boolean | null;
  /** A stroke is being drawn (SAV-008). */
  readonly strokeInProgress: boolean;
}

/** Lower number = higher priority. */
export const TASK_PRIORITY: Readonly<Record<TaskClass, number>> = {
  input: 0,
  visible: 1,
  prefetch: 2,
  save: 3,
  detection: 4,
};

function isEligible(task: TaskInfo, ctx: SchedulerContext): boolean {
  switch (task.cls) {
    case 'detection':
      return !ctx.userActive && !ctx.hidden && ctx.batterySaver !== true;
    case 'prefetch':
      return !ctx.hidden;
    case 'save':
      return !ctx.strokeInProgress;
    default:
      return true;
  }
}

/**
 * Next task to start, or null.
 * Eligibility: 'detection' is not eligible while userActive, hidden or batterySaver === true;
 * 'prefetch' is not eligible while hidden; 'save' is not eligible while strokeInProgress;
 * 'input' and 'visible' are always eligible.
 * Among eligible tasks: lowest TASK_PRIORITY number first, ties by smaller seq.
 */
export function pickNext(queue: readonly TaskInfo[], ctx: SchedulerContext): TaskInfo | null {
  let best: TaskInfo | null = null;
  for (const task of queue) {
    if (!isEligible(task, ctx)) {
      continue;
    }
    if (
      best === null ||
      TASK_PRIORITY[task.cls] < TASK_PRIORITY[best.cls] ||
      (task.cls === best.cls && task.seq < best.seq)
    ) {
      best = task;
    }
  }
  return best;
}

/**
 * Ids of RUNNING tasks to cancel when `incoming` arrives: if incoming.cls is 'input' or 'visible',
 * every running task of class 'prefetch' or 'detection' (in running order); otherwise none.
 */
export function tasksToCancel(running: readonly TaskInfo[], incoming: TaskInfo): string[] {
  if (incoming.cls !== 'input' && incoming.cls !== 'visible') {
    return [];
  }
  return running.filter((t) => t.cls === 'prefetch' || t.cls === 'detection').map((t) => t.id);
}
