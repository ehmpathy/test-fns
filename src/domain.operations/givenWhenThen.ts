import { UnexpectedCodePathError } from 'helpful-errors';

import { getTestRunner } from '@src/infra/isomorph.test/detectTestRunner';
import { globals } from '@src/infra/isomorph.test/getTestGlobals';

import {
  getCurrentRepeatableContext,
  getDescribePath,
  type RepeatableState,
  registryDescribeRepeatable,
  setCurrentRepeatableContext,
  wrapDescribeCallback,
} from './registryDescribeRepeatable';

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

/**
 * .what = type helper to forbid async callbacks
 * .why = async describe callbacks break describeStack registration (stack pops before async body runs)
 */
type SyncCallback<F> = F extends () => Promise<any> ? never : F;

interface Describe {
  <F extends () => void>(desc: string, fn: SyncCallback<F>): void;

  /** Only runs the tests inside this `describe` for the current file */
  only: <F extends () => void>(desc: string, fn: SyncCallback<F>) => void;

  /** Skip the tests inside this `describe` for the current file */
  skip: <F extends () => void>(desc: string, fn: SyncCallback<F>) => void;

  /** Skip the tests inside this `describe` for the current file if the condition is satisfied */
  skipIf: (
    condition: boolean,
  ) => <F extends () => void>(desc: string, fn: SyncCallback<F>) => void;

  /** Runs the tests inside this `describe` for the current file only if the condition is satisfied */
  runIf: (
    condition: boolean,
  ) => <F extends () => void>(desc: string, fn: SyncCallback<F>) => void;

  /**
   * runs the describe block repeatedly to evaluate repeatability
   *
   * note
   * - provides `attempt` as direct value (fixed at registration time per describe block)
   * - for EVERY: N describe blocks registered, all must pass
   * - for SOME: N describe blocks registered, subsequent attempts skipped on success
   *
   * @example
   * given.repeatably({ attempts: 3, criteria: 'SOME' })('scene', ({ attempt }) => {
   *   then('test', () => {
   *     expect(attempt).toBeLessThanOrEqual(3);
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
     * - SOME = some attempt must pass for the suite to pass (skips subsequent on success)
     */
    criteria?: 'EVERY' | 'SOME';
  }) => <F extends (context: { attempt: number }) => void>(
    desc: string,
    fn: SyncCallback<F>,
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
  }) => (...input: TestInput<{ attempt: number }>) => void;
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
export const given: Describe = (<F extends () => void>(
  desc: string,
  fn: SyncCallback<F>,
): void => {
  const name = `given: ${desc}`;
  globals().describe(
    name,
    wrapDescribeCallback({ name, fn: fn as () => void }),
  );
}) as Describe;
given.only = <F extends () => void>(
  desc: string,
  fn: SyncCallback<F>,
): void => {
  const name = `given: ${desc}`;
  (globals().describe as any).only(
    name,
    wrapDescribeCallback({ name, fn: fn as () => void }),
  );
};
given.skip = <F extends () => void>(
  desc: string,
  fn: SyncCallback<F>,
): void => {
  const name = `given: ${desc}`;
  (globals().describe as any).skip(
    name,
    wrapDescribeCallback({ name, fn: fn as () => void }),
  );
};
given.skipIf =
  (condition: boolean) =>
  <F extends () => void>(desc: string, fn: SyncCallback<F>): void =>
    condition ? given.skip(desc, fn) : given(desc, fn);
given.runIf = (condition: boolean) => given.skipIf(!condition);
given.repeatably =
  (configuration) =>
  <F extends (context: { attempt: number }) => void>(
    desc: string,
    fn: SyncCallback<F>,
  ): void => {
    const criteria = configuration.criteria ?? 'EVERY';

    // EVERY: create N describe blocks, all must pass
    if (criteria === 'EVERY') {
      for (const attempt of getNumberRange({
        start: 1,
        end: configuration.attempts,
      })) {
        given(`${desc}, attempt ${attempt}`, () =>
          (fn as (context: { attempt: number }) => void)({ attempt }),
        );
      }
      return;
    }

    // SOME: create N describe blocks, skip subsequent on success
    if (criteria === 'SOME') {
      // shared state across all attempts (mutable, scoped to this repeatably block)
      const state: RepeatableState = {
        criteria: 'SOME',
        anyAttemptPassed: false,
        thisAttemptFailed: false,
      };

      for (const attempt of getNumberRange({
        start: 1,
        end: configuration.attempts,
      })) {
        given(`${desc}, attempt ${attempt}`, () => {
          // register state by current path (explicit key, direct reference)
          const path = getDescribePath();
          registryDescribeRepeatable.set(path, state);

          // reset failure flag at start of this attempt's execution (not registration)
          globals().beforeAll(() => {
            state.thisAttemptFailed = false;
          });

          // mark success after attempt completes without failures
          globals().afterAll(() => {
            if (!state.thisAttemptFailed && !state.anyAttemptPassed) {
              state.anyAttemptPassed = true;
            }
          });

          // set context for nested when/then to capture (survives vitest deferred callbacks)
          setCurrentRepeatableContext(state);
          try {
            // invoke user callback (registers useBeforeAll, when, then, etc)
            (fn as (context: { attempt: number }) => void)({ attempt });
          } finally {
            setCurrentRepeatableContext(null);
          }
        });
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
export const when: Describe = (<F extends () => void>(
  desc: string,
  fn: SyncCallback<F>,
): void => {
  const name = `when: ${desc}`;
  globals().describe(
    name,
    wrapDescribeCallback({ name, fn: fn as () => void }),
  );
}) as Describe;
when.only = <F extends () => void>(desc: string, fn: SyncCallback<F>): void => {
  const name = `when: ${desc}`;
  (globals().describe as any).only(
    name,
    wrapDescribeCallback({ name, fn: fn as () => void }),
  );
};
when.skip = <F extends () => void>(desc: string, fn: SyncCallback<F>): void => {
  const name = `when: ${desc}`;
  (globals().describe as any).skip(
    name,
    wrapDescribeCallback({ name, fn: fn as () => void }),
  );
};
when.skipIf =
  (condition: boolean) =>
  <F extends () => void>(desc: string, fn: SyncCallback<F>): void =>
    condition ? when.skip(desc, fn) : when(desc, fn);
when.runIf = (condition: boolean) => when.skipIf(!condition);
when.repeatably =
  (configuration) =>
  <F extends (context: { attempt: number }) => void>(
    desc: string,
    fn: SyncCallback<F>,
  ): void => {
    const criteria = configuration.criteria ?? 'EVERY';

    // EVERY: create N describe blocks, all must pass
    if (criteria === 'EVERY') {
      for (const attempt of getNumberRange({
        start: 1,
        end: configuration.attempts,
      })) {
        when(`${desc}, attempt ${attempt}`, () =>
          (fn as (context: { attempt: number }) => void)({ attempt }),
        );
      }
      return;
    }

    // SOME: create N describe blocks, skip subsequent on success
    if (criteria === 'SOME') {
      // shared state across all attempts (mutable, scoped to this repeatably block)
      const state: RepeatableState = {
        criteria: 'SOME',
        anyAttemptPassed: false,
        thisAttemptFailed: false,
      };

      for (const attempt of getNumberRange({
        start: 1,
        end: configuration.attempts,
      })) {
        when(`${desc}, attempt ${attempt}`, () => {
          // register state by current path (explicit key, direct reference)
          const path = getDescribePath();
          registryDescribeRepeatable.set(path, state);

          // reset failure flag at start of this attempt's execution (not registration)
          globals().beforeAll(() => {
            state.thisAttemptFailed = false;
          });

          // mark success after attempt completes without failures
          globals().afterAll(() => {
            if (!state.thisAttemptFailed && !state.anyAttemptPassed) {
              state.anyAttemptPassed = true;
            }
          });

          // set context for nested then to capture (survives vitest deferred callbacks)
          setCurrentRepeatableContext(state);
          try {
            // invoke user callback (registers useBeforeAll, then, etc)
            (fn as (context: { attempt: number }) => void)({ attempt });
          } finally {
            setCurrentRepeatableContext(null);
          }
        });
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
  const [name, testFn] = castToTestInput({ input, prefix: 'then' });

  // check if we're in a repeatably SOME context
  // context is captured at registration time via wrapDescribeCallback
  const repeatableCtx = getCurrentRepeatableContext();

  // only use wrapper for SOME criteria (skip-on-success behavior)
  // EVERY criteria and non-repeatably contexts use passthrough (no wrapper overhead)
  if (!repeatableCtx || repeatableCtx.criteria !== 'SOME') {
    globals().test(name, testFn);
    return;
  }

  // in repeatably SOME context: wrap with skip-on-success and failure detection
  const runner = getTestRunner();

  // vitest: use testContext parameter for proper skip markers
  if (runner === 'vitest') {
    globals().test(name, async (testContext: { skip?: () => void }) => {
      // skip if prior attempt succeeded
      if (repeatableCtx.anyAttemptPassed) {
        // eslint-disable-next-line no-console -- explicit skip message in test output
        console.log('      🫧  [skipped] prior repeatably attempt passed');
        if (testContext?.skip) testContext.skip();
        return;
      }

      // failure detection via try/catch
      if (testFn) {
        try {
          await (testFn as () => Promise<unknown>)();
        } catch (error) {
          repeatableCtx.thisAttemptFailed = true;
          throw error;
        }
      }
    });
    return;
  }

  // jest: no testContext parameter (jest interprets first param as done callback)
  if (runner === 'jest') {
    globals().test(name, async () => {
      // skip if prior attempt succeeded
      if (repeatableCtx.anyAttemptPassed) {
        // eslint-disable-next-line no-console -- explicit skip message in test output
        console.log('      🫧  [skipped] prior repeatably attempt passed');
        return;
      }

      // failure detection via try/catch
      if (testFn) {
        try {
          await (testFn as () => Promise<unknown>)();
        } catch (error) {
          repeatableCtx.thisAttemptFailed = true;
          throw error;
        }
      }
    });
    return;
  }

  throw new UnexpectedCodePathError(
    'unsupported test runner for repeatably SOME',
    {
      runner,
    },
  );
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
  (...input: TestInput<{ attempt: number }>): void => {
    if (input.length !== 2 && input.length !== 3)
      throw new UnexpectedCodePathError('unsupported input length', { input });

    if (configuration.criteria === 'SOME') {
      const runner = getTestRunner();
      const testFn = globals().test;

      // vitest: use native retry option (test-scoped, no pollution)
      if (runner === 'vitest') {
        let attempt = 0;
        globals().beforeEach(() => attempt++);
        const [name, fn] = castToTestInput({
          input:
            input.length === 2
              ? [input[0], () => input[1]({ attempt })]
              : [input[0], input[1], () => input[2]({ attempt })],
          prefix: 'then',
        });
        (testFn as any)(name, { retry: configuration.attempts }, fn);
        return;
      }

      // jest: use N-test blocks with skip-on-success (avoids jest.retryTimes pollution)
      if (runner === 'jest') {
        // shared state across all attempts
        const state = { anyAttemptPassed: false };

        for (const attempt of getNumberRange({
          start: 1,
          end: configuration.attempts,
        })) {
          const [name] = castToTestInput({ input: [input[0]], prefix: 'then' });
          const userFn =
            input.length === 2
              ? () => input[1]({ attempt })
              : () => input[2]({ attempt });

          testFn(`${name}, attempt ${attempt}`, async () => {
            // skip if prior attempt succeeded
            if (state.anyAttemptPassed) {
              // eslint-disable-next-line no-console -- explicit skip message in test output
              console.log(
                '      🫧  [skipped] prior repeatably attempt passed',
              );
              return;
            }

            try {
              await userFn();
              state.anyAttemptPassed = true;
            } catch (error) {
              // only throw on final attempt
              if (attempt === configuration.attempts) throw error;
            }
          });
        }
        return;
      }

      return;
    }

    if (configuration.criteria === 'EVERY') {
      for (const attempt of getNumberRange({
        start: 1,
        end: configuration.attempts,
      })) {
        if (input.length === 2)
          then(input[0] + `, attempt ${attempt}`, () => input[1]({ attempt }));
        if (input.length === 3)
          then(input[0] + `, attempt ${attempt}`, input[1], () =>
            input[2]({ attempt }),
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
