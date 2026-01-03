import { defineConfig } from 'vitest/config';
import path from 'node:path';

// ensure tests run in utc, like they will on cicd and on server
process.env.TZ = 'UTC';

// ensure tests run like on local machines, so snapshots are equal on local && cicd
process.env.FORCE_COLOR = 'true';

export default defineConfig({
  test: {
    globals: true, // inject describe/test/etc into globalThis for library detection
    environment: 'node',
    include: ['**/*.integration.vitest.test.ts'],
    exclude: ['**/node_modules/**', '**/.yalc/**'],
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, './src'),
    },
  },
});
