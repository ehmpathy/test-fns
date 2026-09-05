import * as fs from 'node:fs';
import { asErrnoCode, ERRNOS_ENTRY_ABSENT } from './asErrnoCode';

/**
 * .what = converges a file to the given content, and writes only when it differs
 * .why = for a file WE author and a consumer never edits — a doc we ship into
 *        their temp root. its content changes whenever we change it, so drift is
 *        expected rather than a conflict
 *
 * .the hazard this exists to end = findsertFile THROWS on content drift. that is
 *        right for a file whose content is a contract, and catastrophic for a doc:
 *        every readme edit would break the next genTempDir call of every consumer
 *        whose temp root predates the upgrade, deep inside their own test
 *
 * .note = 🔴 it does NOT stage-and-rename, and the absence is the design. a staged
 *         `<path>.<pid>.staged` lands in the temp ROOT — the shared namespace the
 *         run reclaim, both age-gate passes, the arrears check, and the consumer's
 *         own clamp all iterate — and it matches NONE of their filters. a process
 *         killed between the write and the rename would leave a file no mechanism
 *         can ever reclaim: permanent residue, planted by the very behavior whose
 *         wish is that no entry survive the run that made it
 *
 * .note = the content check is what makes atomicity unnecessary rather than merely
 *         unaffordable. this runs on EVERY genTempDir call, in every worker — but
 *         after the first write the content already matches, so the common path
 *         performs NO WRITE AT ALL. concurrent writers are not made safe here; they
 *         are made almost unreachable, which is the stronger property
 */
export const upsertFile = (input: { path: string; content: string }): void => {
  // converged already? then no write, and so no torn read to guard against
  if (isContentSame(input)) return;

  fs.writeFileSync(input.path, input.content, 'utf8');
};

/**
 * .what = tells whether the file already holds exactly this content
 * .why = an ABSENT file is a file we must write, so ENOENT reports "differs"
 *
 * .note = 🔴 ALLOWLIST, never a bare catch. to read EVERY failure as "differs"
 *         sounds conservative and is not: an EACCES then triggers a write to a path
 *         we just proved we cannot read, so the real fault surfaces as an opaque
 *         write error out of `upsertFile` rather than as the permission problem it
 *         is. "rewrite it" is the right answer for an absent file, and a guess for
 *         every other code (`rule.forbid.failhide`)
 */
const isContentSame = (input: { path: string; content: string }): boolean => {
  try {
    return fs.readFileSync(input.path, 'utf8') === input.content;
  } catch (error) {
    if (!ERRNOS_ENTRY_ABSENT.includes(asErrnoCode({ error }) ?? ''))
      throw error;
    return false;
  }
};
