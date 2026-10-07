import type { ExpectSnapshotState } from '../getOneExpectSnapshotState';

/**
 * .what = rolls the runner's snapshot tallies back to a noted tally
 * .why = a withheld attempt must not fail the file. jest fails a test on any suppressed
 *        mismatch and fails `--ci` on any `unmatched` count, so both return to their
 *        values from before the body ran
 *
 * .note = deliberate mutation: the runner reads these live objects to decide the
 *         verdict, so a rollback must write into them; no copy would be read
 * .note = jest holds `unmatched` as a number; vitest holds it as a map keyed by task id
 */
export const setSnapshotTallyRestored = (input: {
  snap: ExpectSnapshotState;
  tally: { suppressedQuant: number; unmatched: unknown };
  taskId: string | null;
}): void => {
  // drop the mismatches the body recorded
  input.snap.suppressedErrors?.splice(input.tally.suppressedQuant);

  // jest: restore the count
  if (typeof input.tally.unmatched === 'number')
    Reflect.set(input.snap.snapshotState, 'unmatched', input.tally.unmatched);

  // vitest: drop this task's entry
  if (isUnmatchedPerTask(input.tally.unmatched) && input.taskId !== null)
    input.tally.unmatched.delete(input.taskId);
};

/**
 * .what = checks the `unmatched` tally is vitest's per-task map
 * .why = the tally is a foreign shape; it is narrowed, never cast
 */
const isUnmatchedPerTask = (
  value: unknown,
): value is { delete: (key: string) => unknown } =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'delete') === 'function';
