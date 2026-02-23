import { given, then, when } from '@src/domain.operations/givenWhenThen';

import { computeIsolatedTempBasePath } from './computeIsolatedTempBasePath';

describe('computeIsolatedTempBasePath', () => {
  given('[case1] a standard gitRoot path', () => {
    when('[t0] we compute the isolated temp base path', () => {
      then('it returns /tmp/test-fns/{repo-dirname}/.temp', () => {
        const result = computeIsolatedTempBasePath({
          gitRoot: '/home/user/my-project',
        });
        expect(result).toEqual('/tmp/test-fns/my-project/.temp');
      });
    });
  });

  given('[case2] a gitRoot with nested path', () => {
    when('[t0] we compute the isolated temp base path', () => {
      then('it extracts only the final directory name', () => {
        const result = computeIsolatedTempBasePath({
          gitRoot: '/home/user/repos/deeply/nested/awesome-lib',
        });
        expect(result).toEqual('/tmp/test-fns/awesome-lib/.temp');
      });
    });
  });

  given('[case3] a gitRoot with special characters in name', () => {
    when('[t0] we compute the isolated temp base path', () => {
      then('it preserves the directory name as-is', () => {
        const result = computeIsolatedTempBasePath({
          gitRoot: '/home/user/my-project.v2',
        });
        expect(result).toEqual('/tmp/test-fns/my-project.v2/.temp');
      });
    });
  });

  given('[case4] a gitRoot that is a worktree path', () => {
    when('[t0] we compute the isolated temp base path', () => {
      then('it uses the worktree directory name', () => {
        const result = computeIsolatedTempBasePath({
          gitRoot: '/home/user/repos/_worktrees/test-fns.feature-branch',
        });
        expect(result).toEqual('/tmp/test-fns/test-fns.feature-branch/.temp');
      });
    });
  });
});
