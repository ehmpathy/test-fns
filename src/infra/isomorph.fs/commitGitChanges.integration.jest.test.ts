import { given, then, when } from '@src/contract';

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { commitGitChanges } from './commitGitChanges';
import { initGitRepo } from './initGitRepo';

describe('commitGitChanges', () => {
  const createdDirs: string[] = [];

  const createGitRepo = (): string => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'commitGitChanges-test-'),
    );
    createdDirs.push(dir);
    initGitRepo({ dir });
    return dir;
  };

  afterEach(() => {
    for (const dir of createdDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    createdDirs.length = 0;
  });

  given('[case1] a git repo with staged files', () => {
    when('[t0] commitGitChanges is called', () => {
      then('it commits the files with the given message', () => {
        const dir = createGitRepo();

        // create a file
        fs.writeFileSync(path.join(dir, 'test.txt'), 'content');

        // commit
        commitGitChanges({ dir, message: 'my commit message' });

        // verify commit
        const log = execSync('git log --oneline', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(log).toContain('my commit message');
      });

      then('the work tree is clean after commit', () => {
        const dir = createGitRepo();

        // create a file
        fs.writeFileSync(path.join(dir, 'test.txt'), 'content');

        // commit
        commitGitChanges({ dir, message: 'test' });

        // verify clean
        const status = execSync('git status --porcelain', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(status.trim()).toBe('');
      });
    });
  });

  given('[case2] a git repo with no changes', () => {
    when(
      '[t0] commitGitChanges is called with allowEmpty: false (default)',
      () => {
        then('it throws an error', () => {
          const dir = createGitRepo();

          // need at least one commit first (can't have empty initial)
          fs.writeFileSync(path.join(dir, 'init.txt'), 'init');
          commitGitChanges({ dir, message: 'init' });

          // now try to commit with no changes
          expect(() => {
            commitGitChanges({ dir, message: 'empty' });
          }).toThrow();
        });
      },
    );

    when('[t1] commitGitChanges is called with allowEmpty: true', () => {
      then('it creates an empty commit', () => {
        const dir = createGitRepo();

        // commit with no files
        commitGitChanges({ dir, message: 'empty commit', allowEmpty: true });

        // verify commit exists
        const log = execSync('git log --oneline', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(log).toContain('empty commit');
      });
    });
  });

  given('[case3] a git repo with nested files', () => {
    when('[t0] commitGitChanges is called', () => {
      then('it commits all nested files', () => {
        const dir = createGitRepo();

        // create nested structure
        fs.mkdirSync(path.join(dir, 'a', 'b'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'root.txt'), 'root');
        fs.writeFileSync(path.join(dir, 'a', 'level1.txt'), 'level1');
        fs.writeFileSync(path.join(dir, 'a', 'b', 'level2.txt'), 'level2');

        // commit
        commitGitChanges({ dir, message: 'nested' });

        // verify all files committed
        const files = execSync('git ls-files', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(files).toContain('root.txt');
        expect(files).toContain('a/level1.txt');
        expect(files).toContain('a/b/level2.txt');
      });
    });
  });
});
