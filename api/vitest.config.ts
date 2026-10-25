import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the API package.
 *
 * `@hares/contract` exposes its TypeScript source (not pre-built JS), so we
 * force Vite/Vitest to inline and transform it here instead of externalising it
 * from node_modules.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    // Integration suites do several bcrypt-12 hashes per test (about 250 ms each).
    testTimeout: 30_000,
    // Integration suites send a synthetic X-Forwarded-For per suite, so each
    // has its own login-throttle counters (see src/test/http-test-app.ts).
    env: { TRUST_PROXY: 'loopback' },
  },
  server: {
    deps: {
      inline: ['@hares/contract'],
    },
  },
});
