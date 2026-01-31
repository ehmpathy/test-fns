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

  // usecase.2: isolation from gitroot module resolution
  given('[case5] a temp directory created by genTempDir', () => {
    when('[t0] we check physical location', () => {
      then(
        'physical files are stored at /tmp/test-fns/{repo-dirname}/.temp/',
        () => {
          const dir = genTempDir({ slug: 'isolation-test' });
          createdDirs.push(dir);

          // the returned path is the symlink path
          expect(dir).toContain('.temp/genTempDir.symlink/');

          // resolve symlink to get physical path
          const physicalPath = fs.realpathSync(dir);
          expect(physicalPath).toMatch(/^\/tmp\/test-fns\//);
          expect(physicalPath).toContain('/.temp/');
        },
      );
    });

    when(
      '[t1] we search upward for node_modules from within the temp dir',
      () => {
        then('no node_modules is found in any ancestor directory', () => {
          const dir = genTempDir({ slug: 'nodemodules-test' });
          createdDirs.push(dir);

          // resolve to physical path and search upward
          const physicalPath = fs.realpathSync(dir);

          // walk up from physical path, stop at /tmp
          let currentDir = physicalPath;
          while (currentDir !== '/tmp' && currentDir !== '/') {
            const nodeModulesPath = path.join(currentDir, 'node_modules');
            const hasNodeModules = fs.existsSync(nodeModulesPath);
            expect(hasNodeModules).toBe(false);
            currentDir = path.dirname(currentDir);
          }
        });
      },
    );

    when(
      '[t2] we search upward for package.json from within the temp dir',
      () => {
        then('no package.json is found in any ancestor directory', () => {
          const dir = genTempDir({ slug: 'packagejson-test' });
          createdDirs.push(dir);

          // resolve to physical path and search upward
          const physicalPath = fs.realpathSync(dir);

          // walk up from physical path, stop at /tmp
          let currentDir = physicalPath;
          while (currentDir !== '/tmp' && currentDir !== '/') {
            const packageJsonPath = path.join(currentDir, 'package.json');
            const hasPackageJson = fs.existsSync(packageJsonPath);
            expect(hasPackageJson).toBe(false);
            currentDir = path.dirname(currentDir);
          }
        });
      },
    );
  });

  // usecase.3: discoverability via symlink at gitroot
  given('[case6] symlink at gitroot', () => {
    when('[t0] we check @gitroot/.temp/genTempDir.symlink/', () => {
      then('it is a symlink', () => {
        const dir = genTempDir({ slug: 'symlink-check' });
        createdDirs.push(dir);

        // extract symlink parent from returned path
        const symlinkDir = path.dirname(dir);
        expect(fs.lstatSync(symlinkDir).isSymbolicLink()).toBe(true);
      });

      then('symlink target is within /tmp/', () => {
        const dir = genTempDir({ slug: 'symlink-target' });
        createdDirs.push(dir);

        const symlinkDir = path.dirname(dir);
        const target = fs.readlinkSync(symlinkDir);
        expect(target).toMatch(/^\/tmp\//);
      });
    });

    when('[t1] we list contents via symlink', () => {
      then('temp directories are visible', () => {
        const dir = genTempDir({ slug: 'visible-via-symlink' });
        createdDirs.push(dir);

        const symlinkDir = path.dirname(dir);
        const dirName = path.basename(dir);

        // list via symlink path (not physical)
        const contents = fs.readdirSync(symlinkDir);
        expect(contents).toContain(dirName);
      });
    });
  });

  // boundary.1: /tmp/ validation
  // note: cannot test /tmp/ absence in acceptance test (would require root to remove)
  // this is verified in genIsolatedTempInfra integration tests
  given('[case7] /tmp/ exists on the system', () => {
    when('[t0] we verify /tmp/ requirement', () => {
      then('/tmp/ directory exists (unix system requirement)', () => {
        expect(fs.existsSync('/tmp')).toBe(true);
        expect(fs.statSync('/tmp').isDirectory()).toBe(true);
      });
    });
  });

  // usecase.4: git repository initialization
  given('[case8] a test that needs a git repo', () => {
    const fixtureDir = path.join(__dirname, '.acceptance-test-git-fixture');

    beforeEach(() => {
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'readme.md'), '# test');
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when('[t0] genTempDir is called with { git: true }', () => {
      then('returns a valid git repository', () => {
        const { execSync } = require('node:child_process');
        const dir = genTempDir({ slug: 'git-test', git: true });
        createdDirs.push(dir);

        // .git exists
        expect(fs.existsSync(path.join(dir, '.git'))).toBe(true);

        // git rev-parse succeeds
        const result = execSync('git rev-parse --git-dir', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(result.trim()).toBe('.git');
      });

      then('git log shows began commit', () => {
        const { execSync } = require('node:child_process');
        const dir = genTempDir({ slug: 'git-began-test', git: true });
        createdDirs.push(dir);

        const log = execSync('git log --oneline', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(log).toContain('began');
      });
    });

    when('[t1] genTempDir is called with { git: true, clone }', () => {
      then('git log shows began and fixture commits', () => {
        const { execSync } = require('node:child_process');
        const dir = genTempDir({
          slug: 'git-fixture-test',
          clone: fixtureDir,
          git: true,
        });
        createdDirs.push(dir);

        const log = execSync('git log --oneline', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(log).toContain('began');
        expect(log).toContain('fixture');
      });

      then('work tree is clean after return', () => {
        const { execSync } = require('node:child_process');
        const dir = genTempDir({
          slug: 'git-clean-test',
          clone: fixtureDir,
          git: true,
        });
        createdDirs.push(dir);

        const status = execSync('git status --porcelain', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(status.trim()).toBe('');
      });
    });
  });

  given('[case9] a test that needs an uninitialized git repo', () => {
    const fixtureDir = path.join(__dirname, '.acceptance-test-git-noinit');

    beforeEach(() => {
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'file.txt'), 'content');
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when(
      '[t0] genTempDir is called with { git: { commits: { init: false } } }',
      () => {
        then('git repo exists but has no commits', () => {
          const { execSync } = require('node:child_process');
          const dir = genTempDir({
            slug: 'git-noinit-test',
            git: { commits: { init: false } },
          });
          createdDirs.push(dir);

          // git repo exists
          expect(fs.existsSync(path.join(dir, '.git'))).toBe(true);

          // no commits
          expect(() => {
            execSync('git log --oneline', { cwd: dir, stdio: 'pipe' });
          }).toThrow();
        });
      },
    );
  });

  given('[case10] a test that needs fixture content uncommitted', () => {
    const fixtureDir = path.join(__dirname, '.acceptance-test-git-nofixture');

    beforeEach(() => {
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'file.txt'), 'content');
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when(
      '[t0] genTempDir is called with { clone, git: { commits: { fixture: false } } }',
      () => {
        then('began commit exists but files are uncommitted', () => {
          const { execSync } = require('node:child_process');
          const dir = genTempDir({
            slug: 'git-nofixture-test',
            clone: fixtureDir,
            git: { commits: { fixture: false } },
          });
          createdDirs.push(dir);

          // began commit exists
          const log = execSync('git log --oneline', {
            cwd: dir,
            encoding: 'utf-8',
          });
          expect(log).toContain('began');
          expect(log).not.toContain('fixture');

          // files are untracked
          const status = execSync('git status --porcelain', {
            cwd: dir,
            encoding: 'utf-8',
          });
          expect(status).toContain('??');
        });
      },
    );
  });

  given('[case11] a test that needs git repo without clone', () => {
    when('[t0] genTempDir is called with { git: true } and no clone', () => {
      then('only began commit exists (no fixture commit)', () => {
        const { execSync } = require('node:child_process');
        const dir = genTempDir({ slug: 'git-nocontent-test', git: true });
        createdDirs.push(dir);

        const log = execSync('git log --oneline', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(log).toContain('began');
        expect(log).not.toContain('fixture');

        // only one commit
        const commitCount = execSync('git rev-list --count HEAD', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(commitCount.trim()).toBe('1');
      });
    });
  });
});
