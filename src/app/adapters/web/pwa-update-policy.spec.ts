import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SwUpdate } from '@angular/service-worker';

import { PwaUpdatePolicy } from './pwa-update-policy';

describe('PwaUpdatePolicy', () => {
  const checkForUpdate = vi.fn();
  const activateUpdate = vi.fn();

  beforeEach(() => {
    checkForUpdate.mockReset();
    activateUpdate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        PwaUpdatePolicy,
        { provide: SwUpdate, useValue: { isEnabled: true, checkForUpdate, activateUpdate } },
      ],
    });
  });

  it('PLT-009 checks for updates without activating or reloading', async () => {
    checkForUpdate.mockResolvedValue(true);
    await TestBed.inject(PwaUpdatePolicy).checkAtStartup();

    expect(checkForUpdate).toHaveBeenCalledOnce();
    expect(activateUpdate).not.toHaveBeenCalled();
  });

  it('PLT-009 ignores update-check failures during startup', async () => {
    checkForUpdate.mockRejectedValue(new Error('offline'));

    await expect(TestBed.inject(PwaUpdatePolicy).checkAtStartup()).resolves.toBeUndefined();
    expect(activateUpdate).not.toHaveBeenCalled();
  });
});
