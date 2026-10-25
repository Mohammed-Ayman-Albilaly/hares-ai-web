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
  },
  server: {
    deps: {
      inline: ['@hares/contract'],
    },
  },
});
