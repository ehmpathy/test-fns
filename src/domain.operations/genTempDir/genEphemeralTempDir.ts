import { cloneFixture } from '@src/infra/isomorph.fs/cloneFixture';
import { commitGitChanges } from '@src/infra/isomorph.fs/commitGitChanges';
import { createSymlinks } from '@src/infra/isomorph.fs/createSymlinks';
import { initGitRepo } from '@src/infra/isomorph.fs/initGitRepo';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { asExplicitGitOptions, type GitOptions } from './asExplicitGitOptions';
import { computeTempDirName } from './computeTempDirName';
import { getOneRunId } from './getOneRunId';
import { isOwnRunMinted } from './isOwnRunMinted';
import { warnIfUnhooked } from './warnIfUnhooked';

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
  // the run stamp is read HERE, at the allocation, never handed down by a caller
  // .why = the guarantee must live with the allocation, so no call site can forget.
  //        a caller-supplied stamp leaks unstamped dirs from every caller that is
  //        not genTempDir — which our own suite proved within an hour of the wire-up
  const run = getOneRunId();
  // 🔴 an absent id has TWO causes, and only one of them is the consumer's fault:
  //
  //    genuinely unhooked  → their config wants the two keys. say so
  //    a BROKEN MINT CHAIN → our setup ran and the id did not arrive. OURS
  //
  // by env those states are identical, so this notice fired on both — and told a
  // wired consumer to add config they had already added, for a defect of ours.
  // `isOwnRunMinted` reads the disk, which CAN tell them apart, and the broken
  // chain already has its own loud, correct report at the teardown
  if (!run && !isOwnRunMinted({ tmpDir: input.tempInfra.pathPhysical }))
    warnIfUnhooked({ reason: 'setup-absent' });

  // compute unique directory name (throws if it does not parse back)
  const dirName = computeTempDirName({ slug: input.slug, run });

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
  if (gitOptions?.commits.fixture && hasContent) {
    commitGitChanges({ dir: tempDir, message: 'fixture' });
  }

  return dirName;
};
