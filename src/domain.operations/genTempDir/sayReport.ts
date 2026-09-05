/**
 * .what = writes one report block to stderr, closed by a blank line
 * .why = 🔴 this behavior emits NINE independent reports, and up to four of them can
 *        fire within a single gate pass. each was a bare `console.error(text)`, so
 *        two that stacked rendered with no separator at all:
 *
 *            └─ fix: remove it by hand, or widen access to it.
 *            🧹 test-fns: 1 temp-dir name could not be read, …
 *
 *        the mascot restarts at column 0, so the first report's `fix:` line reads as
 *        though it belongs to the second header — one run-on block where a human
 *        needs two. once a path wraps, the grouping is genuinely ambiguous
 *        (`rule.forbid.snapshot-visual-blemishes`).
 *
 * .note = 🔴 the separator is a TRAILING blank line, never a leading one, and the
 *         asymmetry carries real load. a leading blank would separate a report from
 *         its predecessor and then leave its own last line flush against whatever
 *         follows — the runner's summary, a stack trace, the next test's output. a
 *         trailing blank makes each block self-contained, so it is separated from
 *         EVERY emission after it, and needs no knowledge of what came before it or
 *         of whether it is first.
 *
 * .note = it exists as ONE operation rather than a `\n` appended at nine call sites
 *         (`rule.require.solve-at-cause`). a per-site repair does not hold here: patch
 *         the separator at one emission site and it stays absent at the next, which is
 *         what a fix applied per-instance always does. a call site that reaches for
 *         `console.error` directly re-opens the whole class.
 */
export const sayReport = (input: { lines: string[] }): void => {
  // the blank line is a member of the block, so `console.error`'s own newline
  // terminates it and the terminal receives `…\n\n`
  console.error([...input.lines, ''].join('\n'));
};
