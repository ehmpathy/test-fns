/**
 * .what = reads the posix errno code off a thrown value, or null when it carries none
 * .why = a catch may only swallow the errors it can NAME. `rule.forbid.failhide` is
 *        explicit that a bare `catch { return null }` is a mega-blocker: it converts a
 *        permission fault, an i/o fault, and a benign race into one indistinguishable
 *        answer. an allowlist needs a reliable way to ask "which error is this", and
 *        this is it
 *
 * .note = it reads `code` ALONE and never falls back to `error.message`. that is the
 *         whole difference between this and `asErrno`, which is written for a LABEL a
 *         human reads and so may guess from the message. a control-flow DECISION must
 *         not guess: a message that merely mentions ENOENT would otherwise be taken as
 *         proof a file was absent, and the error would be swallowed on that hunch
 *
 * .note = narrowed via `in`, never an as-cast — a thrown value is `unknown` by
 *         construction, so its shape must be checked rather than asserted
 *         (`rule.forbid.as-cast`)
 *
 * .note = it lives in infra/ rather than beside its first caller because callers span
 *         BOTH domain.operations and infra. infra may not import from domain.operations
 *         (`rule.require.directional-deps`), so infra is the common ancestor the two
 *         can share (`rule.prefer.most-common-denominator`)
 */
/**
 * the errno codes that mean "the entry is not there", and so are safe to swallow
 *
 * .why = every reclaim in this library walks a directory it does not own exclusively.
 *        a PEER's teardown can remove an entry between our readdir and our stat/read,
 *        so ENOENT is a routine race rather than a fault — and it is the ONLY one.
 *        EACCES, EIO, EBADF and the rest are real, and each must reach a human
 *
 * .note = a LIST rather than a bare equality, so a later benign code can be added
 *         beside a reason for it. the bar for an addition is high: a code belongs here
 *         only if its answer is genuinely "the entry is absent", never merely
 *         "the read did not work"
 */
export const ERRNOS_ENTRY_ABSENT: string[] = ['ENOENT'];

export const asErrnoCode = (input: { error: unknown }): string | null => {
  const error = input.error;
  if (typeof error !== 'object' || error === null) return null;
  if (!('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
};
