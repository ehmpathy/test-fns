import * as fs from 'node:fs';
import * as path from 'node:path';
import { cloneFixture } from '../../infra/isomorph.fs/cloneFixture';
import { createSymlinks } from '../../infra/isomorph.fs/createSymlinks';
import { computeTempDirName } from './computeTempDirName';

/**
 * .what = creates an ephemeral temp directory with optional fixture clone and symlinks
 * .why = encapsulates per-call temp dir creation logic for reuse
 *
 * @returns the temp dir name (caller composes full path)
 */
export const genEphemeralTempDir = (input: {
  slug: string;
  clone?: string;
  symlink?: Array<{ at: string; to: string }>;
  tempInfra: { pathPhysical: string };
  gitRoot: string;
}): string => {
  // compute unique directory name
  const dirName = computeTempDirName({ slug: input.slug });

  // create the temp directory at physical path
  const tempDir = path.join(input.tempInfra.pathPhysical, dirName);
  fs.mkdirSync(tempDir, { recursive: true });

  // clone fixture if requested
  if (input?.clone) {
    // resolve clone path relative to cwd
    const clonePath = path.resolve(process.cwd(), input.clone);
    cloneFixture({ from: clonePath, to: tempDir });
  }

  // create symlinks if requested (after clone, so symlinks can augment cloned content)
  if (input?.symlink && input.symlink.length > 0) {
    createSymlinks({
      symlinks: input.symlink,
      tempDir,
      gitRoot: input.gitRoot,
    });
  }

  return dirName;
};
