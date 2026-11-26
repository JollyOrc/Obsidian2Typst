import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // #182: Vitest's 5 s default timed out tests under load (measured
    // 2026-11-26: "Test timed out in 5000ms" in 4 files with three full runs
    // at once; us-031-grow-pdf at 4.7 s with two). The default checks how
    // busy the machine is, not the product: speeds the stories promise are
    // their own assertions (e.g. US-034 AC-11 under 2 s, US-007 AC-6 30 s).
    testTimeout: 30_000,
  },
});
