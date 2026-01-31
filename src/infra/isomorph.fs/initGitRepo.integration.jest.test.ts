import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { given, then, when } from '../../contract';
import { initGitRepo } from './initGitRepo';

describe('initGitRepo', () => {
  const createdDirs: string[] = [];

  const createTempDir = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'initGitRepo-test-'));
    createdDirs.push(dir);
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

  given('[case1] an empty directory', () => {
    when('[t0] initGitRepo is called', () => {
      then('it creates a valid git repository', () => {
        const dir = createTempDir();
        initGitRepo({ dir });

        // verify .git directory exists
        expect(fs.existsSync(path.join(dir, '.git'))).toBe(true);

        // verify git rev-parse succeeds
        const result = execSync('git rev-parse --git-dir', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(result.trim()).toBe('.git');
      });

      then('it sets repo-local user.name to test-fns', () => {
        const dir = createTempDir();
        initGitRepo({ dir });

        const userName = execSync('git config user.name', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(userName.trim()).toBe('test-fns');
      });

      then('it sets repo-local user.email to test-fns@test.local', () => {
        const dir = createTempDir();
        initGitRepo({ dir });

        const userEmail = execSync('git config user.email', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(userEmail.trim()).toBe('test-fns@test.local');
      });
    });

    when('[t1] initGitRepo is called with custom user', () => {
      then('it uses the custom user.name', () => {
        const dir = createTempDir();
        initGitRepo({ dir, user: { name: 'custom-name' } });

        const userName = execSync('git config user.name', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(userName.trim()).toBe('custom-name');
      });

      then('it uses the custom user.email', () => {
        const dir = createTempDir();
        initGitRepo({ dir, user: { email: 'custom@example.com' } });

        const userEmail = execSync('git config user.email', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(userEmail.trim()).toBe('custom@example.com');
      });
    });
  });

  given('[case2] ci environment (no global git config)', () => {
    when('[t0] initGitRepo is called', () => {
      then('commits can be made without global config', () => {
        const dir = createTempDir();
        initGitRepo({ dir });

        // create a file and commit it
        fs.writeFileSync(path.join(dir, 'test.txt'), 'content');
        execSync('git add .', { cwd: dir });

        // this would fail without repo-local user config on ci
        expect(() => {
          execSync('git commit -m "test commit"', { cwd: dir, stdio: 'pipe' });
        }).not.toThrow();

        // verify commit exists
        const log = execSync('git log --oneline', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(log).toContain('test commit');
      });
    });
  });
});
