import * as fs from 'node:fs';
import * as path from 'node:path';
import { cloneFixture } from '../../infra/isomorph.fs/cloneFixture';
import { ensureTempDir } from '../../infra/isomorph.fs/ensureTempDir';
import { getGitRoot } from '../../infra/isomorph.fs/getGitRoot';
import { computeTempDirName } from './computeTempDirName';
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
 * isTempDir({ path: '/repo/.temp/2026-01-19T12-34-56.789Z.my-test.a1b2c3d4' }); // true
 * isTempDir({ path: '/tmp/random' }); // false
 */
export const isTempDir = (input: { path: string }): boolean => {
  const dirName = path.basename(input.path);
  return TEMP_DIR_PATTERN.test(dirName);
};

/**
 * .what = generates a temporary directory within the repo's .temp folder
 * .why = provides portable temp directory creation with automatic cleanup
 *
 * @example
 * // basic usage - empty dir
 * const dir = genTempDir({ slug: 'my-test' });
 * // => /path/to/repo/.temp/2026-01-19T12-34-56.789Z.my-test.a1b2c3d4
 *
 * @example
 * // with fixture clone
 * const dir = genTempDir({ slug: 'clone-test', clone: './src/__fixtures__/example' });
 * // => dir contains copy of fixture contents
 *
 * @note
 * - directories are auto-pruned after 7 days
 * - timestamp prefix enables age-based cleanup without stat calls
 * - slug helps debuggers identify which test created the directory
 * - safe on macos and ubuntu without os-specific temp dir dependencies
 */
export const genTempDir = (input: { slug: string; clone?: string }): string => {
  // get git root
  const gitRoot = getGitRoot();

  // ensure .temp directory exists
  const baseDir = ensureTempDir({ gitRoot });

  // compute unique directory name
  const dirName = computeTempDirName({ slug: input.slug });

  // create the temp directory
  const tempDir = path.join(baseDir, dirName);
  fs.mkdirSync(tempDir, { recursive: true });

  // trigger background prune (max once per process)
  void pruneStaleOnce({ tmpDir: baseDir });

  // clone fixture if requested
  if (input?.clone) {
    // resolve clone path relative to cwd
    const clonePath = path.resolve(process.cwd(), input.clone);
    cloneFixture({ from: clonePath, to: tempDir });
  }

  return tempDir;
};
