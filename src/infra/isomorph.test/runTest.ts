import { getTestRunner } from './detectTestRunner';
import { globals } from './getTestGlobals';

/**
 * .what = options for test execution
 * .why = enables runner-agnostic retry configuration
 */
export interface TestOptions {
  retry?: number;
}

/**
 * .what = unified test execution with retry support
 * .why = jest and vitest have different retry mechanisms
 *
 * .note = jest uses jest.retryTimes(n) before test()
 *         vitest uses test(name, { retry: n }, fn)
 */
export const runTest = (input: {
  name: string;
  fn: (() => void) | (() => Promise<void>);
  options?: TestOptions;
}): void => {
  const runner = getTestRunner();
  const { name, fn, options } = input;
  const { test } = globals();

  // vitest with retry: pass retry as per-test option
  if (runner === 'vitest' && options?.retry) {
    (test as any)(name, { retry: options.retry }, fn);
    return;
  }

  // jest with retry: use jest.retryTimes before test call
  if (runner === 'jest' && options?.retry) {
    jest.retryTimes(options.retry, { logErrorsBeforeRetry: true });
    test(name, fn);
    return;
  }

  // no retry: standard test call
  test(name, fn);
};

/**
 * .what = run test with .only modifier
 * .why = enables focused test execution in both runners
 */
export const runTestOnly = (input: {
  name: string;
  fn: (() => void) | (() => Promise<void>);
  options?: TestOptions;
}): void => {
  const runner = getTestRunner();
  const { name, fn, options } = input;
  const { test } = globals();

  // vitest with retry
  if (runner === 'vitest' && options?.retry) {
    (test.only as any)(name, { retry: options.retry }, fn);
    return;
  }

  // jest with retry
  if (runner === 'jest' && options?.retry) {
    jest.retryTimes(options.retry, { logErrorsBeforeRetry: true });
    test.only(name, fn);
    return;
  }

  // no retry
  test.only(name, fn);
};

/**
 * .what = run test with .skip modifier
 * .why = enables skipped test declaration in both runners
 */
export const runTestSkip = (input: {
  name: string;
  fn?: (() => void) | (() => Promise<void>);
}): void => {
  const { test } = globals();
  const { name, fn } = input;

  if (fn) {
    test.skip(name, fn);
  } else {
    test.skip(name, () => {});
  }
};

/**
 * .what = run test with .todo modifier
 * .why = enables todo test declaration in both runners
 */
export const runTestTodo = (input: { name: string }): void => {
  const { test } = globals();
  test.todo(input.name);
};
