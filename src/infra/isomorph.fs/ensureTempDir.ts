import * as fs from 'node:fs';
import * as path from 'node:path';

const TEMP_README_CONTENT = `# .temp

this directory contains temporary directories created by \`genTempDir\`.

## cleanup policy

- directories older than 1 hour are automatically pruned
- prune occurs in the background when \`genTempDir()\` is called
- directory names are prefixed with timestamps for age-based cleanup

## safe to delete

all contents of this directory can be safely deleted at any time.
temp directories are ephemeral and should not contain important data.
`;

/**
 * .what = ensures the .temp directory exists at git root
 * .why = provides a consistent location for temp directories
 */
export const ensureTempDir = (input: { gitRoot: string }): string => {
  const tempDir = path.join(input.gitRoot, '.temp');

  // create .temp directory if absent
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // create readme.md if absent
  const readmePath = path.join(tempDir, 'readme.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, TEMP_README_CONTENT);
  }

  // create .gitignore if absent (ignore all temp directories)
  const gitignorePath = path.join(tempDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*\n');
  }

  return tempDir;
};
