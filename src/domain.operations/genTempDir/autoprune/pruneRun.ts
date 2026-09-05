// .note = RELATIVE, never the @src alias. this module sits on the globalTeardown
//         path, which jest loads OUTSIDE its moduleNameMapper

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Residue } from '../../../domain.objects/Residue';
import { asErrno } from '../asErrno';
import { asTempDirRun } from '../computeTempDirName';

/**
 * .what = the account of one run-scoped reclaim
 * .why = the caller must be able to assert what the reclaim CONSIDERED, not
 *        only what it removed — a reclaim that considers every dir and then
 *        filters reads identically to one whose candidate set is narrow at the
 *        source, and only the former can reap a live peer's work
 */
export interface PruneRunAudit {
  /** every dir name the reclaim treated as a candidate */
  candidatesConsidered: string[];

  /** the dirs it removed */
  reclaimed: string[];

  /** the dirs it could not remove, each with the reason */
  residue: Residue[];
}

/**
 * .what = removes exactly the temp dirs whose name carries this run's id
 * .why = ownership is established by the NAME, so a peer run's live dirs are
 *        never candidates — peer-safety is a property of the filter's source,
 *        not of a liveness probe that can race or a lock that can leak
 *
 * .note = it reaps every dir it can FIRST, then reports the residue. a reclaim
 *         that stops at the first EACCES leaves behind dirs it could have taken
 *
 * @returns the audit — what it considered, what it took, what resisted
 */
export const pruneRun = async (input: {
  tmpDir: string;
  run: string;
}): Promise<PruneRunAudit> => {
  // a root that does not exist holds no dirs of ours
  if (!fs.existsSync(input.tmpDir))
    return { candidatesConsidered: [], reclaimed: [], residue: [] };

  // the candidate set is narrow AT THE SOURCE: only dirs our own id stamps
  const candidatesConsidered = fs
    .readdirSync(input.tmpDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => asTempDirRun({ dirName: name }) === input.run);

  // reap every dir we can, then report — never stop at the first refusal
  const reclaimed: string[] = [];
  const residue: PruneRunAudit['residue'] = [];
  for (const name of candidatesConsidered) {
    const pathDir = path.join(input.tmpDir, name);
    try {
      fs.rmSync(pathDir, { recursive: true, force: true });
      reclaimed.push(name);
    } catch (error) {
      residue.push({ path: pathDir, errno: asErrno({ error }) });
    }
  }

  return { candidatesConsidered, reclaimed, residue };
};
