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

  // cleanup after tests
  afterAll(() => {
    // remove the symlink if it exists
    if (
      fs.existsSync(pathSymlinkExpected) &&
      fs.lstatSync(pathSymlinkExpected).isSymbolicLink()
    ) {
      fs.unlinkSync(pathSymlinkExpected);
    }
  });

  given('[case1] first-time setup', () => {
    // cleanup before test to simulate first-time
    beforeAll(() => {
      if (fs.existsSync(pathSymlinkExpected)) {
        const stat = fs.lstatSync(pathSymlinkExpected);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(pathSymlinkExpected);
        } else if (stat.isDirectory()) {
          fs.rmSync(pathSymlinkExpected, { recursive: true, force: true });
        }
      }
    });

    when('[t0] genIsolatedTempInfra is called', () => {
      const result = useBeforeAll(async () =>
        genIsolatedTempInfra({ gitRoot }),
      );

      then('it returns pathPhysical at /tmp/test-fns/{repo}/.temp', () => {
        expect(result.pathPhysical).toEqual(pathPhysicalExpected);
      });

      then(
        'it returns pathSymlink at @gitroot/.temp/genTempDir.symlink',
        () => {
          expect(result.pathSymlink).toEqual(pathSymlinkExpected);
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
    // setup: create a real directory at the symlink path
    beforeAll(() => {
      // ensure any prior symlink is removed
      if (fs.existsSync(pathSymlinkExpected)) {
        const stat = fs.lstatSync(pathSymlinkExpected);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(pathSymlinkExpected);
        } else if (stat.isDirectory()) {
          fs.rmSync(pathSymlinkExpected, { recursive: true, force: true });
        }
      }
      // create a real directory
      fs.mkdirSync(pathSymlinkExpected, { recursive: true });
      fs.writeFileSync(
        path.join(pathSymlinkExpected, 'test-file.txt'),
        'ephemeral content',
      );
    });

    when('[t0] genIsolatedTempInfra is called', () => {
      const result = useBeforeAll(async () =>
        genIsolatedTempInfra({ gitRoot }),
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
    // setup: remove symlink to simulate first-time setup
    beforeAll(() => {
      if (fs.existsSync(pathSymlinkExpected)) {
        const stat = fs.lstatSync(pathSymlinkExpected);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(pathSymlinkExpected);
        } else if (stat.isDirectory()) {
          fs.rmSync(pathSymlinkExpected, { recursive: true, force: true });
        }
      }
    });

    when('[t0] 10 calls are made in rapid succession', () => {
      const scene = useBeforeAll(async () => {
        // call genIsolatedTempInfra 10 times rapidly
        // this tests idempotency - all calls should succeed
        const results = Array.from({ length: 10 }, () =>
          genIsolatedTempInfra({ gitRoot }),
        );
        return { results };
      });

      then('all calls succeed', () => {
        expect(scene.results).toHaveLength(10);
      });

      then('all calls return same paths', () => {
        for (const result of scene.results) {
          expect(result.pathPhysical).toEqual(pathPhysicalExpected);
          expect(result.pathSymlink).toEqual(pathSymlinkExpected);
        }
      });

      then('symlink is extant and points to correct target', () => {
        expect(fs.lstatSync(pathSymlinkExpected).isSymbolicLink()).toBe(true);
        expect(fs.readlinkSync(pathSymlinkExpected)).toEqual(
          pathPhysicalExpected,
        );
      });
    });
  });
});
