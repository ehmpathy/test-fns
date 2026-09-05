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
    setupFiles: ['./src/contract/vitest.setup.ts'],

    // reclaim every temp dir this run makes, at the end of this run
    // .note = ONE key. vitest reads setup + teardown from one module, so the
    //         half-wired state jest can reach is unreachable here
    globalSetup: ['./src/contract/autoprune.setup.vitest.ts'],
    include: [
      '**/*.vitest.test.ts',
      '**/*.vitest.globals.test.ts', // globals path tests
    ],
    exclude: [
      '**/node_modules/**',
      '**/.yalc/**',
      '**/*.acceptance.vitest.test.ts',
      '**/*.integration.vitest.test.ts',
      '**/*.vitest.bdd.test.ts', // runs via vitest.unit.bdd.config.ts (no globals)
    ],
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, './src'),
    },
  },
});
