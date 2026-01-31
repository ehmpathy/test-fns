import { execSync } from 'node:child_process';

/**
 * .what = stages all changes and commits with the given message
 * .why = encapsulates git add + commit for reuse in genTempDir
 *
 * @example
 * commitGitChanges({ dir: '/tmp/my-repo', message: 'initial' });
 *
 * @example
 * // empty commit (no files)
 * commitGitChanges({ dir: '/tmp/my-repo', message: 'began', allowEmpty: true });
 */
export const commitGitChanges = (input: {
  dir: string;
  message: string;
  allowEmpty?: boolean;
}): void => {
  const allowEmptyFlag = input.allowEmpty ? '--allow-empty' : '';

  // stage all changes
  execSync('git add .', { cwd: input.dir, stdio: 'pipe' });

  // commit with message
  execSync(`git commit ${allowEmptyFlag} -m "${input.message}"`, {
    cwd: input.dir,
    stdio: 'pipe',
  });
};
