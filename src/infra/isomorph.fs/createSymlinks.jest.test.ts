import { given, then, when } from '@src/contract';

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createSymlinks } from './createSymlinks';

describe('createSymlinks', () => {
  let tempDir: string;
  let gitRoot: string;
  const createdDirs: string[] = [];

  beforeEach(() => {
    // create temp dir and git root for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-symlinks-'));
    gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-gitroot-'));
    createdDirs.push(tempDir, gitRoot);
  });

  afterEach(() => {
    // cleanup created directories
    for (const dir of createdDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    createdDirs.length = 0;
  });

  given('createSymlinks is called', () => {
    when('all symlink targets exist', () => {
      then('symlinks are created at specified paths', () => {
        // create target file
        fs.writeFileSync(path.join(gitRoot, 'config.json'), '{"key":"value"}');

        createSymlinks({
          symlinks: [{ at: 'config/settings.json', to: 'config.json' }],
          tempDir,
          gitRoot,
        });

        const symlinkPath = path.join(tempDir, 'config/settings.json');
        expect(fs.existsSync(symlinkPath)).toBe(true);
        expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
      });

      then('symlinks point to correct targets', () => {
        // create target file
        const targetContent = '{"key":"value"}';
        fs.writeFileSync(path.join(gitRoot, 'config.json'), targetContent);

        createSymlinks({
          symlinks: [{ at: 'settings.json', to: 'config.json' }],
          tempDir,
          gitRoot,
        });

        // read via symlink
        const symlinkPath = path.join(tempDir, 'settings.json');
        expect(fs.readFileSync(symlinkPath, 'utf-8')).toEqual(targetContent);
      });
    });

    when('symlink `at` includes nested directories', () => {
      then('parent directories are created', () => {
        fs.writeFileSync(path.join(gitRoot, 'file.txt'), 'content');

        createSymlinks({
          symlinks: [{ at: 'deeply/nested/path/file.txt', to: 'file.txt' }],
          tempDir,
          gitRoot,
        });

        expect(fs.existsSync(path.join(tempDir, 'deeply/nested/path'))).toBe(
          true,
        );
        expect(
          fs.existsSync(path.join(tempDir, 'deeply/nested/path/file.txt')),
        ).toBe(true);
      });
    });

    when('symlink target does not exist', () => {
      then('throws BadRequestError with target path', () => {
        expect(() =>
          createSymlinks({
            symlinks: [{ at: 'link.txt', to: 'nonexistent.txt' }],
            tempDir,
            gitRoot,
          }),
        ).toThrow(/symlink target not found/i);
      });
    });

    when('symlink path collides with prior file', () => {
      then('throws BadRequestError with collision path', () => {
        // create target and collision
        fs.writeFileSync(path.join(gitRoot, 'target.txt'), 'target');
        fs.writeFileSync(path.join(tempDir, 'collision.txt'), 'prior');

        expect(() =>
          createSymlinks({
            symlinks: [{ at: 'collision.txt', to: 'target.txt' }],
            tempDir,
            gitRoot,
          }),
        ).toThrow(/symlink path collides with prior content/i);
      });
    });

    when('multiple symlinks specified', () => {
      then('all symlinks are created', () => {
        fs.writeFileSync(path.join(gitRoot, 'file1.txt'), 'content1');
        fs.writeFileSync(path.join(gitRoot, 'file2.txt'), 'content2');
        fs.mkdirSync(path.join(gitRoot, 'subdir'));
        fs.writeFileSync(path.join(gitRoot, 'subdir/file3.txt'), 'content3');

        createSymlinks({
          symlinks: [
            { at: 'link1.txt', to: 'file1.txt' },
            { at: 'link2.txt', to: 'file2.txt' },
            { at: 'nested/link3.txt', to: 'subdir/file3.txt' },
          ],
          tempDir,
          gitRoot,
        });

        expect(fs.existsSync(path.join(tempDir, 'link1.txt'))).toBe(true);
        expect(fs.existsSync(path.join(tempDir, 'link2.txt'))).toBe(true);
        expect(fs.existsSync(path.join(tempDir, 'nested/link3.txt'))).toBe(
          true,
        );
      });
    });

    when('one symlink has invalid target', () => {
      then('no symlinks are created (all-or-none)', () => {
        fs.writeFileSync(path.join(gitRoot, 'valid.txt'), 'content');

        expect(() =>
          createSymlinks({
            symlinks: [
              { at: 'link1.txt', to: 'valid.txt' },
              { at: 'link2.txt', to: 'nonexistent.txt' },
            ],
            tempDir,
            gitRoot,
          }),
        ).toThrow(/symlink target not found/i);

        // first symlink should not have been created
        expect(fs.existsSync(path.join(tempDir, 'link1.txt'))).toBe(false);
      });
    });

    when('symlink `to` points to a directory', () => {
      then('a directory symlink is created', () => {
        fs.mkdirSync(path.join(gitRoot, 'mydir'));
        fs.writeFileSync(
          path.join(gitRoot, 'mydir/inner.txt'),
          'inner content',
        );

        createSymlinks({
          symlinks: [{ at: 'linked-dir', to: 'mydir' }],
          tempDir,
          gitRoot,
        });

        const symlinkPath = path.join(tempDir, 'linked-dir');
        expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
        expect(
          fs.readFileSync(path.join(symlinkPath, 'inner.txt'), 'utf-8'),
        ).toEqual('inner content');
      });
    });
  });
});
