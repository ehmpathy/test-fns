import * as fs from 'node:fs';
import * as path from 'node:path';
import { given, then, when } from '../../contract';
import { genTempDir, isTempDir } from './genTempDir';
import { resetPruneThrottle } from './pruneStale';

describe('genTempDir', () => {
  const createdDirs: string[] = [];

  beforeEach(() => {
    resetPruneThrottle();
  });

  afterEach(() => {
    // cleanup created temp directories
    for (const dir of createdDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    createdDirs.length = 0;
  });

  given('genTempDir is called with a slug', () => {
    when('invoked', () => {
      then('it returns an absolute path to a new directory', () => {
        const tempDir = genTempDir({ slug: 'integration-test' });
        createdDirs.push(tempDir);

        expect(path.isAbsolute(tempDir)).toBe(true);
      });

      then('the directory exists on the filesystem', () => {
        const tempDir = genTempDir({ slug: 'integration-test' });
        createdDirs.push(tempDir);

        expect(fs.existsSync(tempDir)).toBe(true);
        expect(fs.statSync(tempDir).isDirectory()).toBe(true);
      });

      then('the directory is empty', () => {
        const tempDir = genTempDir({ slug: 'integration-test' });
        createdDirs.push(tempDir);

        const contents = fs.readdirSync(tempDir);
        expect(contents).toHaveLength(0);
      });

      then('the directory path contains a timestamp prefix', () => {
        const tempDir = genTempDir({ slug: 'integration-test' });
        createdDirs.push(tempDir);

        expect(isTempDir({ path: tempDir })).toBe(true);
      });

      then('the directory path contains the slug', () => {
        const tempDir = genTempDir({ slug: 'my-custom-slug' });
        createdDirs.push(tempDir);

        expect(path.basename(tempDir)).toContain('.my-custom-slug.');
      });
    });
  });

  given('genTempDir is called multiple times in quick succession', () => {
    when('invoked', () => {
      then('each call returns a unique directory path', () => {
        const dir1 = genTempDir({ slug: 'multi-1' });
        const dir2 = genTempDir({ slug: 'multi-2' });
        const dir3 = genTempDir({ slug: 'multi-3' });
        createdDirs.push(dir1, dir2, dir3);

        expect(dir1).not.toEqual(dir2);
        expect(dir2).not.toEqual(dir3);
        expect(dir1).not.toEqual(dir3);
      });
    });
  });

  given('genTempDir is called with clone option', () => {
    const fixtureDir = path.join(__dirname, '.test-fixture');

    beforeEach(() => {
      // create a test fixture
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'test.txt'), 'hello world');
      fs.mkdirSync(path.join(fixtureDir, 'nested'));
      fs.writeFileSync(
        path.join(fixtureDir, 'nested', 'deep.txt'),
        'deep content',
      );
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when('fixture path exists', () => {
      then(
        'the directory contains a copy of all files from the fixture',
        () => {
          const tempDir = genTempDir({ slug: 'clone-test', clone: fixtureDir });
          createdDirs.push(tempDir);

          expect(fs.existsSync(path.join(tempDir, 'test.txt'))).toBe(true);
          expect(
            fs.readFileSync(path.join(tempDir, 'test.txt'), 'utf-8'),
          ).toEqual('hello world');
          expect(fs.existsSync(path.join(tempDir, 'nested', 'deep.txt'))).toBe(
            true,
          );
        },
      );

      then('the original fixture directory is unchanged', () => {
        const tempDir = genTempDir({ slug: 'clone-test', clone: fixtureDir });
        createdDirs.push(tempDir);

        // modify the cloned file
        fs.writeFileSync(path.join(tempDir, 'test.txt'), 'modified');

        // original should be unchanged
        expect(
          fs.readFileSync(path.join(fixtureDir, 'test.txt'), 'utf-8'),
        ).toEqual('hello world');
      });
    });

    when('fixture path does not exist', () => {
      then('it throws a clear error', () => {
        expect(() =>
          genTempDir({
            slug: 'clone-test',
            clone: '/non/existent/fixture/path',
          }),
        ).toThrow(/fixture path not found/i);
      });
    });
  });

  given('genTempDir is called with symlink option', () => {
    when('symlink targets exist in repo root', () => {
      then('symlink to file is created and readable', () => {
        const tempDir = genTempDir({
          slug: 'symlink-file-test',
          symlink: [{ at: 'my-package.json', to: 'package.json' }],
        });
        createdDirs.push(tempDir);

        const symlinkPath = path.join(tempDir, 'my-package.json');
        expect(fs.existsSync(symlinkPath)).toBe(true);
        expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);

        // verify content is readable via symlink
        const content = fs.readFileSync(symlinkPath, 'utf-8');
        expect(content).toContain('"name":');
      });

      then('symlink to directory is created and accessible', () => {
        const tempDir = genTempDir({
          slug: 'symlink-dir-test',
          symlink: [{ at: 'linked-src', to: 'src' }],
        });
        createdDirs.push(tempDir);

        const symlinkPath = path.join(tempDir, 'linked-src');
        expect(fs.existsSync(symlinkPath)).toBe(true);
        expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);

        // verify directory contents are accessible
        const contents = fs.readdirSync(symlinkPath);
        expect(contents.length).toBeGreaterThan(0);
      });
    });

    when('symlink `at` path includes nested directories', () => {
      then('parent directories are created automatically', () => {
        const tempDir = genTempDir({
          slug: 'symlink-nested-test',
          symlink: [{ at: 'deep/nested/path/config.json', to: 'package.json' }],
        });
        createdDirs.push(tempDir);

        expect(fs.existsSync(path.join(tempDir, 'deep/nested/path'))).toBe(
          true,
        );
        expect(
          fs.existsSync(path.join(tempDir, 'deep/nested/path/config.json')),
        ).toBe(true);
      });
    });

    when('symlink target does not exist', () => {
      then('it throws a clear error', () => {
        expect(() =>
          genTempDir({
            slug: 'symlink-error-test',
            symlink: [{ at: 'link.txt', to: 'nonexistent-file.txt' }],
          }),
        ).toThrow(/symlink target not found/i);
      });
    });

    when('multiple symlinks are specified', () => {
      then('all symlinks are created', () => {
        const tempDir = genTempDir({
          slug: 'symlink-multi-test',
          symlink: [
            { at: 'pkg.json', to: 'package.json' },
            { at: 'ts-config.json', to: 'tsconfig.json' },
            { at: 'nested/readme.md', to: 'readme.md' },
          ],
        });
        createdDirs.push(tempDir);

        expect(fs.existsSync(path.join(tempDir, 'pkg.json'))).toBe(true);
        expect(fs.existsSync(path.join(tempDir, 'ts-config.json'))).toBe(true);
        expect(fs.existsSync(path.join(tempDir, 'nested/readme.md'))).toBe(
          true,
        );
      });
    });
  });

  given('genTempDir is called with both clone and symlink options', () => {
    const fixtureDir = path.join(__dirname, '.test-fixture-symlink');

    beforeEach(() => {
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'cloned.txt'), 'cloned content');
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when('both clone and symlink are specified', () => {
      then('cloned files and symlinks coexist', () => {
        const tempDir = genTempDir({
          slug: 'clone-and-symlink-test',
          clone: fixtureDir,
          symlink: [{ at: 'linked-pkg.json', to: 'package.json' }],
        });
        createdDirs.push(tempDir);

        // cloned file exists
        expect(fs.existsSync(path.join(tempDir, 'cloned.txt'))).toBe(true);
        expect(
          fs.readFileSync(path.join(tempDir, 'cloned.txt'), 'utf-8'),
        ).toEqual('cloned content');

        // symlink exists
        expect(fs.existsSync(path.join(tempDir, 'linked-pkg.json'))).toBe(true);
        expect(
          fs.lstatSync(path.join(tempDir, 'linked-pkg.json')).isSymbolicLink(),
        ).toBe(true);
      });
    });

    when('symlink path collides with cloned file', () => {
      then('it throws a clear error', () => {
        expect(() =>
          genTempDir({
            slug: 'collision-test',
            clone: fixtureDir,
            symlink: [{ at: 'cloned.txt', to: 'package.json' }],
          }),
        ).toThrow(/symlink path collides with prior content/i);
      });
    });
  });
});
