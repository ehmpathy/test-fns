import type { ExpectSnapshotState } from '../getOneExpectSnapshotState';

/**
 * .what = the snapshot mismatches jest recorded since a tally was noted
 * .why = jest records a `toMatchSnapshot` mismatch instead of a throw, so the body's
 *        own mismatches are the entries appended after the tally, never the older ones
 *
 * .note = always empty on vitest, whose `toMatchSnapshot` throws
 */
export const getAllSuppressedErrorsSince = (input: {
  snap: ExpectSnapshotState;
  tally: { suppressedQuant: number };
}): unknown[] =>
  input.snap.suppressedErrors?.slice(input.tally.suppressedQuant) ?? [];
