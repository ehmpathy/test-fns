/**
 * .what = reads the reason off a filesystem error
 * .why = the residue report must name WHY an entry resisted, so the human knows
 *        whether to chmod, unmount, or ask for help
 *
 * .note = 🔴 ONE declaration, never a copy per reclaim. two copies part company on
 *         the branch they rarely take: one falls back to `error.message` where the
 *         code is absent, the other reports a bare 'UNKNOWN' for the SAME error. so
 *         one reclaim tells the human what went wrong and the other shrugs — a
 *         difference no one chose, in the one line whose whole job is to explain
 *
 * .note = the message fallback is the RIGHT half of that divergence, so it is the
 *         half this declares: a named cause beats 'UNKNOWN' every time, and an
 *         error without a `code` is exactly when a human most needs the text
 *
 * .note = it does NOT serve `isProcessGone` or `isSymlinkEexistError`, which read
 *         the same `code` for a control-flow DECISION rather than for a label. this
 *         returns the FIRST rung that answers; those must check BOTH, and a message
 *         that merely mentions an errno must never read as proof of it
 */
export const asErrno = (input: { error: unknown }): string => {
  // .note = narrowed via `in`, never an as-cast. a thrown value is `unknown` by
  //         contract, and a cast would ASSERT the shape this reads rather than
  //         CHECK it — on the one code path that runs when things already broke
  const error = input.error;
  if (typeof error !== 'object' || error === null) return 'UNKNOWN';
  if ('code' in error && typeof error.code === 'string') return error.code;
  if ('message' in error && typeof error.message === 'string')
    return error.message;
  return 'UNKNOWN';
};
