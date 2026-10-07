import type { RepeatableState } from '../../registryDescribeRepeatable';

/**
 * .what = records a SOME attempt that ended with no failure as the block's pass
 * .why = the mirror of setAttemptFailed. a describe-level attempt (given/when) and a
 *        test-level attempt (then) both mark the pass; one operation holds the rule,
 *        so the two paths cannot drift apart
 *
 * .note = deliberate mutation: ctx is the one state every attempt of the block shares
 * .note = idempotent: a second call, or a call after a failed attempt, changes naught
 */
export const setAttemptPassed = (input: { ctx: RepeatableState }): void => {
  // an attempt that failed never counts as the pass
  if (input.ctx.thisAttemptFailed) return;

  // mark the block passed, so later attempts skip
  input.ctx.anyAttemptPassed = true;
};
