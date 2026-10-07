import { UnexpectedCodePathError } from 'helpful-errors';

import { getTestRunner } from '@src/infra/isomorph.test/detectTestRunner';
import { globals } from '@src/infra/isomorph.test/getTestGlobals';

import {
  getCurrentRepeatableContext,
  getCurrentRepeatableScopes,
  getDescribePath,
  type RepeatableScope,
  type RepeatableState,
  registryDescribeRepeatable,
  setCurrentRepeatableContext,
  setCurrentRepeatableScopes,
  wrapDescribeCallback,
} from './registryDescribeRepeatable';
import { TIMEOUT_MAX_MS } from './repeatably/attempt/budget/getOneTestBudget';
import { setAttemptPassed } from './repeatably/attempt/setAttemptPassed';
import { setAttemptStarted } from './repeatably/attempt/setAttemptStarted';
import { withAttemptWithheldReport } from './repeatably/attempt/withheld/withAttemptWithheldReport';
import { genRepeatableState } from './repeatably/genRepeatableState';
import {
  genRepeatableTestBody,
  type VitestTestContext,
} from './repeatably/genRepeatableTestBody';

export const getNumberRange = (input: {
  start: number;
  end: number;
}): number[] => {
  // compute the length of the range
  const length = input.end - input.start + 1;

  // build an array that spans the range
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
  ): void =>
    setAttemptsRepeatable({
      describe: given,
      prefix: 'given',
      desc,
      configuration,
      fn: fn as (context: { attempt: number }) => void,
    });

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
  ): void =>
    setAttemptsRepeatable({
      describe: when,
      prefix: 'when',
      desc,
      configuration,
      fn: fn as (context: { attempt: number }) => void,
    });

/**
 * .what = registers one describe block per attempt of a given/when.repeatably
 * .why = given and when repeat the same way; one body keeps the two in step
 *
 * .note = per criteria:
 *         - EVERY: N blocks, all must pass
 *         - SOME: N blocks that share one state; a pass skips the rest, and a failed
 *           non-final attempt is withheld (see genRepeatableTestBody)
 *         both push a scope, so every snapshot key inside drops `, attempt N`
 */
const setAttemptsRepeatable = (input: {
  describe: (desc: string, fn: () => void) => void;
  prefix: 'given' | 'when';
  desc: string;
  configuration: { attempts: number; criteria?: 'EVERY' | 'SOME' };
  fn: (context: { attempt: number }) => void;
}): void => {
  const criteria = input.configuration.criteria ?? 'EVERY';
  if (criteria !== 'EVERY' && criteria !== 'SOME')
    throw new UnexpectedCodePathError(
      'configuration.criteria was neither EVERY nor SOME',
      { configuration: input.configuration },
    );

  // SOME shares one state across all attempts (mutable, scoped to this block)
  const state: RepeatableState | null =
    criteria === 'SOME'
      ? genRepeatableState({ attempts: input.configuration.attempts })
      : null;

  for (const attempt of getNumberRange({
    start: 1,
    end: input.configuration.attempts,
  })) {
    const descAttempt = `${input.desc}, attempt ${attempt}`;
    const scope: RepeatableScope = {
      nameAttempt: `${input.prefix}: ${descAttempt}`,
      nameBase: `${input.prefix}: ${input.desc}`,
    };
    input.describe(descAttempt, () => {
      // track this attempt on the shared state (SOME only)
      setAttemptTracked({ state, attempt });

      // expose context + scope to nested blocks (survives vitest deferred callbacks)
      const ctxBefore = getCurrentRepeatableContext();
      const scopesBefore = getCurrentRepeatableScopes();
      setCurrentRepeatableContext(state ?? ctxBefore);
      setCurrentRepeatableScopes([...scopesBefore, scope]);
      try {
        // invoke user callback (registers useBeforeAll, when, then, etc)
        input.fn({ attempt });
      } finally {
        setCurrentRepeatableContext(ctxBefore);
        setCurrentRepeatableScopes(scopesBefore);
      }
    });
  }
};

/**
 * .what = registers one SOME attempt on its block's shared state
 * .why = the attempt's hooks reset the failure flag before it runs and mark the
 *        block passed after it, which is how a later attempt knows to skip
 * .note = an EVERY block holds no state, so there is naught to track
 */
const setAttemptTracked = (input: {
  state: RepeatableState | null;
  attempt: number;
}): void => {
  const state = input.state;
  if (!state) return;

  // register state by current path (explicit key, direct reference)
  registryDescribeRepeatable.set(getDescribePath(), state);

  // start this attempt on the shared state, before its run
  globals().beforeAll(() =>
    setAttemptStarted({ ctx: state, attempt: input.attempt }),
  );

  // mark success after attempt completes without failures
  globals().afterAll(() => setAttemptPassed({ ctx: state }));
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

  // context + scopes are captured at registration time via wrapDescribeCallback
  setThenTest({
    name,
    testFn: testFn ?? null,
    ctx: getCurrentRepeatableContext(),
    scopes: getCurrentRepeatableScopes(),
  });
}) as Test;

/**
 * .what = registers one then-test, wrapped when it sits inside a repeatable block
 * .why = inside a repeatable block a test must check one snapshot baseline, and under
 *        SOME a failed non-final attempt must be withheld (see genRepeatableTestBody).
 *        outside any repeatable block, the test registers untouched
 *
 * .note = under SOME the test registers with TIMEOUT_MAX_MS, so the runner's own timer
 *         never fires; the wrapper races the body against the real budget instead
 */
const setThenTest = (input: {
  name: string;
  /**
   * .note = null for a body-less test (a `then` with no fn)
   */
  testFn: (() => Promise<unknown>) | ((cb: any) => void) | null;
  ctx: RepeatableState | null;
  scopes: RepeatableScope[];
}): void => {
  // only SOME criteria withholds; EVERY only strips the key
  const ctxSome = input.ctx?.criteria === 'SOME' ? input.ctx : null;

  // with no body, register untouched
  if (!input.testFn) {
    globals().test(input.name, undefined);
    return;
  }

  // outside any repeatable block, register untouched
  if (!ctxSome && input.scopes.length === 0) {
    globals().test(input.name, input.testFn);
    return;
  }

  // inside a repeatable block: wrap the body
  const runner = getTestRunner();
  const body = genRepeatableTestBody({
    testFn: input.testFn,
    ctx: ctxSome,
    scopes: input.scopes,
    runner,
  });
  const timeout = ctxSome ? TIMEOUT_MAX_MS : undefined;

  // vitest: hand the body its test context, for the task chain + skip marker
  if (runner === 'vitest') {
    globals().test(
      input.name,
      (testContext: VitestTestContext) => body(testContext),
      timeout,
    );
    return;
  }

  // jest: no testContext parameter (jest interprets first param as done callback)
  globals().test(input.name, () => body(null), timeout);
};

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

    // cast the shared shape every variant registers from
    const [name] = castToTestInput({ input: [input[0]], prefix: 'then' });
    const fnAttempt = input.length === 2 ? input[1] : input[2];
    const shape = { name, fnAttempt, attempts: configuration.attempts };

    // SOME on vitest: the runner's native retry
    const runner = getTestRunner();
    if (configuration.criteria === 'SOME' && runner === 'vitest') {
      setThenRepeatablySomeViaNativeRetry(shape);
      return;
    }

    // SOME on jest: one test per attempt, a failed non-final attempt withheld
    if (configuration.criteria === 'SOME' && runner === 'jest') {
      setThenRepeatablySomeViaWithhold(shape);
      return;
    }

    // EVERY: one test per attempt, each must pass
    if (configuration.criteria === 'EVERY') {
      setThenRepeatablyEvery(shape);
      return;
    }

    throw new UnexpectedCodePathError(
      'configuration.criteria was neither EVERY nor SOME',
      { configuration, runner },
    );
  };

/**
 * .what = registers a SOME then.repeatably on vitest, via the runner's native retry
 * .why = vitest retry is test-scoped, so it pollutes no neighbor; the wrapper logs
 *        each withheld try, since the runner itself names none
 * .note = vitest `retry` counts retries, not runs, so `attempts` runs need
 *         `attempts - 1` retries — the same count jest registers as tests
 * .note = the test registers with TIMEOUT_MAX_MS, so vitest's own timer never fires;
 *         the wrapper races each try against the real budget, so a hang is withheld
 *         and named like any other failure
 */
const setThenRepeatablySomeViaNativeRetry = (input: {
  name: string;
  fnAttempt: (input: { attempt: number }) => unknown;
  attempts: number;
}): void => {
  const retriesMax = input.attempts - 1;
  const fnReported = withAttemptWithheldReport({
    testFn: input.fnAttempt,
    retriesMax,
    runner: 'vitest',
  });
  (globals().test as any)(
    input.name,
    { retry: retriesMax, timeout: TIMEOUT_MAX_MS },
    fnReported,
  );
};

/**
 * .what = registers a SOME then.repeatably on jest, as one test per attempt
 * .why = jest.retryTimes pollutes the whole file, so each attempt is its own test
 *        that skips once a prior attempt passed, and withholds a non-final failure
 */
const setThenRepeatablySomeViaWithhold = (input: {
  name: string;
  fnAttempt: (input: { attempt: number }) => unknown;
  attempts: number;
}): void => {
  // shared state across all attempts; each test is one attempt
  const state = genRepeatableState({ attempts: input.attempts });
  const scopesBefore = getCurrentRepeatableScopes();

  // register one test per attempt
  for (const attempt of getNumberRange({ start: 1, end: input.attempts })) {
    const nameAttempt = `${input.name}, attempt ${attempt}`;
    const body = genRepeatableTestBody({
      testFn: () => input.fnAttempt({ attempt }),
      ctx: state,
      scopes: [...scopesBefore, { nameAttempt, nameBase: input.name }],
      runner: 'jest',
    });

    globals().test(
      nameAttempt,
      async () => {
        // start this attempt on the shared state; the body reads it to withhold
        setAttemptStarted({ ctx: state, attempt });

        // run the attempt; a failure on a non-final attempt is withheld
        await body(null);

        // mark success after the attempt completes without failures
        setAttemptPassed({ ctx: state });
      },
      TIMEOUT_MAX_MS,
    );
  }
};

/**
 * .what = registers an EVERY then.repeatably, as one test per attempt
 * .why = every attempt must pass, so each is a plain test that checks one
 *        snapshot baseline
 */
const setThenRepeatablyEvery = (input: {
  name: string;
  fnAttempt: (input: { attempt: number }) => unknown;
  attempts: number;
}): void => {
  for (const attempt of getNumberRange({ start: 1, end: input.attempts })) {
    const nameAttempt = `${input.name}, attempt ${attempt}`;
    setThenTest({
      name: nameAttempt,
      testFn: async () => input.fnAttempt({ attempt }),
      ctx: getCurrentRepeatableContext(),
      scopes: [
        ...getCurrentRepeatableScopes(),
        { nameAttempt, nameBase: input.name },
      ],
    });
  }
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
