import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { given, then, when } from '../../domain.operations/givenWhenThen';
import { isSymlinkEexistError } from './isSymlinkEexistError';

describe('isSymlinkEexistError', () => {
  given('[case1] a real EEXIST error from fs.symlinkSync', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eexist-test-'));
    const symlinkPath = path.join(tempDir, 'test-symlink');
    const targetPath = tempDir;

    // create the symlink first
    fs.symlinkSync(targetPath, symlinkPath);

    // capture the EEXIST error
    let capturedError: unknown;
    try {
      fs.symlinkSync(targetPath, symlinkPath);
    } catch (error) {
      capturedError = error;
    }

    // cleanup
    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    when('[t0] we check the captured error', () => {
      then('it should be detected as EEXIST', () => {
        expect(capturedError).toBeDefined();
        expect(isSymlinkEexistError(capturedError)).toBe(true);
      });

      then('it should have code EEXIST', () => {
        expect((capturedError as NodeJS.ErrnoException).code).toBe('EEXIST');
      });

      then('it may or may not be instanceof Error (native quirk)', () => {
        // note: native fs errors in some Node.js/jest contexts fail instanceof Error
        // this documents the quirk — the guard must handle both cases
        const isInstance = capturedError instanceof Error;
        expect(typeof isInstance).toBe('boolean'); // just verify it's testable
      });
    });
  });

  given('[case2] non-EEXIST errors', () => {
    when('[t0] given a generic Error', () => {
      const error = new Error('other error occurred');

      then('it should return false', () => {
        expect(isSymlinkEexistError(error)).toBe(false);
      });
    });

    when('[t1] given a non-Error value', () => {
      then('it should return false for string', () => {
        expect(isSymlinkEexistError('EEXIST')).toBe(false);
      });

      then('it should return false for null', () => {
        expect(isSymlinkEexistError(null)).toBe(false);
      });

      then('it should return false for undefined', () => {
        expect(isSymlinkEexistError(undefined)).toBe(false);
      });
    });
  });

  given('[case3] ENOENT error from absent target', () => {
    when('[t0] we check a non-EEXIST fs error', () => {
      then('it should return false', () => {
        const enoentError = new Error(
          "ENOENT: no such file or directory, open '/nonexistent'",
        ) as NodeJS.ErrnoException;
        enoentError.code = 'ENOENT';
        expect(isSymlinkEexistError(enoentError)).toBe(false);
      });
    });
  });
});
