import { UnexpectedCodePathError } from 'helpful-errors';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeIsolatedTempBasePath } from './computeIsolatedTempBasePath';
import { findsertFile } from './findsertFile';
import { findsertSymlink } from './findsertSymlink';

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
  fs.mkdirSync(pathGitRootTemp, { recursive: true });

  // ensure physical dir exists: /tmp/test-fns/{repo-dirname}/.temp/
  fs.mkdirSync(pathPhysical, { recursive: true });

  // findsert readme.md to physical dir
  findsertFile({
    path: path.join(pathPhysical, 'readme.md'),
    content: TEMP_README_CONTENT,
  });

  // findsert .gitignore to physical dir
  findsertFile({
    path: path.join(pathPhysical, '.gitignore'),
    content: '*\n',
  });

  // findsert symlink at @gitroot/.temp/genTempDir.symlink
  findsertSymlink({
    target: pathPhysical,
    path: pathSymlink,
  });

  return { pathPhysical, pathSymlink };
};
