import type { RepeatableState } from '../registryDescribeRepeatable';

/**
 * .what = constructs the fresh shared state of one SOME block, before its first attempt
 * .why = every SOME path (given/when.repeatably and then.repeatably on jest) reads and
 *        writes this one record via setAttemptFailed / setAttemptPassed; one constructor
 *        keeps its initial shape from drift between the paths that build it
 */
export const genRepeatableState = (input: {
  attempts: number;
}): RepeatableState => ({
  criteria: 'SOME',
  anyAttemptPassed: false,
  thisAttemptFailed: false,
  thisAttemptIndex: 0,
  allAttemptsQuant: input.attempts,
  anyError: null,
});
