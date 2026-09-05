import { UnexpectedCodePathError } from 'helpful-errors';

/**
 * .what = the test runner currently executing the code
 * .why = enables isomorphic behavior between vitest and jest
 */
export type TestRunner = 'vitest' | 'jest';

/**
 * .what = reads which test runner is executing, or null where none is
 * .why = two callers need the same detection with OPPOSITE dispositions on absence:
 *        an isomorphic api shim must fail fast, while the unhooked notice must stay
 *        SILENT — a cli or a tsx one-off has no runner config to name, so a thrown
 *        error there would break a caller who did nothing wrong
 *
 * .note = this is the ONE place the two env keys are read. a second copy of these
 *         two lines is a second source of truth for "what is a runner", and the two
 *         would drift the day a third runner appears
 *
 * .note = vitest is checked first as it's more specific
 */
export const getOneTestRunner = (): TestRunner | null => {
  // check for vitest first (more specific)
  // ref: https://vitest.dev/config/
  // > "Use `process.env.VITEST` ... to conditionally apply different configuration"
  if (process.env.VITEST !== undefined) return 'vitest';

  // check for jest
  // ref: https://jestjs.io/docs/environment-variables
  // > "JEST_WORKER_ID ... Each worker process is assigned a unique id"
  if (process.env.JEST_WORKER_ID !== undefined) return 'jest';

  return null;
};

/**
 * .what = detects which test runner is currently executing
 * .why = enables runtime selection of test framework apis
 *
 * @throws UnexpectedCodePathError when no runner is in play
 */
export const detectTestRunner = (): TestRunner =>
  getOneTestRunner() ??
  UnexpectedCodePathError.throw(
    'detectTestRunner: no test runner detected. expected VITEST or JEST_WORKER_ID env var',
    {
      env: {
        VITEST: process.env.VITEST,
        JEST_WORKER_ID: process.env.JEST_WORKER_ID,
      },
    },
  );

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
