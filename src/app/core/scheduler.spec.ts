import { describe, expect, it } from 'vitest';

import { pickNext, TASK_PRIORITY, tasksToCancel } from './scheduler';
import { pickNextCases, tasksToCancelCases } from './fixtures/scheduler.cases';
import { caseTitle } from '../../testing/expect-close-deep';

describe('TASK_PRIORITY', () => {
  it('NFR-003 ranks input > visible > prefetch > save > detection', () => {
    const p = TASK_PRIORITY;
    expect(p.input).toBeLessThan(p.visible);
    expect(p.visible).toBeLessThan(p.prefetch);
    expect(p.prefetch).toBeLessThan(p.save);
    expect(p.save).toBeLessThan(p.detection);
  });
});

describe('pickNext', () => {
  for (const c of pickNextCases) {
    it(caseTitle(c, 'NFR-003'), () => {
      expect(pickNext(c.queue, c.ctx)).toEqual(c.expected);
    });
  }
});

describe('tasksToCancel', () => {
  for (const c of tasksToCancelCases) {
    it(caseTitle(c, 'NFR-003'), () => {
      expect(tasksToCancel(c.running, c.incoming)).toEqual(c.expected);
    });
  }
});
