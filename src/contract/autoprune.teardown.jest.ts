// .note = 🔴 RELATIVE, never the `@src` alias — with `autoprune.setup.jest.ts`, the
//         ONLY two files in this repo where the alias is wrong. jest's
//         `moduleNameMapper` is a TEST-RUNTIME mapper: it maps only the imports jest's
//         own runtime pulls in, and a `globalTeardown` module is loaded by node's plain
//         `require` BEFORE that runtime exists. so `@src` here fails with
//         `Cannot find module` and kills every run at startup.
//
//         `autoprune.setup.vitest.ts` DOES use `@src`, and the asymmetry is real
//         rather than an oversight: vite aliases at the LOADER, so its alias covers
//         vitest's `globalSetup` too. one runner maps at runtime, one at load.
//
//         the constraint is TRANSITIVE: every module reachable from this one must
//         also import relative, which is why the autoprune core carries the same note
import { teardownAutoprune } from './../domain.operations/genTempDir/autoprune/teardownAutoprune';

/**
 * .what = jest globalTeardown — reclaims exactly the dirs this run's id stamps
 * .why = it runs ONCE, in the main process, after every test file. a test filter
 *        cannot deselect it and a zero-match scope cannot skip it, because it is
 *        config rather than a test — which is what an afterAll hook could not offer
 *
 * .note = jest AWAITS this before `--forceExit` fires its exit(code)
 *         (@jest/core build/index.js:3464, the exit at jest-cli:719), so the
 *         reclaim is safe here — PROVIDED it is awaited all the way down. a
 *         fire-and-forget reclaim would be killed mid-rmSync the instant this
 *         promise resolves
 *
 * @example
 * // jest.config.ts
 * export default {
 *   globalSetup: 'test-fns/autoprune.setup.jest',
 *   globalTeardown: 'test-fns/autoprune.teardown.jest',
 * };
 */
// biome-ignore lint/style/noDefaultExport: jest globalTeardown api requires default export
export default async (): Promise<void> => {
  // declare the runner: this hook runs in the MAIN process, where JEST_WORKER_ID
  // is unset, so env detection alone would report 'unknown' from the one place
  // that most needs to name it
  await teardownAutoprune({ runner: 'jest' });
};
