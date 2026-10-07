import type { ExpectSnapshotState } from '../getOneExpectSnapshotState';

/**
 * .what = the count each stripped test name held when its first attempt began, per file
 * .why = the runner counts `toMatchSnapshot` calls per test name across the file, so
 *        attempt 2 of a stripped name would write `name 2` where attempt 1 wrote
 *        `name 1`. each later attempt starts its count from attempt 1's start
 *
 * .note = keyed on the file's own snapshot state, so a runner that shares one module
 *         across files (vitest `isolate: false`) still counts each file apart
 * .note = assumes attempts run in sequence, as repeatable blocks do. a
 *         `test.concurrent` inside a repeatable block would interleave the counts of
 *         its attempts; the runner's own per-name counter has the same bound
 */
const countAtFirstAttemptPerFile = new WeakMap<
  object,
  Map<string, { count: number; attemptKey: string }>
>();

/**
 * .what = sets a stripped test name's snapshot count back to its first-attempt start
 * .why = every attempt must check the same keys — `name 1`, `name 2`, … — as the first
 *
 * .note = keyed on the attempt, so two tests of one name inside one attempt still
 *         count on from each other, as they would outside a repeatable block
 */
export const setSnapshotCounterRebased = (input: {
  snap: ExpectSnapshotState;
  nameStripped: string;
  attemptKey: string;
}): void => {
  // the counts recorded for this file
  const countAtFirstAttempt =
    countAtFirstAttemptPerFile.get(input.snap.snapshotState) ?? new Map();
  countAtFirstAttemptPerFile.set(input.snap.snapshotState, countAtFirstAttempt);

  // the first attempt to reach this name records where its count began
  const found = countAtFirstAttempt.get(input.nameStripped);
  if (!found) {
    countAtFirstAttempt.set(input.nameStripped, {
      count: input.snap.counters.get(input.nameStripped) ?? 0,
      attemptKey: input.attemptKey,
    });
    return;
  }

  // a second test of the same name in the same attempt counts on, as usual
  if (found.attemptKey === input.attemptKey) return;

  // a later attempt starts its count where the first attempt's began
  input.snap.counters.set(input.nameStripped, found.count);
  countAtFirstAttempt.set(input.nameStripped, {
    count: found.count,
    attemptKey: input.attemptKey,
  });
};
