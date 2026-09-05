import { MalfunctionError } from 'helpful-errors';

import * as fs from 'node:fs';
import * as path from 'node:path';
// .note = RELATIVE, never the @src alias. this module sits on the globalTeardown
//         path, which a runner loads OUTSIDE its moduleNameMapper
import type { TestRunner } from '../../../infra/isomorph.test/detectTestRunner';
import { asTempDirRun } from '../computeTempDirName';
import { getOneRunnerVersion } from './getOneRunnerVersion';

/**
 * .what = asserts the run id reached the workers that allocated dirs
 * .why = the mint chain rides an UNDOCUMENTED property of the runner: that a
 *        worker inherits a copy of the main env at fork. if a runner upgrade ever
 *        breaks that, every dir lands unstamped, the reclaim matches zero, and the
 *        suite stays GREEN while the leak resumes. that is the exact failure this
 *        whole behavior exists to end, so it must not be the failure that hides it
 *
 * .the predicate — an ORPHAN, never a delta:
 *
 *   an entry EXISTS that is FRESH and carries NO run id at all
 *   dirs matched by OUR id  ==  0
 *   ────────────────────────────
 *   ⇒ the chain is broken
 *
 * .why an orphan and not a delta = a delta over the root ("the dir count grew")
 *      attributes a LIVE PEER's dirs to us, so a scoped run beside a peer would
 *      throw on a perfectly healthy run. a peer's dir carries the PEER's id, so it
 *      can never satisfy the orphan term — the false positive is excluded BY
 *      CONSTRUCTION rather than by a sharper check
 *
 * .and it subsumes a third term = a consumer who kept a hand-rolled afterEach
 *      teardown has already deleted our dirs before we look, so they leave no
 *      entry to find. their healthy run is silent here, where a delta form would
 *      have told them to file an issue against us
 *
 * .FRESH means "made since THIS run began", never "within the age window". an age
 *      window as wide as the gate's would trip on any unhooked run of the past day —
 *      residue that is genuinely someone else's, and genuinely no evidence about our
 *      own chain. the run's own startedAt is the only honest boundary
 *
 * @throws MalfunctionError when the chain is broken
 */
export const assertMintChainHeld = (input: {
  tmpDir: string;
  run: string;
  /** when this run began; a dir older than this is not ours to judge */
  since: Date;
  /**
   * the runner in play — REQUIRED
   *
   * .why = this runs in the MAIN process, where no runner env var is set, and the
   *        report's whole value is that it NAMES the version a maintainer must look
   *        at. an optional runner degrades that to 'unknown' in the one report that
   *        cannot afford it
   */
  runner: TestRunner;
}): void => {
  if (!fs.existsSync(input.tmpDir)) return;

  const namesDir = fs
    .readdirSync(input.tmpDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  // term 2 — did any dir at all carry OUR id?
  const countMatched = namesDir.filter(
    (name) => asTempDirRun({ dirName: name }) === input.run,
  ).length;
  if (countMatched > 0) return;

  // term 1 — is there a dir made SINCE WE BEGAN that carries NO id at all?
  const namesOrphan = namesDir
    .filter((name) => asTempDirRun({ dirName: name }) === null)
    .filter((name) =>
      isMadeSince({ tmpDir: input.tmpDir, name, since: input.since }),
    );
  if (namesOrphan.length === 0) return;

  // 🔴 the body is a TREESTRUCT, in the same family as every other report this
  //    behavior emits — not a raw metadata dump. a dump would make the one message
  //    a human meets at the worst moment the one message rendered in a shape no
  //    other here uses, so a reader must re-orient at exactly the wrong time
  //    (rule.require.treestruct-output)
  //
  // .note = the facts live in the MESSAGE rather than in `helpful-errors`
  //         metadata, and that is deliberate. this error is thrown to be UNCAUGHT
  //         — it ends the run on purpose (`case=10`) — so its only reader is a
  //         human at a terminal. metadata would render the same five facts a
  //         second time, as JSON, below the tree a human just read
  //
  // .note = the 💥 STAYS, and it is the one place this behavior departs from 🧹.
  //         every other message here is a notice the run survives; this one means
  //         the run is over and the reclaim silently matches zero from here on. a
  //         fatal event that wears the same badge as eight benign ones is a label
  //         that reads two ways, which is the defect rather than the consistency
  //         (rule.forbid.ambiguous-labels)
  //
  // .note = 🧹 is the SPEAKER, never a claim that a sweep ran. it names the
  //         reclaim subsystem as the voice, the way 🐢 names ehmpathy elsewhere in
  //         this repo (`.github/actions/please-release`). so it heads a message
  //         about a sweep that never fired, one that half-fired, and one that was
  //         deliberately held — all three are the sweep SPEAKING. the axis it
  //         varies on is survival (🧹 vs 💥), never topic
  MalfunctionError.throw(
    [
      'test-fns: the temp-dir run stamp never reached the workers that allocated dirs',
      `   ├─ run: ${input.run} — matched ${countMatched} of its own dirs`,
      ...namesOrphan.map((name) => `   ├─ orphan: ${name}`),
      `   ├─ node: ${process.version}`,
      `   ├─ runner: ${getOneRunnerVersion({ runner: input.runner })}`,
      '   ├─ cause: dirs landed UNSTAMPED, so the run-scoped reclaim would match',
      '   │         zero and the leak would resume under a green suite. the run id',
      '   │         rides process.env from the global setup down to the workers;',
      '   │         a runner upgrade may have broken that handoff.',
      '   └─ fix: report this with the node and runner versions named above.',
    ].join('\n'),
  );
};

/**
 * .what = tells whether a dir was made since this run began
 * .why = an unstamped dir that predates us is an unhooked run's residue, not our
 *        broken chain. only a dir born INSIDE our own window is evidence about us
 */
const isMadeSince = (input: {
  tmpDir: string;
  name: string;
  since: Date;
}): boolean => {
  try {
    const stat = fs.statSync(path.join(input.tmpDir, input.name));
    return stat.mtimeMs >= input.since.getTime();
  } catch {
    return false;
  }
};
