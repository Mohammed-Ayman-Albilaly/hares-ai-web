import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * In development the SPA runs on :1420 (the API's default CORS origin) and
 * proxies /api to the API on :3000, so the browser sees ONE origin exactly as
 * it will behind the reverse proxy in production (decision 27): the SameSite
 * refresh cookie and the Origin check work without special cases.
 */
// Where /api goes. The browser end-to-end run (e2e/run.ts) points it at its own API.
const apiTarget = process.env.API_URL ?? 'http://localhost:3000';
const proxy = { '/api': { target: apiTarget, changeOrigin: false } };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    // The chart library (ECharts, ~200 kB gzipped) is its own chunk, loaded only by the dashboard screens;
    // the app chunk holds React, the router, forms, zod and both language files.
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 1420,
    strictPort: true,
    proxy,
  },
  preview: { proxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
