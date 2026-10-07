import type { RepeatableState } from '../../registryDescribeRepeatable';

/**
 * .what = records the start of one SOME attempt on the block's shared state
 * .why = the first of the attempt trio (started → failed | passed). a describe-level
 *        attempt (given/when) and a test-level attempt (then) both start one; one
 *        operation holds the reset, so the two paths cannot drift apart
 *
 * .note = deliberate mutation: ctx is the one state every attempt of the block shares
 */
export const setAttemptStarted = (input: {
  ctx: RepeatableState;
  attempt: number;
}): void => {
  // clear the prior attempt's failure, and name this attempt
  input.ctx.thisAttemptFailed = false;
  input.ctx.thisAttemptIndex = input.attempt;
};
