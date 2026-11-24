import { defineConfig } from 'vitest/config';

import { TUNABLES } from './src/config/tunables';

export default defineConfig({
  test: {
    testTimeout: TUNABLES.testing.unitTestTimeoutMs,
    hookTimeout: TUNABLES.testing.unitTestTimeoutMs,
  },
});
