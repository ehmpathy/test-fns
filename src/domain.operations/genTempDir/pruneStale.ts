import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeStaleDirs, type DirEntry } from './computeStaleDirs';

const SEVEN_DAYS_MS: number = 7 * 24 * 60 * 60 * 1000;

/**
 * in-memory flag to ensure prune runs at most once per process
 *
 * .why = prevents redundant filesystem scans when genTempDir is called
 *        many times in quick succession (e.g., parallel tests)
 */
let prunedThisProcess = false;

/**
 * .what = removes directories older than threshold from tmpDir
 * .why = reclaims disk space from stale test directories
 */
export const pruneStale = async (input: {
  tmpDir: string;
  maxAgeMs?: number;
}): Promise<void> => {
  const maxAgeMs = input.maxAgeMs ?? SEVEN_DAYS_MS;

  // list directories in tmpDir
  if (!fs.existsSync(input.tmpDir)) return;

  const entries = fs.readdirSync(input.tmpDir, { withFileTypes: true });
  const dirs: DirEntry[] = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(input.tmpDir, entry.name),
    }));

  // compute which directories are stale
  const staleDirs = computeStaleDirs({ dirs, maxAgeMs });

  // remove stale directories
  for (const dir of staleDirs) {
    try {
      fs.rmSync(dir.path, { recursive: true, force: true });
    } catch {
      // ignore errors - best effort cleanup
    }
  }
};

/**
 * .what = runs pruneStale at most once per process
 * .why = prevents redundant filesystem scans across multiple genTempDir calls
 */
export const pruneStaleOnce = async (input: {
  tmpDir: string;
  maxAgeMs?: number;
}): Promise<void> => {
  // skip if already pruned this process
  if (prunedThisProcess) return;

  // set flag before prune (prevent race conditions)
  prunedThisProcess = true;

  // fire-and-forget prune (don't block)
  pruneStale({ tmpDir: input.tmpDir, maxAgeMs: input.maxAgeMs }).catch(() => {
    // ignore errors - prune is best-effort
  });
};

/**
 * .what = resets the prune throttle flag
 * .why = enables tests to verify throttle behavior
 *
 * @internal - only for test use
 */
export const resetPruneThrottle = (): void => {
  prunedThisProcess = false;
};

/**
 * .what = checks if prune has run this process
 * .why = enables tests to verify throttle behavior
 *
 * @internal - only for test use
 */
export const hasPrunedThisProcess = (): boolean => {
  return prunedThisProcess;
};
