// import from contract layer only (blackbox)
import { genTempDir, given, isTempDir, then, when } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';
// internal imports only for test setup/teardown
import { resetPruneThrottle } from './pruneStale';

describe('genTempDir acceptance', () => {
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

  // usecase.1: generate an ephemeral temp directory
  given('[case1] a test that needs a temporary directory', () => {
    when('[t0] genTempDir is called with a slug', () => {
      then('returns an absolute path to a new directory', () => {
        const dir = genTempDir({ slug: 'acceptance-test' });
        createdDirs.push(dir);

        expect(path.isAbsolute(dir)).toBe(true);
      });

      then('the directory exists on the filesystem', () => {
        const dir = genTempDir({ slug: 'acceptance-test' });
        createdDirs.push(dir);

        expect(fs.existsSync(dir)).toBe(true);
        expect(fs.statSync(dir).isDirectory()).toBe(true);
      });

      then('the directory is empty', () => {
        const dir = genTempDir({ slug: 'acceptance-test' });
        createdDirs.push(dir);

        expect(fs.readdirSync(dir)).toHaveLength(0);
      });

      then('the directory path contains a timestamp prefix', () => {
        const dir = genTempDir({ slug: 'acceptance-test' });
        createdDirs.push(dir);

        expect(isTempDir({ path: dir })).toBe(true);
      });

      then('the directory path contains the slug for debugging', () => {
        const dir = genTempDir({ slug: 'my-debug-slug' });
        createdDirs.push(dir);

        expect(path.basename(dir)).toContain('.my-debug-slug.');
      });
    });

    when('[t1] genTempDir is called multiple times in quick succession', () => {
      then('each call returns a unique directory path', () => {
        const dirs = [
          genTempDir({ slug: 'multi-1' }),
          genTempDir({ slug: 'multi-2' }),
          genTempDir({ slug: 'multi-3' }),
        ];
        createdDirs.push(...dirs);

        const uniqueDirs = new Set(dirs);
        expect(uniqueDirs.size).toBe(dirs.length);
      });
    });
  });

  // usecase.2: generate a temp directory from a fixture
  given('[case2] a test that needs a pre-populated directory', () => {
    const fixtureDir = path.join(__dirname, '.acceptance-test-fixture');

    beforeEach(() => {
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'config.json'), '{"key":"value"}');
      fs.mkdirSync(path.join(fixtureDir, 'nested'));
      fs.writeFileSync(
        path.join(fixtureDir, 'nested', 'data.txt'),
        'nested content',
      );
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when(
      '[t0] genTempDir is called with { slug, clone: "path/to/fixture" }',
      () => {
        then('returns an absolute path to a new directory', () => {
          const dir = genTempDir({ slug: 'clone-test', clone: fixtureDir });
          createdDirs.push(dir);

          expect(path.isAbsolute(dir)).toBe(true);
        });

        then(
          'the directory contains a copy of all files from the fixture path',
          () => {
            const dir = genTempDir({ slug: 'clone-test', clone: fixtureDir });
            createdDirs.push(dir);

            expect(fs.existsSync(path.join(dir, 'config.json'))).toBe(true);
            expect(fs.existsSync(path.join(dir, 'nested', 'data.txt'))).toBe(
              true,
            );
            expect(
              fs.readFileSync(path.join(dir, 'config.json'), 'utf-8'),
            ).toBe('{"key":"value"}');
          },
        );

        then('the original fixture directory is unchanged', () => {
          const dir = genTempDir({ slug: 'clone-test', clone: fixtureDir });
          createdDirs.push(dir);

          // modify cloned file
          fs.writeFileSync(path.join(dir, 'config.json'), '{"modified":true}');

          // original unchanged
          expect(
            fs.readFileSync(path.join(fixtureDir, 'config.json'), 'utf-8'),
          ).toBe('{"key":"value"}');
        });
      },
    );

    when(
      '[t1] genTempDir is called with a clone path that does not exist',
      () => {
        then(
          'throws a clear error that indicates the fixture path was not found',
          () => {
            expect(() =>
              genTempDir({
                slug: 'clone-test',
                clone: '/non/existent/fixture/path',
              }),
            ).toThrow(/fixture path not found/i);
          },
        );
      },
    );
  });

  // boundary.1: edge cases
  given('[case3] the .temp directory does not yet exist at gitroot', () => {
    when('[t0] genTempDir is called', () => {
      then('the .temp directory is created automatically', () => {
        const dir = genTempDir({ slug: 'edge-case' });
        createdDirs.push(dir);

        const tempDir = path.dirname(dir);
        expect(fs.existsSync(tempDir)).toBe(true);
        expect(tempDir).toContain('.temp');
      });

      then(
        'a readme.md is placed in .temp that explains the ttl policy',
        () => {
          const dir = genTempDir({ slug: 'edge-case' });
          createdDirs.push(dir);

          const tempDir = path.dirname(dir);
          const readmePath = path.join(tempDir, 'readme.md');
          expect(fs.existsSync(readmePath)).toBe(true);
          expect(fs.readFileSync(readmePath, 'utf-8')).toContain(
            'cleanup policy',
          );
        },
      );

      then('a .gitignore is placed in .temp that ignores all files', () => {
        const dir = genTempDir({ slug: 'edge-case' });
        createdDirs.push(dir);

        const tempDir = path.dirname(dir);
        const gitignorePath = path.join(tempDir, '.gitignore');
        expect(fs.existsSync(gitignorePath)).toBe(true);
        expect(fs.readFileSync(gitignorePath, 'utf-8').trim()).toBe('*');
      });
    });
  });

  given('[case4] a fixture directory with nested subdirectories', () => {
    const fixtureDir = path.join(__dirname, '.acceptance-test-nested-fixture');

    beforeEach(() => {
      fs.mkdirSync(path.join(fixtureDir, 'a', 'b', 'c'), { recursive: true });
      fs.writeFileSync(
        path.join(fixtureDir, 'a', 'b', 'c', 'deep.txt'),
        'deep',
      );
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when(
      '[t0] genTempDir is called with { slug, clone: "path/to/nested/fixture" }',
      () => {
        then('all nested files and directories are copied recursively', () => {
          const dir = genTempDir({ slug: 'nested-clone', clone: fixtureDir });
          createdDirs.push(dir);

          expect(fs.existsSync(path.join(dir, 'a', 'b', 'c', 'deep.txt'))).toBe(
            true,
          );
          expect(
            fs.readFileSync(path.join(dir, 'a', 'b', 'c', 'deep.txt'), 'utf-8'),
          ).toBe('deep');
        });
      },
    );
  });
});
