import { UnexpectedCodePathError } from 'helpful-errors';

import * as fs from 'node:fs';

/**
 * .what = writes a file if absent, verifies content if exists
 * .why = idempotent file creation safe for parallel workers
 *
 * @throws UnexpectedCodePathError if file exists with different content
 */
export const findsertFile = (input: {
  path: string;
  content: string;
}): void => {
  try {
    fs.writeFileSync(input.path, input.content, { flag: 'wx' });
  } catch (error: unknown) {
    // check for EEXIST via code or message
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : String(error);
    const isEexist = code === 'EEXIST' || message.includes('EEXIST');
    if (!isEexist) throw error;

    // file exists — verify content matches
    const contentFound = fs.readFileSync(input.path, 'utf-8');
    if (contentFound === input.content) {
      return; // correct content — idempotent success
    }

    throw new UnexpectedCodePathError('file exists with unexpected content', {
      path: input.path,
      contentExpected: input.content,
      contentFound,
    });
  }
};
