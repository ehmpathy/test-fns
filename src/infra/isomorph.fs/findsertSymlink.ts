import { UnexpectedCodePathError } from 'helpful-errors';

import * as fs from 'node:fs';
import { isSymlinkEexistError } from './isSymlinkEexistError';

/**
 * .what = result of findsertSymlink operation
 * .why = observability into which code path was taken for tests and debug
 */
export interface FindsertSymlinkResult {
  /** whether the symlink was created or already found */
  effect: 'created' | 'found';
  /** race condition that was overcome, if any */
  overcame: 'EEXIST' | 'ENOENT' | null;
}

/**
 * .what = creates a symlink if absent, no-op if correct symlink exists
 * .why = idempotent symlink creation safe for parallel workers
 *
 * .note = handles three race scenarios:
 *   1. EEXIST: another worker created symlink → verify target, return if correct
 *   2. ENOENT on verify: another worker deleted symlink → retry
 *   3. stale symlink/file: remove and create
 *
 * @throws UnexpectedCodePathError if path exists but is not the expected symlink
 */
export const findsertSymlink = (input: {
  target: string;
  path: string;
}): FindsertSymlinkResult => {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // check if correct symlink already exists
    const stat = (() => {
      try {
        return fs.lstatSync(input.path);
      } catch {
        return null;
      }
    })();

    if (stat?.isSymbolicLink()) {
      try {
        const currentTarget = fs.readlinkSync(input.path);
        if (currentTarget === input.target) {
          return { effect: 'found', overcame: null }; // correct symlink exists
        }
      } catch (error) {
        // symlink deleted between lstat and readlink — retry
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') continue;
        throw error;
      }
    }

    // remove stale symlink, directory, or file
    if (stat) {
      fs.rmSync(input.path, { recursive: true, force: true });
    }

    // create symlink
    try {
      fs.symlinkSync(input.target, input.path);
      return { effect: 'created', overcame: null }; // success
    } catch (error) {
      // handle race: another worker created symlink between our check and create
      if (!isSymlinkEexistError(error)) throw error;

      // another worker created symlink — verify it's correct
      try {
        const raceStat = fs.lstatSync(input.path);
        if (raceStat.isSymbolicLink()) {
          const currentTarget = fs.readlinkSync(input.path);
          if (currentTarget === input.target) {
            return { effect: 'found', overcame: 'EEXIST' }; // correct symlink created by another worker
          }
        }

        throw new UnexpectedCodePathError(
          'symlink exists but points to unexpected target',
          {
            target: input.target,
            path: input.path,
            isSymlink: raceStat.isSymbolicLink(),
          },
        );
      } catch (verifyError) {
        // symlink deleted between EEXIST and verify — retry
        const code = (verifyError as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') continue;
        throw verifyError;
      }
    }
  }

  throw new UnexpectedCodePathError(
    'findsertSymlink exceeded max retries due to concurrent deletes',
    { target: input.target, path: input.path, maxRetries: MAX_RETRIES },
  );
};
