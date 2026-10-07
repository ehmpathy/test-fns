/**
 * .what = logs one line for a failure a non-final `SOME` attempt withheld
 * .why = a withheld failure leaves the test ✓ (a runner has no "retried" status), so
 *        this line is the only trace that an earlier attempt failed. the docs promise
 *        its shape, so one module owns it
 */
export const reportAttemptWithheld = (input: {
  attemptIndex: number;
  failure: unknown;
}): void => {
  // eslint-disable-next-line no-console -- explicit withhold message in test output
  console.log(
    `      🫧  [withheld] attempt ${input.attemptIndex} failed, a retry follows: ${asFirstLine(input.failure)}`,
  );
};

/**
 * .what = the first non-blank line of a failure, plus the snapshot name where jest gives one
 * .why = the withheld log must stay one line; the full failure surfaces only on the
 *        final attempt. a jest snapshot mismatch opens with the bare matcher call
 *        (`expect(received).toMatchSnapshot()`), so its `Snapshot name:` line is what
 *        tells a reader which snapshot differed
 */
const asFirstLine = (failure: unknown): string => {
  const text = failure instanceof Error ? failure.message : String(failure);
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const lineFirst = lines[0] ?? '';
  const lineSnapshotName = lines.find((line) =>
    line.startsWith('Snapshot name:'),
  );
  return lineSnapshotName ? `${lineFirst} — ${lineSnapshotName}` : lineFirst;
};
