import { UnexpectedCodePathError } from 'helpful-errors';

/**
 * .what = the test runner currently executing the code
 * .why = enables isomorphic behavior between vitest and jest
 */
export type TestRunner = 'vitest' | 'jest';

/**
 * .what = detects which test runner is currently executing
 * .why = enables runtime selection of test framework apis
 *
 * .note = vitest is checked first as it's more specific
 */
export const detectTestRunner = (): TestRunner => {
  // check for vitest first (more specific)
  // ref: https://vitest.dev/config/
  // > "Use `process.env.VITEST` ... to conditionally apply different configuration"
  if (process.env.VITEST !== undefined) return 'vitest';

  // check for jest
  // ref: https://jestjs.io/docs/environment-variables
  // > "JEST_WORKER_ID ... Each worker process is assigned a unique id"
  if (process.env.JEST_WORKER_ID !== undefined) return 'jest';

  // fail fast if neither detected
  throw new UnexpectedCodePathError(
    'detectTestRunner: no test runner detected. expected VITEST or JEST_WORKER_ID env var',
    {
      env: {
        VITEST: process.env.VITEST,
        JEST_WORKER_ID: process.env.JEST_WORKER_ID,
      },
    },
  );
};

/**
 * .what = cached test runner detection
 * .why = avoids repeated env var checks
 */
let runnerCached: TestRunner | undefined;
export const getTestRunner = (): TestRunner => {
  if (runnerCached === undefined) runnerCached = detectTestRunner();
  return runnerCached;
};

/**
 * .what = resets the cached runner (for testing only)
 * .why = allows tests to verify detection logic with different env states
 */
export const resetTestRunnerCache = (): void => {
  runnerCached = undefined;
};
