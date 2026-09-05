import { UnexpectedCodePathError } from 'helpful-errors';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeIsolatedTempBasePath } from './computeIsolatedTempBasePath';
import { findsertFile } from './findsertFile';
import { findsertSymlink } from './findsertSymlink';
import { upsertFile } from './upsertFile';

const TEMP_README_CONTENT = `# genTempDir.symlink

this directory is a symlink to the physical temp directory at \`/tmp/test-fns/{repo}/.temp/\`.

## why a symlink?

physical temp directories are stored in \`/tmp/\` to isolate them from the repo's \`node_modules\` and \`package.json\`.
this prevents upward module resolution from discovery of gitroot dependencies.

## cleanup policy

the policy is a run's own teardown; the age gate is only the backstop.

- **the policy** — each test run stamps its dirs with a run id, and the runner's own
  \`globalTeardown\` reclaims exactly those, within the run. wire it with:
  - jest: \`globalSetup: 'test-fns/autoprune.setup.jest'\` + \`globalTeardown: 'test-fns/autoprune.teardown.jest'\`
  - vitest: \`globalSetup: ['test-fns/autoprune.setup.vitest']\`
- **the backstop** — directories older than 24 hours are pruned, to catch what a
  signal, an OOM, or an unwired runner leaves behind. widen it with \`TEST_FNS_MAX_AGE_MS\`
- **the hold hatch** — set \`TEST_FNS_KEEP\` to keep a run's dirs for inspection
- **the unwired fallback** — the backstop also fires in the background when
  \`genTempDir()\` is called, which is the only reclaim an unwired consumer has
- **the dir name** — shaped \`{timestamp}.{run}.{slug}.{8-char-uuid}\`. the timestamp
  is what the backstop reads, and the run stamp is what a run's own teardown matches

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

  // upsert readme.md to physical dir
  // .note = UPSERT, never findsert. this doc's content changes whenever we change
  //         it, so a findsert would THROW on every consumer whose temp root
  //         predates the upgrade — deep inside their own test, on a readme edit
  upsertFile({
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
