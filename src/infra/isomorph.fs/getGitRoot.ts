import { UnexpectedCodePathError } from 'helpful-errors';

import { execSync } from 'node:child_process';

/**
 * .what = finds the git repository root from current directory
 * .why = enables portable path resolution relative to repo root
 *
 * @throws UnexpectedCodePathError when not in a git repository
 */
export const getGitRoot = (): string => {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
    }).trim();

    if (!gitRoot) {
      throw new UnexpectedCodePathError('git rev-parse returned empty result', {
        cwd: process.cwd(),
      });
    }

    return gitRoot;
  } catch (error) {
    if (!(error instanceof Error)) throw error;

    // check if it's a "not a git repo" error
    if (error.message.includes('not a git repository')) {
      throw new UnexpectedCodePathError(
        'getGitRoot called outside of a git repository',
        { cwd: process.cwd() },
      );
    }

    throw error;
  }
};
