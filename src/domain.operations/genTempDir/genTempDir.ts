import { genIsolatedTempInfra } from '@src/infra/isomorph.fs/genIsolatedTempInfra';
import { getGitRoot } from '@src/infra/isomorph.fs/getGitRoot';

import * as path from 'node:path';
import { genEphemeralTempDir } from './genEphemeralTempDir';
import { pruneStaleOnce } from './pruneStale';

/**
 * .what = generates a temporary directory isolated from gitroot module resolution
 * .why = provides portable temp directory creation with automatic cleanup
 *
 * @returns the link path (within @gitroot/.temp/genTempDir.symlink/) for observability
 *
 * @example
 * // basic usage - empty dir
 * const dir = genTempDir({ slug: 'my-test' });
 * // => /path/to/repo/.temp/genTempDir.symlink/2026-01-19T12-34-56.789Z.r7f3a91c2.my-test.a1b2c3d4
 * //                                           └── when ───────────┘ └ whose ┘ └ what ┘ └ which ┘
 * // (physical files at /tmp/test-fns/{repo}/.temp/...)
 * //
 * // .note = `r7f3a91c2` is THIS RUN's id, and it is what lets the run's own
 * //         teardown reclaim exactly its own dirs and no peer's. an UNHOOKED run
 * //         mints no id, so its names carry three segments rather than four —
 * //         both shapes are admitted by isTempDir, which is the filter to count with
 *
 * @example
 * // with fixture clone
 * const dir = genTempDir({ slug: 'clone-test', clone: './src/__fixtures__/example' });
 * // => dir contains copy of fixture contents
 *
 * @example
 * // with symlinks to repo root
 * const dir = genTempDir({
 *   slug: 'symlink-test',
 *   symlink: [
 *     { at: 'config/settings.json', to: 'src/config/defaults.json' },
 *     { at: 'node_modules', to: 'node_modules' },
 *   ],
 * });
 * // => dir contains symlinks that reference repo root paths
 *
 * @example
 * // with git initialization
 * const dir = genTempDir({
 *   slug: 'git-test',
 *   clone: './src/__fixtures__/example',
 *   git: true,
 * });
 * // => dir is a git repo with 'began' and 'fixture' commits
 *
 * @example
 * // git repo without auto-commits
 * const dir = genTempDir({
 *   slug: 'git-dirty-test',
 *   clone: './src/__fixtures__/example',
 *   git: { commits: { init: false } },
 * });
 * // => dir is a git repo with no commits (work tree is dirty)
 *
 * @note
 * - physical files stored at /tmp/test-fns/{repo}/.temp/ (isolated from node_modules)
 * - symlink at @gitroot/.temp/genTempDir.symlink/ for discoverability
 * - a run that wires the autoprune hooks reclaims its OWN dirs at its teardown
 * - the age gate is the BACKSTOP, at 24h by default (TEST_FNS_MAX_AGE_MS to change)
 * - a run with no hooks wired gets the age gate alone, plus a one-time notice
 * - timestamp prefix enables age-based cleanup without stat calls
 * - slug helps debuggers identify which test created the directory
 * - git: true initializes a git repo with repo-local user config (ci-safe)
 * - git 'began' commit is created before clone/symlinks (empty commit)
 * - git 'fixture' commit is created after clone/symlinks (if content exists)
 */
export const genTempDir = (input: {
  slug: string;
  clone?: string;
  symlink?: Array<{ at: string; to: string }>;
  git?:
    | boolean
    | {
        commits?: {
          /** create empty 'began' commit after git init (default: true) */
          init?: boolean;
          /** commit clone/symlink content as 'fixture' (default: true) */
          fixture?: boolean;
        };
      };
}): string => {
  // get git root
  const gitRoot = getGitRoot();

  // ensure isolated temp infrastructure exists
  const tempInfra = genIsolatedTempInfra({ gitRoot });

  // the age gate. unconditional — `pruneStaleOnce` owns the skip, keyed on a
  // stamp of the sweep itself (`rule.require.fewer-paths-via-idempotency`)
  void pruneStaleOnce({ tmpDir: tempInfra.pathPhysical });

  // create ephemeral temp directory; it stamps itself with this run's id
  const dirName = genEphemeralTempDir({
    slug: input.slug,
    clone: input.clone,
    symlink: input.symlink,
    git: input.git,
    tempInfra: { pathPhysical: tempInfra.pathPhysical },
    gitRoot,
  });

  // return link path for observability
  return path.join(tempInfra.pathSymlink, dirName);
};
