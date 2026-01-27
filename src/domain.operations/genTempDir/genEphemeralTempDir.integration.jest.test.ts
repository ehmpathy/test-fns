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
});
