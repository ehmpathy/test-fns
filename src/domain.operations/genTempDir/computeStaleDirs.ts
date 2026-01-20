import { parseTempDirTimestamp } from './computeTempDirName';

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
 * .what = filters directories to find those older than threshold
 * .why = enables prune to target only stale directories
 */
export const computeStaleDirs = (input: {
  dirs: DirEntry[];
  maxAgeMs: number;
  now?: Date;
}): DirEntry[] => {
  const now = input.now ?? new Date();

  return input.dirs.filter((dir) => {
    // parse timestamp from directory name
    const timestamp = parseTempDirTimestamp({ dirName: dir.name });

    // skip dirs with invalid/unparseable names (preserve them)
    if (!timestamp) return false;

    // check if directory is older than threshold
    const ageMs = now.getTime() - timestamp.getTime();
    return ageMs > input.maxAgeMs;
  });
};
