import { build } from 'esbuild';

/**
 * Production bundle of the API: ONE ES module (`dist/main.mjs`) that plain Node
 * can run. `tsc` output cannot: the workspace package @hares/contract exports
 * TypeScript source, so it is compiled INTO the bundle here (alias below).
 * Everything else under node_modules stays an installed package (`packages:
 * external`): Nest and Prisma load files by path, bcrypt is native, and the
 * regex validator resolves `redos-detector` by path for its worker threads.
 *
 * Decorator metadata is not emitted by esbuild; the code never relies on it
 * (every injected constructor parameter has an explicit @Inject, see decision 36),
 * the same as under tsx in development.
 */
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  packages: 'external',
  alias: { '@hares/contract': '../contract/src/index.ts' },
  tsconfig: 'tsconfig.json',
  logLevel: 'info',
});
