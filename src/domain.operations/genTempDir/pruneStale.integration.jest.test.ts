import { given, then, when } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  hasPrunedThisProcess,
  pruneStale,
  pruneStaleOnce,
  resetPruneThrottle,
} from './pruneStale';

const ONE_HOUR_MS: number = 60 * 60 * 1000;

describe('pruneStale', () => {
  // create a unique test tmp dir for this test suite
  const testTmpDir = path.join(__dirname, '.test-tmp-prune');

  afterEach(async () => {
    // cleanup test directory
    if (fs.existsSync(testTmpDir)) {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    }
    resetPruneThrottle();
  });

  given('directories with various ages', () => {
    when('pruneStale is called', () => {
      then('it removes directories older than threshold', async () => {
        // setup: create test tmp dir
        fs.mkdirSync(testTmpDir, { recursive: true });

        // create an "old" directory (2 hours old timestamp)
        const oldTimestamp = new Date(Date.now() - 2 * ONE_HOUR_MS)
          .toISOString()
          .replace(/:/g, '-');
        const oldDir = `${oldTimestamp}.old-test.a1b2c3d4`;
        fs.mkdirSync(path.join(testTmpDir, oldDir));
        fs.writeFileSync(path.join(testTmpDir, oldDir, 'test.txt'), 'content');

        // create a "new" directory (5 mins old timestamp)
        const newTimestamp = new Date(Date.now() - 5 * 60 * 1000)
          .toISOString()
          .replace(/:/g, '-');
        const newDir = `${newTimestamp}.new-test.b2c3d4e5`;
        fs.mkdirSync(path.join(testTmpDir, newDir));

        // run prune
        await pruneStale({ tmpDir: testTmpDir, maxAgeMs: ONE_HOUR_MS });

        // verify old dir was removed
        expect(fs.existsSync(path.join(testTmpDir, oldDir))).toBe(false);

        // verify new dir was preserved
        expect(fs.existsSync(path.join(testTmpDir, newDir))).toBe(true);
      });

      then('it handles empty tmpDir gracefully', async () => {
        fs.mkdirSync(testTmpDir, { recursive: true });

        // should not throw
        await pruneStale({ tmpDir: testTmpDir });

        expect(fs.existsSync(testTmpDir)).toBe(true);
      });

      then('it handles non-existent tmpDir gracefully', async () => {
        // should not throw for non-existent directory
        await pruneStale({ tmpDir: '/non/existent/path' });
      });
    });
  });
});

describe('pruneStaleOnce', () => {
  const testTmpDir = path.join(__dirname, '.test-tmp-prune-once');

  afterEach(async () => {
    if (fs.existsSync(testTmpDir)) {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    }
    resetPruneThrottle();
  });

  given('pruneStaleOnce is called', () => {
    when('called for the first time', () => {
      then('it sets the throttle flag', async () => {
        fs.mkdirSync(testTmpDir, { recursive: true });

        expect(hasPrunedThisProcess()).toBe(false);

        await pruneStaleOnce({ tmpDir: testTmpDir });

        expect(hasPrunedThisProcess()).toBe(true);
      });
    });

    when('called multiple times', () => {
      then('it only prunes once per process', async () => {
        fs.mkdirSync(testTmpDir, { recursive: true });

        // create an old directory
        const oldTimestamp = new Date(Date.now() - 2 * ONE_HOUR_MS)
          .toISOString()
          .replace(/:/g, '-');
        const oldDir = `${oldTimestamp}.throttle-test.c3d4e5f6`;
        fs.mkdirSync(path.join(testTmpDir, oldDir));

        // first call (with maxAgeMs to test pruning of 2-hour old dirs)
        await pruneStaleOnce({ tmpDir: testTmpDir, maxAgeMs: ONE_HOUR_MS });
        expect(hasPrunedThisProcess()).toBe(true);

        // give the async prune time to complete
        await new Promise((resolve) => setTimeout(resolve, 50));

        // verify dir was removed
        expect(fs.existsSync(path.join(testTmpDir, oldDir))).toBe(false);

        // create another old directory
        const oldDir2 = `${oldTimestamp}.throttle-test.d4e5f6g7`;
        fs.mkdirSync(path.join(testTmpDir, oldDir2));

        // second call - should skip prune
        await pruneStaleOnce({ tmpDir: testTmpDir, maxAgeMs: ONE_HOUR_MS });

        // give time for potential async operations
        await new Promise((resolve) => setTimeout(resolve, 50));

        // second dir should still exist (prune was skipped)
        expect(fs.existsSync(path.join(testTmpDir, oldDir2))).toBe(true);
      });
    });
  });
});
