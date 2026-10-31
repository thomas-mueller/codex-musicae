import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { CLOCK } from './clock';
import { ResourceGovernor } from './resource-governor';
import { FakeClock } from './testing/fake-clock';

const R = TUNABLES.resources;

describe('ResourceGovernor', () => {
  let clock: FakeClock;
  let governor: ResourceGovernor;
  beforeEach(() => {
    clock = new FakeClock();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    governor = TestBed.inject(ResourceGovernor);
  });

  it('NFR-010 starts at level 0 with prefetch and full resolution', () => {
    expect(governor.level()).toBe(0);
    expect(governor.prefetchNeighbors()).toBe(R.prefetchNeighbors);
    expect(governor.renderScaleFactor()).toBe(1);
  });

  it('NFR-010 a failure drops prefetch first', () => {
    governor.reportFailure();
    expect(governor.level()).toBe(1);
    expect(governor.prefetchNeighbors()).toBe(0);
    expect(governor.renderScaleFactor()).toBe(1);
  });

  it('NFR-010 the second step lowers the render resolution', () => {
    governor.reportFailure();
    clock.advance(R.governorEscalateCooldownMs);
    governor.reportFailure();
    expect(governor.level()).toBe(2);
    expect(governor.renderScaleFactor()).toBe(R.governorLowResFactor);
  });

  it('NFR-010 failures inside the cooldown do not escalate again', () => {
    governor.reportFailure();
    clock.advance(R.governorEscalateCooldownMs - 1);
    governor.reportFailure();
    expect(governor.level()).toBe(1);
  });

  it('NFR-010 escalation stops at the maximum level', () => {
    for (let i = 0; i < R.governorMaxLevel + 2; i++) {
      governor.reportFailure();
      clock.advance(R.governorEscalateCooldownMs);
    }
    expect(governor.level()).toBe(R.governorMaxLevel);
  });

  it('NFR-010 steps down one level per quiet period', () => {
    governor.reportFailure();
    clock.advance(R.governorEscalateCooldownMs);
    governor.reportFailure();
    expect(governor.level()).toBe(2);
    clock.advance(R.governorRecoverMs);
    expect(governor.level()).toBe(1);
    clock.advance(R.governorRecoverMs);
    expect(governor.level()).toBe(0);
  });

  it('NFR-010 a new failure restarts the quiet period', () => {
    governor.reportFailure();
    clock.advance(R.governorRecoverMs - 1);
    governor.reportFailure();
    expect(governor.level()).toBe(2);
    clock.advance(R.governorRecoverMs - 1);
    expect(governor.level()).toBe(2);
    clock.advance(1);
    expect(governor.level()).toBe(1);
  });
});
