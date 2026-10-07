import { given, then, when } from '@src/contract';

import type { RepeatableState } from '../../registryDescribeRepeatable';
import { genRepeatableState } from '../genRepeatableState';
import { setAttemptPassed } from './setAttemptPassed';

/**
 * .what = a SOME state at attempt 1
 * .why = each case starts from a fresh shared state
 */
const genStateDemo = (input: {
  thisAttemptFailed: boolean;
}): RepeatableState => ({
  ...genRepeatableState({ attempts: 3 }),
  thisAttemptFailed: input.thisAttemptFailed,
  thisAttemptIndex: 1,
});

describe('setAttemptPassed', () => {
  given('[case1] an attempt that ended with no failure', () => {
    when('[t0] the pass is recorded', () => {
      const ctx = genStateDemo({ thisAttemptFailed: false });
      setAttemptPassed({ ctx });

      then('the block is marked passed', () => {
        expect(ctx.anyAttemptPassed).toEqual(true);
      });
    });
  });

  given('[case2] an attempt that failed', () => {
    when('[t0] the pass is recorded', () => {
      const ctx = genStateDemo({ thisAttemptFailed: true });
      setAttemptPassed({ ctx });

      then('the block is not marked passed', () => {
        expect(ctx.anyAttemptPassed).toEqual(false);
      });
    });
  });
});
