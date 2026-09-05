import { asTempDirTimestamp } from './computeTempDirName';

/**
 * represents a directory entry in the .temp folder
 */
export interface DirEntry {
  /** directory name */
  name: string;
  /** absolute path */
  path: string;
}

/**
 * .what = splits directories into the aged, the young, and the unreadable
 * .why = enables prune to target only stale directories — and to REPORT the ones
 *        whose names it could not parse, rather than preserve them in silence
 *
 * .note = an unreadable name is preserved, which is correct: we cannot judge the
 *         age of a name we cannot read, and a wrong reap is loss. but the SILENCE
 *         was the defect — a mint that produced unparseable names would turn this
 *         gate off entirely, and every run would still look green
 */
export const computeStaleDirs = (input: {
  dirs: DirEntry[];
  maxAgeMs: number;
  /**
   * the moment the age is judged from
   *
   * .note = REQUIRED. every caller already supplied it, so the optional bought no
   *         caller anything and cost the reader a branch — and it left this input
   *         shaped unlike its two siblings on the arrears path, which is the shape
   *         the next author copies
   */
  now: Date;
}): { stale: DirEntry[]; unreadable: DirEntry[] } => {
  const now = input.now;

  const stale: DirEntry[] = [];
  const unreadable: DirEntry[] = [];

  for (const dir of input.dirs) {
    // parse timestamp from directory name
    const timestamp = asTempDirTimestamp({ dirName: dir.name });

    // a name we cannot read is preserved — and counted, never hidden
    if (!timestamp) {
      unreadable.push(dir);
      continue;
    }

    // check if directory is older than threshold
    const ageMs = now.getTime() - timestamp.getTime();
    if (ageMs > input.maxAgeMs) stale.push(dir);
  }

  return { stale, unreadable };
};
