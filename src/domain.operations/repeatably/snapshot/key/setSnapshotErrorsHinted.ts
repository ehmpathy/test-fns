/**
 * .what = the hint a consumer reads when their baseline predates the key rename
 * .why = the bare runner text says only "snapshot absent"; the fix is one resnap
 */
const HINT_KEY_RENAMED =
  '\n\n🫧  test-fns: this snapshot key was renamed — keys inside a repeatable block no longer carry an attempt suffix such as ", attempt 1". run the suite once with -u, then commit the snapshot file.';

/**
 * .what = appends the key-rename hint to each snapshot error among the failures
 * .why = the runner prints each error's own message where it reports the failure, so
 *        the hint must ride on that message; an unrelated throw stays untouched
 *
 * .note = deliberate mutation: the runner reports these same error objects, from its
 *         own suppressed list or from the throw. a new error would never be printed
 * .note = idempotent: a message that already holds the hint is left as is
 */
export const setSnapshotErrorsHinted = (input: { failures: unknown[] }): void =>
  input.failures.filter(isSnapshotError).forEach((error) => {
    if (error.message.includes(HINT_KEY_RENAMED)) return;
    error.message = `${error.message}${HINT_KEY_RENAMED}`;
  });

/**
 * .what = the head a snapshot matcher writes on its own failure
 * .why = jest opens with the matcher call (`expect(received).toMatchSnapshot()`, or any
 *        other `...Snapshot(` matcher); vitest opens with `Snapshot \`key\` mismatched`.
 *        a consumer's own error that merely mentions "snapshot" fits neither head
 */
const PATTERN_SNAPSHOT_ERROR_HEAD =
  /^(expect\(.*\)\.\w*Snapshot\(|Snapshot .*mismatched)/;

/**
 * .what = checks whether a failure came from a snapshot matcher
 * .why = the rename hint belongs on a snapshot failure, never on an unrelated throw
 */
const isSnapshotError = (error: unknown): error is Error =>
  error instanceof Error && PATTERN_SNAPSHOT_ERROR_HEAD.test(error.message);
