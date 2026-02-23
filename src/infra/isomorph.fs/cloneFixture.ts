import { BadRequestError } from 'helpful-errors';

import * as fs from 'node:fs';

/**
 * .what = copies all files from source to destination recursively
 * .why = enables test directories to be pre-populated with fixture contents
 */
export const cloneFixture = (input: { from: string; to: string }): void => {
  // validate source exists
  if (!fs.existsSync(input.from)) {
    throw new BadRequestError(`fixture path not found: ${input.from}`, {
      from: input.from,
      to: input.to,
    });
  }

  // ensure destination exists
  fs.mkdirSync(input.to, { recursive: true });

  // copy recursively with symlinks preserved
  fs.cpSync(input.from, input.to, {
    recursive: true,
    verbatimSymlinks: true,
  });
};
