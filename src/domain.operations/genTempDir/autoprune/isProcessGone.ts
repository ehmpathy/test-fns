/**
 * .what = tells whether a process is gone, or null when the question cannot be answered
 * .why = the arrears check names a run whose process no longer answers. it may ask
 *        this at all ONLY because it reports and never reaps — a reap on a liveness
 *        guess would trade a leak for LOSS, and loss is the one failure mode this
 *        design keeps off the table
 *
 * @returns true when the process is gone, false when it answers, null when unknown
 *
 * .note = a null falls back to the age window. fail toward SILENCE, never toward a
 *         false accusation against a live peer
 */
export const isProcessGone = (input: { pid: number }): boolean | null => {
  if (!Number.isInteger(input.pid) || input.pid <= 0) return null;

  try {
    // signal 0 checks for existence without a signal delivered
    process.kill(input.pid, 0);
    return false;
  } catch (error) {
    // .note = narrowed via `in`, never an as-cast (rule.forbid.as-cast)
    //
    // .note = it reads `code` ALONE, and deliberately does NOT route through
    //         asErrno. that reader falls back to `error.message`, which is right
    //         for a label a human reads and wrong for a control-flow DECISION: a
    //         message that merely mentions ESRCH would then be read as proof a
    //         process is gone. this predicate answers null rather than guess
    if (typeof error !== 'object' || error === null) return null;
    if (!('code' in error)) return null;

    // ESRCH — no such process; it is gone
    if (error.code === 'ESRCH') return true;

    // EPERM — it exists, we simply may not signal it
    if (error.code === 'EPERM') return false;

    // every other code leaves the question open. do not guess
    return null;
  }
};
