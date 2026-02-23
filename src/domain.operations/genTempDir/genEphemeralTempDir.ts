import * as fs from 'node:fs';
import * as path from 'node:path';
import { cloneFixture } from '../../infra/isomorph.fs/cloneFixture';
import { commitGitChanges } from '../../infra/isomorph.fs/commitGitChanges';
import { createSymlinks } from '../../infra/isomorph.fs/createSymlinks';
import { initGitRepo } from '../../infra/isomorph.fs/initGitRepo';
import { asExplicitGitOptions, type GitOptions } from './asExplicitGitOptions';
import { computeTempDirName } from './computeTempDirName';

/**
 * .what = creates an ephemeral temp directory with optional fixture clone, symlinks, and git init
 * .why = encapsulates per-call temp dir creation logic for reuse
 *
 * @returns the temp dir name (caller composes full path)
 */
export const genEphemeralTempDir = (input: {
  slug: string;
  clone?: string;
  symlink?: Array<{ at: string; to: string }>;
  git?: boolean | GitOptions;
  tempInfra: { pathPhysical: string };
  gitRoot: string;
}): string => {
  // compute unique directory name
  const dirName = computeTempDirName({ slug: input.slug });

  // create the temp directory at physical path
  const tempDir = path.join(input.tempInfra.pathPhysical, dirName);
  fs.mkdirSync(tempDir, { recursive: true });

  // resolve git options
  const gitOptions = asExplicitGitOptions(input.git);

  // initialize git repo if requested
  if (gitOptions) {
    initGitRepo({ dir: tempDir });

    // create initial 'began' commit if requested
    if (gitOptions.commits.init) {
      commitGitChanges({ dir: tempDir, message: 'began', allowEmpty: true });
    }
  }

  // clone fixture if requested
  if (input.clone) {
    // resolve clone path relative to cwd
    const clonePath = path.resolve(process.cwd(), input.clone);
    cloneFixture({ from: clonePath, to: tempDir });
  }

  // create symlinks if requested (after clone, so symlinks can augment cloned content)
  if (input.symlink && input.symlink.length > 0) {
    createSymlinks({
      symlinks: input.symlink,
      tempDir,
      gitRoot: input.gitRoot,
    });
  }

  // create 'fixture' commit if git enabled, commits.fixture is true, and content was added
  const hasContent = !!(
    input.clone ||
    (input.symlink && input.symlink.length > 0)
  );
  if (gitOptions && gitOptions.commits.fixture && hasContent) {
    commitGitChanges({ dir: tempDir, message: 'fixture' });
  }

  return dirName;
};
