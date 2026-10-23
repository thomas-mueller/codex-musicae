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

/**
 * Next task to start, or null.
 * Eligibility: 'detection' is not eligible while userActive, hidden or batterySaver === true;
 * 'prefetch' is not eligible while hidden; 'save' is not eligible while strokeInProgress;
 * 'input' and 'visible' are always eligible.
 * Among eligible tasks: lowest TASK_PRIORITY number first, ties by smaller seq.
 */
export function pickNext(_queue: readonly TaskInfo[], _ctx: SchedulerContext): TaskInfo | null {
  throw new Error('not implemented');
}

/**
 * Ids of RUNNING tasks to cancel when `incoming` arrives: if incoming.cls is 'input' or 'visible',
 * every running task of class 'prefetch' or 'detection' (in running order); otherwise none.
 */
export function tasksToCancel(_running: readonly TaskInfo[], _incoming: TaskInfo): string[] {
  throw new Error('not implemented');
}
