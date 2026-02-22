import { UnexpectedCodePathError } from 'helpful-errors';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeIsolatedTempBasePath } from './computeIsolatedTempBasePath';

const TEMP_README_CONTENT = `# genTempDir.symlink

this directory is a symlink to the physical temp directory at \`/tmp/test-fns/{repo}/.temp/\`.

## why a symlink?

physical temp directories are stored in \`/tmp/\` to isolate them from the repo's \`node_modules\` and \`package.json\`.
this prevents upward module resolution from discovery of gitroot dependencies.

## cleanup policy

- directories older than 7 days are automatically pruned
- prune occurs in the background when \`genTempDir()\` is called
- directory names are prefixed with timestamps for age-based cleanup

## safe to delete

all contents of this directory can be safely deleted at any time.
temp directories are ephemeral and should not contain important data.
`;

/**
 * .what = ensures the isolated temp infrastructure exists
 * .why = creates physical storage in /tmp/ with symlink at gitroot for discoverability
 *
 * .note = symlink creation is idempotent — safe to call from parallel workers
 *
 * @throws UnexpectedCodePathError if /tmp/ does not exist
 */
export const genIsolatedTempInfra = (input: {
  gitRoot: string;
}): { pathPhysical: string; pathSymlink: string } => {
  // validate /tmp/ exists (fail fast for non-unix systems)
  if (!fs.existsSync('/tmp')) {
    throw new UnexpectedCodePathError(
      'genTempDir requires /tmp/ directory (unix systems only)',
      { gitRoot: input.gitRoot },
    );
  }

  // compute paths
  const pathPhysical = computeIsolatedTempBasePath({ gitRoot: input.gitRoot });
  const pathGitRootTemp = path.join(input.gitRoot, '.temp');
  const pathSymlink = path.join(pathGitRootTemp, 'genTempDir.symlink');

  // ensure @gitroot/.temp/ dir exists
  if (!fs.existsSync(pathGitRootTemp)) {
    fs.mkdirSync(pathGitRootTemp, { recursive: true });
  }

  // ensure physical dir exists: /tmp/test-fns/{repo-dirname}/.temp/
  if (!fs.existsSync(pathPhysical)) {
    fs.mkdirSync(pathPhysical, { recursive: true });
  }

  // write readme.md to physical dir if absent
  const readmePath = path.join(pathPhysical, 'readme.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, TEMP_README_CONTENT);
  }

  // write .gitignore to physical dir if absent (ignore all temp directories)
  const gitignorePath = path.join(pathPhysical, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*\n');
  }

  // ensure symlink at @gitroot/.temp/genTempDir.symlink
  const symlinkStat = fs.existsSync(pathSymlink)
    ? fs.lstatSync(pathSymlink)
    : null;

  if (symlinkStat) {
    // check if it's a symlink
    if (symlinkStat.isSymbolicLink()) {
      // verify target matches, update if stale
      const currentTarget = fs.readlinkSync(pathSymlink);
      if (currentTarget !== pathPhysical) {
        fs.unlinkSync(pathSymlink);
        fs.symlinkSync(pathPhysical, pathSymlink);
      }
    } else if (symlinkStat.isDirectory()) {
      // if directory found, remove it (contents ephemeral) and create symlink
      fs.rmSync(pathSymlink, { recursive: true, force: true });
      fs.symlinkSync(pathPhysical, pathSymlink);
    } else {
      // if file found, remove it and create symlink
      fs.unlinkSync(pathSymlink);
      fs.symlinkSync(pathPhysical, pathSymlink);
    }
  } else {
    // symlink absent, create it idempotently (race-safe for parallel workers)
    try {
      fs.symlinkSync(pathPhysical, pathSymlink);
    } catch (error) {
      // handle race: another worker created symlink between check and create
      if (!(error instanceof Error)) throw error;
      if (!error.message.includes('EEXIST')) throw error;

      // verify symlink was created by another worker with expected target
      const stat = fs.lstatSync(pathSymlink);
      if (!stat.isSymbolicLink()) {
        // not a symlink (file or dir) — remove and retry
        fs.rmSync(pathSymlink, { recursive: true, force: true });
        fs.symlinkSync(pathPhysical, pathSymlink);
      } else {
        // is a symlink — verify target
        const currentTarget = fs.readlinkSync(pathSymlink);
        if (currentTarget !== pathPhysical) {
          // stale target — update
          fs.unlinkSync(pathSymlink);
          fs.symlinkSync(pathPhysical, pathSymlink);
        }
        // else: correct symlink already extant — idempotent success
      }
    }
  }

  return { pathPhysical, pathSymlink };
};
