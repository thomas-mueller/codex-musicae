import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION } from '../app/core/metadata';
import { TUNABLES } from '../config/tunables';

describe('embedded schema version', () => {
  it('SAV-002 SAV-015 the tunable and the version the metadata code writes are the same', () => {
    expect(TUNABLES.saving.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});
