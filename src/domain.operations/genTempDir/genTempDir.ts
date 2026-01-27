import * as path from 'node:path';
import { genIsolatedTempInfra } from '../../infra/isomorph.fs/genIsolatedTempInfra';
import { getGitRoot } from '../../infra/isomorph.fs/getGitRoot';
import { genEphemeralTempDir } from './genEphemeralTempDir';
import { pruneStaleOnce } from './pruneStale';

/**
 * regex pattern that matches temp directory names
 * format: {isoTimestamp}.{slug}.{8-char-hex-uuid}
 */
const TEMP_DIR_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\..+\.[a-f0-9]{8}$/i;

/**
 * .what = checks if a path is a temp directory created by genTempDir
 * .why = enables validation and identification of temp directories
 *
 * @example
 * isTempDir({ path: '/repo/.temp/genTempDir.symlink/2026-01-19T12-34-56.789Z.my-test.a1b2c3d4' }); // true
 * isTempDir({ path: '/tmp/test-fns/my-repo/.temp/2026-01-19T12-34-56.789Z.my-test.a1b2c3d4' }); // true
 * isTempDir({ path: '/tmp/random' }); // false
 */
export const isTempDir = (input: { path: string }): boolean => {
  const dirName = path.basename(input.path);
  return TEMP_DIR_PATTERN.test(dirName);
};

/**
 * .what = generates a temporary directory isolated from gitroot module resolution
 * .why = provides portable temp directory creation with automatic cleanup
 *
 * @returns the link path (within @gitroot/.temp/genTempDir.symlink/) for observability
 *
 * @example
 * // basic usage - empty dir
 * const dir = genTempDir({ slug: 'my-test' });
 * // => /path/to/repo/.temp/genTempDir.symlink/2026-01-19T12-34-56.789Z.my-test.a1b2c3d4
 * // (physical files at /tmp/test-fns/{repo}/.temp/...)
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
 * @note
 * - physical files stored at /tmp/test-fns/{repo}/.temp/ (isolated from node_modules)
 * - symlink at @gitroot/.temp/genTempDir.symlink/ for discoverability
 * - directories are auto-pruned after 7 days
 * - timestamp prefix enables age-based cleanup without stat calls
 * - slug helps debuggers identify which test created the directory
 */
export const genTempDir = (input: {
  slug: string;
  clone?: string;
  symlink?: Array<{ at: string; to: string }>;
}): string => {
  // get git root
  const gitRoot = getGitRoot();

  // ensure isolated temp infrastructure exists
  const tempInfra = genIsolatedTempInfra({ gitRoot });

  // trigger background prune (max once per process)
  void pruneStaleOnce({ tmpDir: tempInfra.pathPhysical });

  // create ephemeral temp directory
  const dirName = genEphemeralTempDir({
    slug: input.slug,
    clone: input.clone,
    symlink: input.symlink,
    tempInfra: { pathPhysical: tempInfra.pathPhysical },
    gitRoot,
  });

  // return link path for observability
  return path.join(tempInfra.pathSymlink, dirName);
};
