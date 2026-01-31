/**
 * git options for temp directory initialization
 */
export interface GitOptions {
  commits?: {
    init?: boolean;
    fixture?: boolean;
  };
}

/**
 * defaults for git initialization
 */
const GIT_DEFAULTS = {
  commits: {
    init: true,
    fixture: true,
  },
};

/**
 * .what = converts git option to explicit form with defaults applied
 * .why = handles boolean shorthand and applies defaults
 */
export const asExplicitGitOptions = (
  git: boolean | GitOptions | undefined,
): { commits: { init: boolean; fixture: boolean } } | null => {
  if (!git) return null;
  if (git === true) return GIT_DEFAULTS;
  return {
    commits: {
      init: git.commits?.init ?? GIT_DEFAULTS.commits.init,
      fixture: git.commits?.fixture ?? GIT_DEFAULTS.commits.fixture,
    },
  };
};
