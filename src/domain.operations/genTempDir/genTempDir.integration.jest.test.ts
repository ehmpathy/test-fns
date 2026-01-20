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

  given('genTempDir is called with no options', () => {
    when('invoked', () => {
      then('it returns an absolute path to a new directory', () => {
        const tempDir = genTempDir();
        createdDirs.push(tempDir);

        expect(path.isAbsolute(tempDir)).toBe(true);
      });

      then('the directory exists on the filesystem', () => {
        const tempDir = genTempDir();
        createdDirs.push(tempDir);

        expect(fs.existsSync(tempDir)).toBe(true);
        expect(fs.statSync(tempDir).isDirectory()).toBe(true);
      });

      then('the directory is empty', () => {
        const tempDir = genTempDir();
        createdDirs.push(tempDir);

        const contents = fs.readdirSync(tempDir);
        expect(contents).toHaveLength(0);
      });

      then('the directory path contains a timestamp prefix', () => {
        const tempDir = genTempDir();
        createdDirs.push(tempDir);

        expect(isTempDir({ path: tempDir })).toBe(true);
      });
    });
  });

  given('genTempDir is called multiple times in quick succession', () => {
    when('invoked', () => {
      then('each call returns a unique directory path', () => {
        const dir1 = genTempDir();
        const dir2 = genTempDir();
        const dir3 = genTempDir();
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
          const tempDir = genTempDir({ clone: fixtureDir });
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
        const tempDir = genTempDir({ clone: fixtureDir });
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
          genTempDir({ clone: '/non/existent/fixture/path' }),
        ).toThrow(/fixture path not found/i);
      });
    });
  });
});
