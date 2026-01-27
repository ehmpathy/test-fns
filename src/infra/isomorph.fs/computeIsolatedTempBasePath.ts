import * as path from 'node:path';

/**
 * .what = computes the isolated temp base path in /tmp/
 * .why = provides consistent location outside of any repo's module resolution
 *
 * @example
 * computeIsolatedTempBasePath({ gitRoot: '/home/user/my-project' })
 * // => '/tmp/test-fns/my-project/.temp'
 */
export const computeIsolatedTempBasePath = (input: {
  gitRoot: string;
}): string => {
  // extract repo directory name from gitRoot path
  const repoDirname = path.basename(input.gitRoot);

  // compose isolated path: /tmp/test-fns/{repo-dirname}/.temp
  return path.join('/tmp', 'test-fns', repoDirname, '.temp');
};
