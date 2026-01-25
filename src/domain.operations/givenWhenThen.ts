import { UnexpectedCodePathError } from 'helpful-errors';

import { getTestRunner } from '@src/infra/isomorph.test/detectTestRunner';
import { globals } from '@src/infra/isomorph.test/getTestGlobals';

export const getNumberRange = (input: {
  start: number;
  end: number;
}): number[] => {
  // Calculate the length of the range
  const length = input.end - input.start + 1;
  // Create an array with the specified range
  return Array.from({ length }, (_, i) => input.start + i);
};

type TestContextShape = Record<string, any> | void;
type TestInputWithReason<TContext extends Record<string, any> | void> = [
  string,
  { because: string },
  (context: TContext) => Promise<void> | void,
];
type TestInputWithoutReason<TContext extends Record<string, any> | void> =
  | [string, (context: TContext) => Promise<void> | void]
  | [string];
type TestInput<TContext extends TestContextShape> =
  | TestInputWithReason<TContext>
  | TestInputWithoutReason<TContext>;
const castToTestInput = ({
  input,
  prefix,
}: {
  input: TestInput<void>;
  prefix: string;
}): [string, (() => Promise<unknown>) | ((cb: any) => void) | undefined] => {
  const method = input.length === 3 ? input[2] : input[1]; // its always last
  if (input.length === 3) return [`${prefix}: ${input[0]}`, method]; // we allow users to specify the reason for code readability, but we dont expose this in the test report to decrease noise. folks can look in the code if they want to know "why"
  return [`${prefix}: ${input[0]}`, method]; // otherwise, its the normal input
};

interface Describe {
  (desc: string, fn: () => void): void;

  /** Only runs the tests inside this `describe` for the current file */
  only: (desc: string, fn: () => void) => void;

  /** Skip the tests inside this `describe` for the current file */
  skip: (desc: string, fn: () => void) => void;

  /** Skip the tests inside this `describe` for the current file if the condition is satisfied */
  skipIf: (condition: boolean) => (desc: string, fn: () => void) => void;

  /** Runs the tests inside this `describe` for the current file only if the condition is satisfied */
  runIf: (condition: boolean) => (desc: string, fn: () => void) => void;

  /**
   * runs the describe block repeatedly to evaluate repeatability
   *
   * note
   * - uses `getAttempt()` function instead of direct `attempt` value
   * - describe callbacks run once at test registration time (not per retry)
   * - for SOME criteria, call `getAttempt()` inside test body to get retry count
   * - for EVERY criteria, `getAttempt()` returns the attempt number for that block
   *
   * @example
   * given.repeatably({ attempts: 3, criteria: 'EVERY' })('scene', ({ getAttempt }) => {
   *   then('test', () => {
   *     expect(getAttempt()).toBeLessThanOrEqual(3);
   *   });
   * });
   */
  repeatably: (configuration: {
    /**
     * how many attempts to run the describe block, repeatedly
     */
    attempts: number;

    /**
     * the criteria for the whole describe suite
     *
     * note
     * - EVERY = every attempt must pass for the suite to pass (default)
     * - SOME = some attempt must pass for the suite to pass
     */
    criteria?: 'EVERY' | 'SOME';
  }) => (
    desc: string,
    fn: (context: { getAttempt: () => number }) => void,
  ) => void;
}
interface Test {
  (...input: TestInput<void>): void;

  /** Only runs this test for the current file */
  only: (...input: TestInput<void>) => void;

  /** Skip this test */
  skip: (...input: TestInput<void>) => void;

  /** Marks the test as one that still needs to be written */
  todo: (...input: TestInput<void>) => void;

  /** Skip the test if the condition is satisfied */
  skipIf: (condition: boolean) => (...input: TestInput<void>) => void;

  /** Runs the test if the condition is satisfied */
  runIf: (condition: boolean) => (...input: TestInput<void>) => void;

  /** Runs the test repeatedly to evaluate repeatability */
  repeatably: (configuration: {
    /**
     * how many attempts to run the test, repeatedly
     */
    attempts: number;

    /**
     * the criteria for the whole test suite
     *
     * note
     * - EVERY = every test must pass for the suite to pass
     * - SOME = some test must pass for the suite to pass
     */
    criteria: 'EVERY' | 'SOME';
  }) => (
    ...input: TestInput<{ attempt: number; getAttempt: () => number }>
  ) => void;
}

/**
 * describe the scene (initial state or context) for a group of tests
 * @example
 * given('a dry plant', () => {
 *   when('water needs are checked', () => {
 *     then('it should return true', () => {
 *       expect(doesPlantNeedWater(plant)).toBe(true);
 *     });
 *   });
 * });
 */
export const given: Describe = (
  desc: string,
  fn: () => Promise<void> | void,
): void => {
  globals().describe(`given: ${desc}`, fn);
};
given.only = (desc: string, fn: () => void): void =>
  (globals().describe as any).only(`given: ${desc}`, fn);
given.skip = (desc: string, fn: () => void): void =>
  (globals().describe as any).skip(`given: ${desc}`, fn);
given.skipIf =
  (condition: boolean) =>
  (desc: string, fn: () => void): void =>
    condition ? given.skip(desc, fn) : given(desc, fn);
given.runIf = (condition: boolean) => given.skipIf(!condition);
given.repeatably =
  (configuration) =>
  (desc: string, fn: (context: { getAttempt: () => number }) => void): void => {
    const criteria = configuration.criteria ?? 'EVERY';

    // EVERY: create N describe blocks, all must pass
    if (criteria === 'EVERY') {
      for (const attempt of getNumberRange({
        start: 1,
        end: configuration.attempts,
      })) {
        given(`${desc}, attempt ${attempt}`, () =>
          fn({ getAttempt: () => attempt }),
        );
      }
      return;
    }

    // SOME: create one describe block, all tests inside will retry on failure
    // note: beforeAll/afterAll do NOT re-run on retry (framework limitation)
    // see: .agent/repo=.this/role=any/briefs/limitation.describe-block-retry-semantics.md
    if (criteria === 'SOME') {
      const runner = getTestRunner();
      const describeFn = globals().describe;

      // track attempts per test name (each test has its own retry counter)
      const attemptsByTest: Record<string, number> = {};
      const getAttempt = () => {
        const testName = expect.getState().currentTestName ?? '';
        return attemptsByTest[testName] ?? 0;
      };

      if (runner === 'jest') {
        describeFn(`given: ${desc}`, () => {
          jest.retryTimes(configuration.attempts, {
            logErrorsBeforeRetry: true,
          });
          globals().beforeEach(() => {
            const testName = expect.getState().currentTestName ?? '';
            attemptsByTest[testName] = (attemptsByTest[testName] ?? 0) + 1;
          });
          fn({ getAttempt });
        });
      }

      if (runner === 'vitest') {
        // vitest supports { retry: N } as second arg to describe
        (describeFn as any)(
          `given: ${desc}`,
          { retry: configuration.attempts },
          () => {
            globals().beforeEach(() => {
              const testName =
                (expect as any).getState?.().currentTestName ?? '';
              attemptsByTest[testName] = (attemptsByTest[testName] ?? 0) + 1;
            });
            fn({ getAttempt });
          },
        );
      }

      return;
    }

    throw new UnexpectedCodePathError(
      'configuration.criteria was neither EVERY nor SOME',
      { configuration },
    );
  };

/**
 * describe the event (action or trigger) that occurs within a scene
 * @example
 * when('the user clicks submit', () => {
 *   then('the form should be submitted', () => {
 *     expect(form.submitted).toBe(true);
 *   });
 * });
 */
export const when: Describe = (
  desc: string,
  fn: () => Promise<void> | void,
): void => {
  globals().describe(`when: ${desc}`, fn);
};
when.only = (desc: string, fn: () => void): void =>
  (globals().describe as any).only(`when: ${desc}`, fn);
when.skip = (desc: string, fn: () => void): void =>
  (globals().describe as any).skip(`when: ${desc}`, fn);
when.skipIf =
  (condition: boolean) =>
  (desc: string, fn: () => void): void =>
    condition ? when.skip(desc, fn) : when(desc, fn);
when.runIf = (condition: boolean) => when.skipIf(!condition);
when.repeatably =
  (configuration) =>
  (desc: string, fn: (context: { getAttempt: () => number }) => void): void => {
    const criteria = configuration.criteria ?? 'EVERY';

    // EVERY: create N describe blocks, all must pass
    if (criteria === 'EVERY') {
      for (const attempt of getNumberRange({
        start: 1,
        end: configuration.attempts,
      })) {
        when(`${desc}, attempt ${attempt}`, () =>
          fn({ getAttempt: () => attempt }),
        );
      }
      return;
    }

    // SOME: create one describe block, all tests inside will retry on failure
    // note: beforeAll/afterAll do NOT re-run on retry (framework limitation)
    // see: .agent/repo=.this/role=any/briefs/limitation.describe-block-retry-semantics.md
    if (criteria === 'SOME') {
      const runner = getTestRunner();
      const describeFn = globals().describe;

      // track attempts per test name (each test has its own retry counter)
      const attemptsByTest: Record<string, number> = {};
      const getAttempt = () => {
        const testName = expect.getState().currentTestName ?? '';
        return attemptsByTest[testName] ?? 0;
      };

      if (runner === 'jest') {
        describeFn(`when: ${desc}`, () => {
          jest.retryTimes(configuration.attempts, {
            logErrorsBeforeRetry: true,
          });
          globals().beforeEach(() => {
            const testName = expect.getState().currentTestName ?? '';
            attemptsByTest[testName] = (attemptsByTest[testName] ?? 0) + 1;
          });
          fn({ getAttempt });
        });
      }

      if (runner === 'vitest') {
        // vitest supports { retry: N } as second arg to describe
        (describeFn as any)(
          `when: ${desc}`,
          { retry: configuration.attempts },
          () => {
            globals().beforeEach(() => {
              const testName =
                (expect as any).getState?.().currentTestName ?? '';
              attemptsByTest[testName] = (attemptsByTest[testName] ?? 0) + 1;
            });
            fn({ getAttempt });
          },
        );
      }

      return;
    }

    throw new UnexpectedCodePathError(
      'configuration.criteria was neither EVERY nor SOME',
      { configuration },
    );
  };

/**
 * assert the effect (expected outcome) that should be observed
 * @example
 * then('it should return the correct value', () => {
 *   expect(result).toBe(expected);
 * });
 */
const then: Test = ((...input: TestInput<void>): void => {
  globals().test(...castToTestInput({ input, prefix: 'then' }));
}) as Test;

// add methods to then
then.only = (...input: TestInput<void>): void =>
  (globals().test as any).only(...castToTestInput({ input, prefix: 'then' }));
then.skip = (...input: TestInput<void>): void =>
  (globals().test as any).skip(...castToTestInput({ input, prefix: 'then' }));
then.todo = (...input: TestInput<void>): void =>
  (globals().test as any).todo(
    castToTestInput({ input: [input[0]], prefix: 'then' })[0],
  );
then.skipIf =
  (condition: boolean) =>
  (...input: TestInput<void>): void =>
    condition ? then.skip(...input) : then(...input);
then.runIf = (condition: boolean) => then.skipIf(!condition);
then.repeatably =
  (configuration) =>
  (
    ...input: TestInput<{ attempt: number; getAttempt: () => number }>
  ): void => {
    if (input.length !== 2 && input.length !== 3)
      throw new UnexpectedCodePathError('unsupported input length', { input });

    if (configuration.criteria === 'SOME') {
      const runner = getTestRunner();
      const testFn = globals().test;
      let attempt = 0;
      globals().beforeEach(() => attempt++);
      const getAttempt = () => attempt;
      const [name, fn] = castToTestInput({
        input:
          input.length === 2
            ? [input[0], () => input[1]({ attempt, getAttempt })]
            : [input[0], input[1], () => input[2]({ attempt, getAttempt })],
        prefix: 'then',
      });
      if (runner === 'jest') {
        jest.retryTimes(configuration.attempts, { logErrorsBeforeRetry: true });
        testFn(name, fn);
      }
      if (runner === 'vitest') {
        (testFn as any)(name, { retry: configuration.attempts }, fn);
      }
      return;
    }

    if (configuration.criteria === 'EVERY') {
      for (const attempt of getNumberRange({
        start: 1,
        end: configuration.attempts,
      })) {
        const getAttempt = () => attempt;
        if (input.length === 2)
          then(input[0] + `, attempt ${attempt}`, () =>
            input[1]({ attempt, getAttempt }),
          );
        if (input.length === 3)
          then(input[0] + `, attempt ${attempt}`, input[1], () =>
            input[2]({ attempt, getAttempt }),
          );
      }
      return;
    }

    throw new UnexpectedCodePathError(
      'configuration.criteria was neither EVERY nor SOME',
      { configuration },
    );
  };

/**
 * .what = namespace object for BDD-style test helpers
 * .why = provides vitest-compatible access to given/when/then via `bdd.then()`
 *        since direct `then` export triggers ESM thenable detection in vitest.
 *
 * @see .agent/repo=.this/role=any/briefs/limitation.esm-thenable-then-export.md
 */
export const bdd = { given, when, then };

/**
 * .what = wraps `then` to handle vitest's thenable detection
 * .why = vitest calls `then(resolve, reject)` on module import; we detect and resolve it
 *
 * @see .agent/repo=.this/role=any/briefs/limitation.esm-thenable-then-export.md
 */
const thenExportable: Test = ((...input: TestInput<void>): any => {
  // vitest treats modules with `then` as thenables and calls then(resolve, reject)
  if (typeof input[0] === 'function') {
    // resolve with exports that don't have a callable `then` (to break thenable cycle)
    (input[0] as (v: unknown) => void)({ given, when, bdd, getNumberRange });
    return;
  }
  then(...input);
}) as Test;
thenExportable.only = then.only;
thenExportable.skip = then.skip;
thenExportable.todo = then.todo;
thenExportable.skipIf = then.skipIf;
thenExportable.runIf = then.runIf;
thenExportable.repeatably = then.repeatably;

export { thenExportable as then };
