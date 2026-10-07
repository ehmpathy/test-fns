import { ConstraintError, getError, MalfunctionError } from 'helpful-errors';

import { given, then, when } from '@src/contract';

import { getOneTestBudget } from '../budget/getOneTestBudget';
import { withAttemptWithheldReport } from './withAttemptWithheldReport';

/**
 * .what = runs a failed body at one retry index, and returns what it logged
 * .why = the wrapper's only decision is whether a failure is reported; the log is
 *        what a consumer sees
 */
const getOneRunAt = async (input: {
  retryIndex: number;
  testFn: () => unknown;
}): Promise<{ error: Error; lines: string[] }> => {
  const spy = jest.spyOn(console, 'log');
  try {
    const body = withAttemptWithheldReport({
      testFn: input.testFn,
      retriesMax: 2,
      runner: 'jest',
    });
    const error = await getError(() =>
      body({ task: { result: { retryCount: input.retryIndex } } }),
    );
    const lines = spy.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.includes('[withheld]'));
    return { error, lines };
  } finally {
    spy.mockRestore();
  }
};

/**
 * .what = the jest-circus state object, where the live test budget sits
 * .why = the hang case shrinks the budget for one run, then restores it
 */
const getOneJestState = (): object => {
  const symbolState = Object.getOwnPropertySymbols(globalThis).find(
    (symbol) => symbol.description === 'JEST_STATE_SYMBOL',
  );
  const state: unknown = symbolState
    ? Reflect.get(globalThis, symbolState)
    : null;
  if (typeof state !== 'object' || state === null)
    throw new MalfunctionError('jest state absent under jest', {
      hint: 'this case must run under jest-circus',
    });
  return state;
};

/** a body that throws on every try */
const throwFlake = (): never => {
  throw new Error('wave-report-flake');
};

describe('withAttemptWithheldReport', () => {
  given('[case1] a body that fails, with two retries allowed', () => {
    when('[t0] it fails on the first try', () => {
      then('it logs the withheld line, then rethrows', async () => {
        const run = await getOneRunAt({ retryIndex: 0, testFn: throwFlake });
        expect(run.error.message).toEqual('wave-report-flake');
        expect(run.lines).toHaveLength(1);
        expect(run.lines[0]).toContain(
          '[withheld] attempt 1 failed, a retry follows: wave-report-flake',
        );
      });
    });

    when('[t1] it fails on the final try', () => {
      then('it rethrows, and logs no withheld line', async () => {
        const run = await getOneRunAt({ retryIndex: 2, testFn: throwFlake });
        expect(run.error.message).toEqual('wave-report-flake');
        expect(run.lines).toHaveLength(0);
      });
    });
  });

  given('[case3] a body that reads its attempt', () => {
    when('[t0] it runs at retry index 2', () => {
      then('it is handed attempt 3', async () => {
        const attemptsSeen: number[] = [];
        const body = withAttemptWithheldReport({
          testFn: ({ attempt }) => {
            attemptsSeen.push(attempt);
          },
          retriesMax: 2,
          runner: 'jest',
        });
        await body({ task: { result: { retryCount: 2 } } });
        expect(attemptsSeen).toEqual([3]);
      });
    });
  });

  given('[case2] a body that passes', () => {
    when('[t0] it runs', () => {
      then('it resolves', async () => {
        const body = withAttemptWithheldReport({
          testFn: () => undefined,
          retriesMax: 2,
          runner: 'jest',
        });
        await expect(body(undefined)).resolves.toBeUndefined();
      });
    });
  });

  given('[case4] a body that hangs past the budget', () => {
    when('[t0] it hangs on the first try', () => {
      then(
        'it names the overrun in the withheld line, then rethrows',
        async () => {
          // shrink the live budget field for this one run, then restore it.
          // .note = jest.setTimeout inside a test is not read until the next run_start,
          //         so the case sets the field jest-circus itself reads
          const state = getOneJestState();
          const budgetBefore = getOneTestBudget({ runner: 'jest' });
          Reflect.set(state, 'testTimeout', 100);
          const run = await (async () => {
            try {
              return await getOneRunAt({
                retryIndex: 0,
                testFn: () => new Promise((settle) => setTimeout(settle, 400)),
              });
            } finally {
              Reflect.set(state, 'testTimeout', budgetBefore);
            }
          })();
          expect(run.error).toBeInstanceOf(ConstraintError);
          expect(run.error.message).toContain('exceeded the 100ms budget');
          expect(run.lines).toHaveLength(1);
          expect(run.lines[0]).toContain(
            '[withheld] attempt 1 failed, a retry follows: ✋ ConstraintError: exceeded the 100ms budget',
          );
        },
      );
    });
  });
});
