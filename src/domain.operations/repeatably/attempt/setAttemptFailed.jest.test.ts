import { given, then, when } from '@src/contract';

import type { RepeatableState } from '../../registryDescribeRepeatable';
import { genRepeatableState } from '../genRepeatableState';
import { setAttemptFailed } from './setAttemptFailed';

/**
 * .what = a SOME state at a given attempt
 * .why = each case starts from a fresh shared state
 */
const genStateDemo = (input: { attemptIndex: number }): RepeatableState => ({
  ...genRepeatableState({ attempts: 3 }),
  thisAttemptIndex: input.attemptIndex,
});

describe('setAttemptFailed', () => {
  given('[case1] three attempts that fail with distinct errors', () => {
    when('[t0] each attempt is recorded in turn', () => {
      const ctx = genStateDemo({ attemptIndex: 1 });
      const errorFirst = new Error('failure-1');
      const verdictFirst = setAttemptFailed({ ctx, error: errorFirst });
      ctx.thisAttemptIndex = 2;
      setAttemptFailed({ ctx, error: new Error('failure-2') });
      ctx.thisAttemptIndex = 3;
      const verdictFinal = setAttemptFailed({
        ctx,
        error: new Error('failure-3'),
      });

      then('a non-final attempt is not final', () => {
        expect(verdictFirst.isFinal).toEqual(false);
      });

      then('the final attempt is final, and carries the first error', () => {
        expect(verdictFinal.isFinal).toEqual(true);
        expect(verdictFinal.errorFirst).toBe(errorFirst);
      });

      then('the attempt is marked failed', () => {
        expect(ctx.thisAttemptFailed).toEqual(true);
      });
    });
  });

  given('[case2] an attempt that failed with no thrown error', () => {
    when('[t0] the attempt is recorded', () => {
      const ctx = genStateDemo({ attemptIndex: 1 });
      const verdict = setAttemptFailed({ ctx, error: null });

      then('it is marked failed, with no error kept', () => {
        expect(ctx.thisAttemptFailed).toEqual(true);
        expect(verdict.errorFirst).toEqual(null);
      });
    });
  });
});
