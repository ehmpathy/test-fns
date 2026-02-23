import { spawnSync } from 'node:child_process';

/**
 * .what = initializes a git repository with repo-local user config
 * .why = enables ci-safe git repos without global git config dependency
 *
 * @example
 * initGitRepo({ dir: '/tmp/my-test-dir' });
 * // creates .git/, sets user.name='test-fns', user.email='test-fns@test.local'
 */
export const initGitRepo = (input: {
  dir: string;
  user?: {
    name?: string;
    email?: string;
  };
}): void => {
  const userName = input.user?.name ?? 'test-fns';
  const userEmail = input.user?.email ?? 'test-fns@test.local';

  // initialize git repo
  spawnSync('git', ['init'], { cwd: input.dir, stdio: 'pipe' });

  // configure repo-local user identity (ci-safe)
  spawnSync('git', ['config', 'user.name', userName], {
    cwd: input.dir,
    stdio: 'pipe',
  });
  spawnSync('git', ['config', 'user.email', userEmail], {
    cwd: input.dir,
    stdio: 'pipe',
  });
};
