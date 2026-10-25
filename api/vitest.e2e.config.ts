import { defineConfig } from 'vitest/config';

/**
 * End-to-end suite: starts the real API process (not the Nest test harness) and
 * drives it over HTTP. It reuses the per-run throwaway database from
 * src/test/global-setup.ts. Run with `pnpm --filter api e2e`.
 */
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    environment: 'node',
    globalSetup: ['src/test/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
  server: { deps: { inline: ['@hares/contract'] } },
});
