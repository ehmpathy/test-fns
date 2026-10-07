import type { ExpectSnapshotState } from '../getOneExpectSnapshotState';

/**
 * .what = the snapshot tallies a repeatable attempt may need to roll back
 * .why = a withheld attempt must leave the runner as if it never ran: no suppressed
 *        mismatch, no extra `unmatched` count. the tally is noted before the body runs
 */
export const getOneSnapshotTally = (input: {
  snap: ExpectSnapshotState;
}): { suppressedQuant: number; unmatched: unknown } => ({
  suppressedQuant: input.snap.suppressedErrors?.length ?? 0,
  unmatched: Reflect.get(input.snap.snapshotState, 'unmatched'),
});
