import * as fs from 'node:fs';
import * as path from 'node:path';
import { given, then, when } from '../../domain.operations/givenWhenThen';
import { useBeforeAll } from '../../domain.operations/usePrep';
import { genIsolatedTempInfra } from './genIsolatedTempInfra';
import { getGitRoot } from './getGitRoot';

describe('genIsolatedTempInfra', () => {
  const gitRoot = getGitRoot();
  const repoDirname = path.basename(gitRoot);
  const pathPhysicalExpected = `/tmp/test-fns/${repoDirname}/.temp`;
  const pathSymlinkExpected = path.join(gitRoot, '.temp', 'genTempDir.symlink');

  /**
   * .note = destructive tests (case1, case3, case5) use isolated "fake gitRoot" dirs
   *         to avoid race conditions with parallel test files that use the shared
   *         genTempDir.symlink at the real gitRoot
   */
  const isolatedGitRoot = path.join(gitRoot, '.temp', '.test-isolated-gitroot');
  const isolatedRepoDirname = '.test-isolated-gitroot';
  const isolatedPathPhysical = `/tmp/test-fns/${isolatedRepoDirname}/.temp`;
  const isolatedPathSymlink = path.join(
    isolatedGitRoot,
    '.temp',
    'genTempDir.symlink',
  );

  // cleanup isolated paths after tests
  afterAll(() => {
    // cleanup isolated gitRoot
    if (fs.existsSync(isolatedGitRoot)) {
      fs.rmSync(isolatedGitRoot, { recursive: true, force: true });
    }
    // cleanup isolated physical path
    if (fs.existsSync(isolatedPathPhysical)) {
      fs.rmSync(isolatedPathPhysical, { recursive: true, force: true });
    }
  });

  given('[case1] first-time setup', () => {
    // setup: ensure isolated gitRoot exists but symlink doesn't
    beforeAll(() => {
      // create isolated gitRoot
      fs.mkdirSync(isolatedGitRoot, { recursive: true });
      // ensure symlink doesn't exist
      const symlinkDir = path.dirname(isolatedPathSymlink);
      if (fs.existsSync(isolatedPathSymlink)) {
        const stat = fs.lstatSync(isolatedPathSymlink);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(isolatedPathSymlink);
        } else if (stat.isDirectory()) {
          fs.rmSync(isolatedPathSymlink, { recursive: true, force: true });
        }
      }
    });

    when('[t0] genIsolatedTempInfra is called', () => {
      // use isolated gitRoot to avoid conflicts with parallel tests
      const result = useBeforeAll(async () =>
        genIsolatedTempInfra({ gitRoot: isolatedGitRoot }),
      );

      then('it returns pathPhysical at /tmp/test-fns/{repo}/.temp', () => {
        expect(result.pathPhysical).toEqual(isolatedPathPhysical);
      });

      then(
        'it returns pathSymlink at @gitroot/.temp/genTempDir.symlink',
        () => {
          expect(result.pathSymlink).toEqual(isolatedPathSymlink);
        },
      );

      then('physical directory exists', () => {
        expect(fs.existsSync(result.pathPhysical)).toBe(true);
      });

      then('physical directory contains readme.md', () => {
        const readmePath = path.join(result.pathPhysical, 'readme.md');
        expect(fs.existsSync(readmePath)).toBe(true);
      });

      then('physical directory contains .gitignore', () => {
        const gitignorePath = path.join(result.pathPhysical, '.gitignore');
        expect(fs.existsSync(gitignorePath)).toBe(true);
      });

      then('symlink exists at @gitroot/.temp/genTempDir.symlink', () => {
        expect(fs.existsSync(result.pathSymlink)).toBe(true);
        expect(fs.lstatSync(result.pathSymlink).isSymbolicLink()).toBe(true);
      });

      then('symlink target is the physical path', () => {
        const target = fs.readlinkSync(result.pathSymlink);
        expect(target).toEqual(result.pathPhysical);
      });

      then('symlink resolves to physical directory', () => {
        const resolved = fs.realpathSync(result.pathSymlink);
        expect(resolved).toEqual(result.pathPhysical);
      });
    });
  });

  given('[case2] symlink already exists with correct target', () => {
    // setup: ensure infra exists first
    beforeAll(() => {
      genIsolatedTempInfra({ gitRoot });
    });

    when('[t0] genIsolatedTempInfra is called again', () => {
      const result = useBeforeAll(async () =>
        genIsolatedTempInfra({ gitRoot }),
      );

      then('it returns the same paths (idempotent)', () => {
        expect(result.pathPhysical).toEqual(pathPhysicalExpected);
        expect(result.pathSymlink).toEqual(pathSymlinkExpected);
      });

      then('symlink still points to correct target', () => {
        const target = fs.readlinkSync(result.pathSymlink);
        expect(target).toEqual(result.pathPhysical);
      });
    });
  });

  given('[case3] a real directory exists at symlink path', () => {
    // use isolated gitRoot to avoid conflicts with parallel tests
    const case3GitRoot = path.join(
      gitRoot,
      '.temp',
      '.test-isolated-gitroot-case3',
    );
    const case3PathSymlink = path.join(
      case3GitRoot,
      '.temp',
      'genTempDir.symlink',
    );

    // setup: create a real directory at the symlink path
    beforeAll(() => {
      // create isolated gitRoot
      fs.mkdirSync(case3GitRoot, { recursive: true });
      // ensure any prior symlink is removed
      if (fs.existsSync(case3PathSymlink)) {
        const stat = fs.lstatSync(case3PathSymlink);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(case3PathSymlink);
        } else if (stat.isDirectory()) {
          fs.rmSync(case3PathSymlink, { recursive: true, force: true });
        }
      }
      // create a real directory at the symlink path
      fs.mkdirSync(case3PathSymlink, { recursive: true });
      fs.writeFileSync(
        path.join(case3PathSymlink, 'test-file.txt'),
        'ephemeral content',
      );
    });

    afterAll(() => {
      // cleanup isolated gitRoot
      if (fs.existsSync(case3GitRoot)) {
        fs.rmSync(case3GitRoot, { recursive: true, force: true });
      }
    });

    when('[t0] genIsolatedTempInfra is called', () => {
      const result = useBeforeAll(async () =>
        genIsolatedTempInfra({ gitRoot: case3GitRoot }),
      );

      then('the directory is replaced with a symlink', () => {
        expect(fs.lstatSync(result.pathSymlink).isSymbolicLink()).toBe(true);
      });

      then('symlink points to physical path', () => {
        const target = fs.readlinkSync(result.pathSymlink);
        expect(target).toEqual(result.pathPhysical);
      });
    });
  });

  given('[case4] /tmp/ exists on the system', () => {
    when('[t0] we check /tmp/', () => {
      then('/tmp/ directory exists (unix system requirement)', () => {
        expect(fs.existsSync('/tmp')).toBe(true);
      });
    });
  });

  given('[case5] multiple rapid calls to genIsolatedTempInfra', () => {
    // use isolated gitRoot to avoid conflicts with parallel tests
    const case5GitRoot = path.join(
      gitRoot,
      '.temp',
      '.test-isolated-gitroot-case5',
    );
    const case5PathPhysical = `/tmp/test-fns/.test-isolated-gitroot-case5/.temp`;
    const case5PathSymlink = path.join(
      case5GitRoot,
      '.temp',
      'genTempDir.symlink',
    );

    // setup: ensure isolated gitRoot exists but symlink doesn't
    beforeAll(() => {
      // create isolated gitRoot
      fs.mkdirSync(case5GitRoot, { recursive: true });
      // remove symlink if exists
      if (fs.existsSync(case5PathSymlink)) {
        const stat = fs.lstatSync(case5PathSymlink);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(case5PathSymlink);
        } else if (stat.isDirectory()) {
          fs.rmSync(case5PathSymlink, { recursive: true, force: true });
        }
      }
    });

    afterAll(() => {
      // cleanup isolated gitRoot
      if (fs.existsSync(case5GitRoot)) {
        fs.rmSync(case5GitRoot, { recursive: true, force: true });
      }
    });

    when('[t0] 10 calls are made in rapid succession', () => {
      const scene = useBeforeAll(async () => {
        // call genIsolatedTempInfra 10 times rapidly
        // this tests idempotency - all calls should succeed
        const results = Array.from({ length: 10 }, () =>
          genIsolatedTempInfra({ gitRoot: case5GitRoot }),
        );
        return { results };
      });

      then('all calls succeed', () => {
        expect(scene.results).toHaveLength(10);
      });

      then('all calls return same paths', () => {
        for (const result of scene.results) {
          expect(result.pathPhysical).toEqual(case5PathPhysical);
          expect(result.pathSymlink).toEqual(case5PathSymlink);
        }
      });

      then('symlink is extant and points to correct target', () => {
        expect(fs.lstatSync(case5PathSymlink).isSymbolicLink()).toBe(true);
        expect(fs.readlinkSync(case5PathSymlink)).toEqual(case5PathPhysical);
      });
    });
  });
});
