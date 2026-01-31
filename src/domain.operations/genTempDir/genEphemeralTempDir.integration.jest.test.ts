import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { genIsolatedTempInfra } from '../../infra/isomorph.fs/genIsolatedTempInfra';
import { getGitRoot } from '../../infra/isomorph.fs/getGitRoot';
import { given, then, when } from '../givenWhenThen';
import { useBeforeAll } from '../usePrep';
import { genEphemeralTempDir } from './genEphemeralTempDir';

describe('genEphemeralTempDir', () => {
  const gitRoot = getGitRoot();

  // ensure infra exists before tests
  const tempInfra = useBeforeAll(async () => genIsolatedTempInfra({ gitRoot }));

  given('[case1] basic usage with slug only', () => {
    when('[t0] genEphemeralTempDir is called', () => {
      then('it returns a directory name with timestamp prefix', () => {
        const dirName = genEphemeralTempDir({
          slug: 'basic-test',
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        expect(dirName).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.basic-test\.[a-f0-9]{8}$/i,
        );
      });

      then('directory exists at physical path', () => {
        const dirName = genEphemeralTempDir({
          slug: 'exists-test',
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);
        expect(fs.existsSync(fullPath)).toBe(true);
      });

      then('directory is empty', () => {
        const dirName = genEphemeralTempDir({
          slug: 'empty-test',
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);
        const contents = fs.readdirSync(fullPath);
        expect(contents).toEqual([]);
      });
    });
  });

  given('[case2] with clone option', () => {
    when('[t0] genEphemeralTempDir is called with clone', () => {
      then('directory contains cloned files', () => {
        // setup fixture inline
        const fixturePath = path.join(
          tempInfra.pathPhysical,
          '.test-fixture-clone',
        );
        fs.mkdirSync(fixturePath, { recursive: true });
        fs.writeFileSync(path.join(fixturePath, 'file1.txt'), 'content1');
        fs.mkdirSync(path.join(fixturePath, 'subdir'), { recursive: true });
        fs.writeFileSync(
          path.join(fixturePath, 'subdir', 'file2.txt'),
          'content2',
        );

        const dirName = genEphemeralTempDir({
          slug: 'clone-test',
          clone: fixturePath,
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);
        expect(fs.existsSync(path.join(fullPath, 'file1.txt'))).toBe(true);
        expect(fs.readFileSync(path.join(fullPath, 'file1.txt'), 'utf-8')).toBe(
          'content1',
        );
      });

      then('directory contains cloned subdirectories', () => {
        // setup fixture inline
        const fixturePath = path.join(
          tempInfra.pathPhysical,
          '.test-fixture-subdir',
        );
        fs.mkdirSync(fixturePath, { recursive: true });
        fs.writeFileSync(path.join(fixturePath, 'file1.txt'), 'content1');
        fs.mkdirSync(path.join(fixturePath, 'subdir'), { recursive: true });
        fs.writeFileSync(
          path.join(fixturePath, 'subdir', 'file2.txt'),
          'content2',
        );

        const dirName = genEphemeralTempDir({
          slug: 'clone-subdir-test',
          clone: fixturePath,
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);
        expect(fs.existsSync(path.join(fullPath, 'subdir', 'file2.txt'))).toBe(
          true,
        );
      });
    });
  });

  given('[case3] with symlink option', () => {
    when('[t0] genEphemeralTempDir is called with symlinks', () => {
      then('symlink is created in temp directory', () => {
        const dirName = genEphemeralTempDir({
          slug: 'symlink-test',
          symlink: [{ at: 'pkg.json', to: 'package.json' }],
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);
        const symlinkPath = path.join(fullPath, 'pkg.json');
        expect(fs.existsSync(symlinkPath)).toBe(true);
        expect(fs.lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
      });

      then('symlink points to gitRoot path', () => {
        const dirName = genEphemeralTempDir({
          slug: 'symlink-target-test',
          symlink: [{ at: 'pkg.json', to: 'package.json' }],
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);
        const symlinkPath = path.join(fullPath, 'pkg.json');
        const target = fs.readlinkSync(symlinkPath);
        expect(target).toEqual(path.join(gitRoot, 'package.json'));
      });
    });
  });

  given('[case4] multiple calls return unique names', () => {
    when('[t0] genEphemeralTempDir is called twice', () => {
      then('each call returns a unique directory name', () => {
        const dirName1 = genEphemeralTempDir({
          slug: 'unique-test',
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const dirName2 = genEphemeralTempDir({
          slug: 'unique-test',
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        expect(dirName1).not.toEqual(dirName2);
      });

      then('both directories exist', () => {
        const dirName1 = genEphemeralTempDir({
          slug: 'unique-exists-test',
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const dirName2 = genEphemeralTempDir({
          slug: 'unique-exists-test',
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        expect(fs.existsSync(path.join(tempInfra.pathPhysical, dirName1))).toBe(
          true,
        );
        expect(fs.existsSync(path.join(tempInfra.pathPhysical, dirName2))).toBe(
          true,
        );
      });
    });
  });

  given('[case5] with git: true', () => {
    when('[t0] genEphemeralTempDir is called with git: true', () => {
      then('it creates a valid git repository', () => {
        const dirName = genEphemeralTempDir({
          slug: 'git-true-test',
          git: true,
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);

        // verify .git exists
        expect(fs.existsSync(path.join(fullPath, '.git'))).toBe(true);

        // verify git rev-parse succeeds
        const result = execSync('git rev-parse --git-dir', {
          cwd: fullPath,
          encoding: 'utf-8',
        });
        expect(result.trim()).toBe('.git');
      });

      then('it creates a began commit', () => {
        const dirName = genEphemeralTempDir({
          slug: 'git-began-test',
          git: true,
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);

        const log = execSync('git log --oneline', {
          cwd: fullPath,
          encoding: 'utf-8',
        });
        expect(log).toContain('began');
      });
    });

    when('[t1] genEphemeralTempDir is called with git: true and clone', () => {
      then('it creates began and fixture commits', () => {
        // setup fixture
        const fixturePath = path.join(
          tempInfra.pathPhysical,
          '.test-fixture-git',
        );
        fs.mkdirSync(fixturePath, { recursive: true });
        fs.writeFileSync(path.join(fixturePath, 'file.txt'), 'content');

        const dirName = genEphemeralTempDir({
          slug: 'git-fixture-test',
          clone: fixturePath,
          git: true,
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);

        const log = execSync('git log --oneline', {
          cwd: fullPath,
          encoding: 'utf-8',
        });
        expect(log).toContain('began');
        expect(log).toContain('fixture');
      });

      then('work tree is clean after return', () => {
        // setup fixture
        const fixturePath = path.join(
          tempInfra.pathPhysical,
          '.test-fixture-clean',
        );
        fs.mkdirSync(fixturePath, { recursive: true });
        fs.writeFileSync(path.join(fixturePath, 'file.txt'), 'content');

        const dirName = genEphemeralTempDir({
          slug: 'git-clean-test',
          clone: fixturePath,
          git: true,
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);

        const status = execSync('git status --porcelain', {
          cwd: fullPath,
          encoding: 'utf-8',
        });
        expect(status.trim()).toBe('');
      });
    });
  });

  given('[case6] with git: { commits: { init: false } }', () => {
    when('[t0] genEphemeralTempDir is called', () => {
      then('it creates a git repo but no commits', () => {
        const dirName = genEphemeralTempDir({
          slug: 'git-no-init-test',
          git: { commits: { init: false } },
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);

        // git repo exists
        expect(fs.existsSync(path.join(fullPath, '.git'))).toBe(true);

        // no commits
        expect(() => {
          execSync('git log --oneline', { cwd: fullPath, stdio: 'pipe' });
        }).toThrow();
      });
    });
  });

  given('[case7] with git: { commits: { fixture: false } }', () => {
    when('[t0] genEphemeralTempDir is called with clone', () => {
      then('it creates began commit but files are uncommitted', () => {
        // setup fixture
        const fixturePath = path.join(
          tempInfra.pathPhysical,
          '.test-fixture-no-fixture',
        );
        fs.mkdirSync(fixturePath, { recursive: true });
        fs.writeFileSync(path.join(fixturePath, 'file.txt'), 'content');

        const dirName = genEphemeralTempDir({
          slug: 'git-no-fixture-test',
          clone: fixturePath,
          git: { commits: { fixture: false } },
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);

        // began commit exists
        const log = execSync('git log --oneline', {
          cwd: fullPath,
          encoding: 'utf-8',
        });
        expect(log).toContain('began');
        expect(log).not.toContain('fixture');

        // files are untracked
        const status = execSync('git status --porcelain', {
          cwd: fullPath,
          encoding: 'utf-8',
        });
        expect(status).toContain('??');
      });
    });
  });

  given('[case8] with git: true but no clone or symlink', () => {
    when('[t0] genEphemeralTempDir is called', () => {
      then('only began commit exists (no fixture commit)', () => {
        const dirName = genEphemeralTempDir({
          slug: 'git-no-content-test',
          git: true,
          tempInfra: { pathPhysical: tempInfra.pathPhysical },
          gitRoot,
        });
        const fullPath = path.join(tempInfra.pathPhysical, dirName);

        const log = execSync('git log --oneline', {
          cwd: fullPath,
          encoding: 'utf-8',
        });
        expect(log).toContain('began');
        expect(log).not.toContain('fixture');

        // count commits
        const commitCount = execSync('git rev-list --count HEAD', {
          cwd: fullPath,
          encoding: 'utf-8',
        });
        expect(commitCount.trim()).toBe('1');
      });
    });
  });
});
