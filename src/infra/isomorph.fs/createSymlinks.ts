import { BadRequestError } from 'helpful-errors';

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * .what = creates symlinks from temp dir paths to repo root paths
 * .why = enables test temp dirs to reference repo root artifacts without copy
 *
 * @throws BadRequestError when symlink target does not exist
 * @throws BadRequestError when symlink path collides with prior content
 */
export const createSymlinks = (input: {
  symlinks: Array<{ at: string; to: string }>;
  tempDir: string;
  gitRoot: string;
}): void => {
  // validate all targets exist before any creation (all-or-none semantics)
  for (const symlink of input.symlinks) {
    const targetPath = path.join(input.gitRoot, symlink.to);
    if (!fs.existsSync(targetPath)) {
      throw new BadRequestError(`symlink target not found: ${targetPath}`, {
        at: symlink.at,
        to: symlink.to,
        gitRoot: input.gitRoot,
        targetPath,
      });
    }
  }

  // validate no path collisions with prior content
  for (const symlink of input.symlinks) {
    const symlinkPath = path.join(input.tempDir, symlink.at);
    if (fs.existsSync(symlinkPath)) {
      throw new BadRequestError(
        `symlink path collides with prior content: ${symlink.at}`,
        {
          at: symlink.at,
          to: symlink.to,
          tempDir: input.tempDir,
          symlinkPath,
        },
      );
    }
  }

  // create symlinks after all validations pass
  for (const symlink of input.symlinks) {
    const symlinkPath = path.join(input.tempDir, symlink.at);
    const targetPath = path.join(input.gitRoot, symlink.to);

    // ensure parent directories exist
    const parentDir = path.dirname(symlinkPath);
    fs.mkdirSync(parentDir, { recursive: true });

    // create symlink
    fs.symlinkSync(targetPath, symlinkPath);
  }
};
