import { MalfunctionError } from 'helpful-errors';

import type { TestRunner } from '@src/infra/isomorph.test/detectTestRunner';
import { getOneRunnerVersion } from '@src/infra/isomorph.test/getOneRunnerVersion';

/**
 * .what = the slice of the runner's expect + snapshot state a repeatable attempt reads
 * .why = a repeatable attempt strips the attempt ordinal from its snapshot key, and on
 *        jest it withholds the snapshot mismatch of a non-final attempt. both reach
 *        runner internals, so the slice is checked once, here, and typed for the rest
 */
export interface ExpectSnapshotState {
  /** the runner's global expect, whose state holds the current test name */
  expect: {
    getState: () => Record<string, unknown>;
    setState: (state: Record<string, unknown>) => void;
  };

  /** the per-file count of `toMatchSnapshot` calls, keyed by test name */
  counters: {
    get: (name: string) => number | undefined;
    set: (name: string, count: number) => unknown;
  };

  /** the snapshot file's entries, keyed by `${testName} ${count}` */
  snapshotData: object;

  /**
   * jest only: the mismatches `toMatchSnapshot` records instead of a throw
   * .note = null on vitest, whose `toMatchSnapshot` throws
   */
  suppressedErrors: unknown[] | null;

  /** the raw snapshot state, whose `unmatched` tally a withheld attempt restores */
  snapshotState: object;
}

/**
 * .what = reads and checks the expect + snapshot state of the active runner
 * .why = an absent field is a runner change this code must learn of, so it fails
 *        loud rather than silently skip the key strip or the withhold (invariant I4)
 */
export const getOneExpectSnapshotState = (input: {
  runner: TestRunner;
}): ExpectSnapshotState => {
  // the runner's global expect
  const expectGlobal: unknown = Reflect.get(globalThis, 'expect');
  const getState = isObjectish(expectGlobal)
    ? Reflect.get(expectGlobal, 'getState')
    : undefined;
  const setState = isObjectish(expectGlobal)
    ? Reflect.get(expectGlobal, 'setState')
    : undefined;
  if (typeof getState !== 'function' || typeof setState !== 'function')
    throw genMalfunction({ runner: input.runner, field: 'expect.getState' });
  const state: unknown = getState.call(expectGlobal);
  if (!isObjectish(state))
    throw genMalfunction({ runner: input.runner, field: 'expect.getState()' });

  // the snapshot state the runner holds for this file
  const snapshotState: unknown = Reflect.get(state, 'snapshotState');
  if (!isObjectish(snapshotState))
    throw genMalfunction({
      runner: input.runner,
      field: 'expect.getState().snapshotState',
    });
  const counters: unknown = Reflect.get(snapshotState, '_counters');
  if (!isObjectish(counters))
    throw genMalfunction({
      runner: input.runner,
      field: 'snapshotState._counters',
    });
  if (typeof Reflect.get(counters, 'get') !== 'function')
    throw genMalfunction({
      runner: input.runner,
      field: 'snapshotState._counters.get',
    });
  if (typeof Reflect.get(counters, 'set') !== 'function')
    throw genMalfunction({
      runner: input.runner,
      field: 'snapshotState._counters.set',
    });
  const snapshotData: unknown = Reflect.get(snapshotState, '_snapshotData');
  if (!isObjectish(snapshotData))
    throw genMalfunction({
      runner: input.runner,
      field: 'snapshotState._snapshotData',
    });

  // jest records a mismatch instead of a throw, and tallies it on the state
  const suppressedErrors: unknown =
    input.runner === 'jest' ? Reflect.get(state, 'suppressedErrors') : null;
  if (input.runner === 'jest' && !Array.isArray(suppressedErrors))
    throw genMalfunction({
      runner: input.runner,
      field: 'expect.getState().suppressedErrors',
    });
  if (
    input.runner === 'jest' &&
    typeof Reflect.get(snapshotState, 'unmatched') !== 'number'
  )
    throw genMalfunction({
      runner: input.runner,
      field: 'snapshotState.unmatched',
    });

  return {
    expect: {
      getState: () => getState.call(expectGlobal),
      setState: (next) => setState.call(expectGlobal, next),
    },
    counters: {
      get: (name) =>
        Reflect.apply(Reflect.get(counters, 'get'), counters, [name]),
      set: (name, count) =>
        Reflect.apply(Reflect.get(counters, 'set'), counters, [name, count]),
    },
    snapshotData,
    suppressedErrors: Array.isArray(suppressedErrors) ? suppressedErrors : null,
    snapshotState,
  };
};

/**
 * .what = checks a value is a non-null object or function
 * .why = runner internals are foreign shapes; each read is narrowed, never cast
 */
const isObjectish = (value: unknown): value is object =>
  (typeof value === 'object' && value !== null) || typeof value === 'function';

/**
 * .what = the error for a runner internal that is absent
 * .why = one message shape names the runner and the absent field, so a maintainer
 *        knows which internal moved
 */
const genMalfunction = (input: { runner: TestRunner; field: string }) =>
  new MalfunctionError(
    `repeatably: the ${input.runner} runner no longer exposes ${input.field}`,
    {
      runner: getOneRunnerVersion({ runner: input.runner }),
      field: input.field,
      hint: 'test-fns reads this runner internal to give each repeatable attempt one snapshot key; please report the runner version at https://github.com/ehmpathy/test-fns/issues',
    },
  );
