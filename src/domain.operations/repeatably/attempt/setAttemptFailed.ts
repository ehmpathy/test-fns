import type { RepeatableState } from '../../registryDescribeRepeatable';

/**
 * .what = records a failed SOME attempt on the shared state, and judges whether it is final
 * .why = a test body and a setup hook both fail attempts of one block. each must mark the
 *        attempt failed and keep the first error of any attempt, and the final attempt
 *        must surface that first error (extant contract). one operation holds the rule,
 *        so the two paths cannot drift apart
 *
 * .note = deliberate mutation: ctx is the one state every attempt of the block shares
 *
 * @returns isFinal — whether this was the last attempt; errorFirst — the first error of
 *          any attempt, which the final attempt rethrows
 */
export const setAttemptFailed = (input: {
  ctx: RepeatableState;
  error: unknown;
}): { isFinal: boolean; errorFirst: Error | null } => {
  // mark the attempt failed, so it never counts as the pass
  input.ctx.thisAttemptFailed = true;

  // keep the first error of any attempt
  if (!input.ctx.anyError && input.error instanceof Error)
    input.ctx.anyError = input.error;

  return {
    isFinal: input.ctx.thisAttemptIndex === input.ctx.allAttemptsQuant,
    errorFirst: input.ctx.anyError,
  };
};
