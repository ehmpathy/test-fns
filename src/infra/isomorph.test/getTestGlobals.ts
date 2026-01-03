import { UnexpectedCodePathError } from 'helpful-errors';
import type {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  test,
} from 'vitest';

import { getTestRunner } from './detectTestRunner';

/**
 * .what = unified interface for test framework functions
 * .why = abstracts away differences between jest and vitest modules
 */
export interface TestGlobals {
  describe: typeof describe;
  test: typeof test;
  beforeAll: typeof beforeAll;
  beforeEach: typeof beforeEach;
  afterAll: typeof afterAll;
  afterEach: typeof afterEach;
}

/**
 * .what = cached globals instance
 * .why = avoids repeated require() calls
 */
let cachedGlobals: TestGlobals | undefined;

/**
 * .what = synchronously requires test functions from the active runner
 * .why = test registration must be synchronous (describe/test called at module load)
 */
export const getTestGlobals = (): TestGlobals => {
  if (cachedGlobals) return cachedGlobals;

  const runner = getTestRunner();

  // both jest and vitest inject globals into globalThis by default
  const g = globalThis as any;

  // fail fast if globals are not available
  if (typeof g.describe !== 'function')
    throw new UnexpectedCodePathError(
      `test globals not found for runner '${runner}'. ` +
        (runner === 'vitest'
          ? 'ensure vitest.config.ts has `globals: true` set in test options'
          : 'ensure jest globals are available'),
      { runner, hasDescribe: typeof g.describe, hasTest: typeof g.test },
    );

  cachedGlobals = {
    describe: g.describe,
    test: g.test,
    beforeAll: g.beforeAll,
    beforeEach: g.beforeEach,
    afterAll: g.afterAll,
    afterEach: g.afterEach,
  };
  return cachedGlobals;
};

/**
 * .what = accessor for cached test globals
 * .why = provides convenient access without explicit initialization
 */
export const globals = (): TestGlobals => {
  if (!cachedGlobals) cachedGlobals = getTestGlobals();
  return cachedGlobals;
};

/**
 * .what = resets the cached globals (for testing only)
 * .why = allows tests to verify loading logic
 */
export const resetTestGlobalsCache = (): void => {
  cachedGlobals = undefined;
};
