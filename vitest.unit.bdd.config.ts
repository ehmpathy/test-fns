/**
 * .what = vitest config WITHOUT globals setup
 * .why = proves bdd namespace works independently of vitest.setup.ts
 */
import { defineConfig } from 'vitest/config';
import path from 'node:path';

process.env.TZ = 'UTC';
process.env.FORCE_COLOR = 'true';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // NOTE: no setupFiles - proves bdd namespace works without globals
    include: ['**/*.vitest.bdd.test.ts'],

    // reclaim every temp dir this run makes, at the end of this run
    // .note = ONE key. vitest reads setup + teardown from one module, so the
    //         half-wired state jest can reach is unreachable here
    globalSetup: ['./src/contract/autoprune.setup.vitest.ts'],
    exclude: ['**/node_modules/**', '**/.yalc/**'],
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, './src'),
    },
  },
});
