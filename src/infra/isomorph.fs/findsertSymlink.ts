import { UnexpectedCodePathError } from 'helpful-errors';

import * as fs from 'node:fs';
import { isSymlinkEexistError } from './isSymlinkEexistError';

/**
 * .what = creates a symlink if absent, no-op if correct symlink exists
 * .why = idempotent symlink creation safe for parallel workers
 *
 * @throws UnexpectedCodePathError if path exists but is not the expected symlink
 */
export const findsertSymlink = (input: {
  target: string;
  path: string;
}): void => {
  // check if correct symlink already exists
  const stat = (() => {
    try {
      return fs.lstatSync(input.path);
    } catch {
      return null;
    }
  })();

  if (stat?.isSymbolicLink()) {
    const currentTarget = fs.readlinkSync(input.path);
    if (currentTarget === input.target) {
      return; // correct symlink exists
    }
  }

  // remove stale symlink, directory, or file
  if (stat) {
    fs.rmSync(input.path, { recursive: true, force: true });
  }

  // create symlink
  try {
    fs.symlinkSync(input.target, input.path);
  } catch (error) {
    // handle race: another worker created symlink between our check and create
    if (!isSymlinkEexistError(error)) throw error;

    // another worker created symlink — verify it's correct
    const raceStat = fs.lstatSync(input.path);
    if (raceStat.isSymbolicLink()) {
      const currentTarget = fs.readlinkSync(input.path);
      if (currentTarget === input.target) {
        return; // correct symlink created by another worker
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
  }
};
