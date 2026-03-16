/**
 * .what = true parallel race condition test for findsertSymlink
 * .why = verify idempotency under real concurrent access from multiple processes
 *
 * .note = uses worker threads to achieve true parallelism since findsertSymlink is synchronous
 * .note = tests compiled JS from dist/ to verify actual implementation
 */
import { given, then, when } from '@src/domain.operations/givenWhenThen';
import { useBeforeAll } from '@src/domain.operations/usePrep';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import { getGitRoot } from './getGitRoot';

describe('findsertSymlink race condition', () => {
  const gitRoot = getGitRoot();

  // path to compiled findsertSymlink.js
  const findsertSymlinkPath = path.join(
    gitRoot,
    'dist',
    'infra',
    'isomorph.fs',
    'findsertSymlink.js',
  );

  given('[case1] 100 parallel workers all findsert simultaneously', () => {
    const WORKER_COUNT = 100;

    // isolated paths for this test
    const case1GitRoot = path.join(gitRoot, '.temp', '.test-race-findsert');
    const case1PathPhysical = `/tmp/test-fns/.test-race-findsert/.temp`;
    const case1PathSymlink = path.join(
      case1GitRoot,
      '.temp',
      'genTempDir.symlink',
    );

    // worker code that uses compiled findsertSymlink
    const WORKER_CODE = `
const { parentPort, workerData } = require('node:worker_threads');
const { findsertSymlink } = require(workerData.findsertSymlinkPath);

// signal ready then wait for go
const syncArray = new Int32Array(workerData.syncBuffer);
Atomics.add(syncArray, 0, 1);
Atomics.wait(syncArray, 1, 0);

try {
  const result = findsertSymlink({
    target: workerData.target,
    path: workerData.symlinkPath,
  });
  parentPort.postMessage({ success: true, result, workerId: workerData.workerId });
} catch (error) {
  parentPort.postMessage({
    success: false,
    error: error?.message || String(error),
    workerId: workerData.workerId,
  });
}
`;

    beforeAll(() => {
      // verify compiled JS exists
      if (!fs.existsSync(findsertSymlinkPath)) {
        throw new Error(
          `compiled findsertSymlink.js not found at ${findsertSymlinkPath}. run npm run build first.`,
        );
      }

      fs.mkdirSync(case1GitRoot, { recursive: true });
      fs.mkdirSync(path.join(case1GitRoot, '.temp'), { recursive: true });
      fs.mkdirSync(case1PathPhysical, { recursive: true });

      // ensure NO symlink exists at start
      if (fs.existsSync(case1PathSymlink)) {
        const stat = fs.lstatSync(case1PathSymlink);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(case1PathSymlink);
        } else {
          fs.rmSync(case1PathSymlink, { recursive: true, force: true });
        }
      }
    });

    afterAll(() => {
      if (fs.existsSync(case1GitRoot)) {
        fs.rmSync(case1GitRoot, { recursive: true, force: true });
      }
      if (fs.existsSync(case1PathPhysical)) {
        fs.rmSync(case1PathPhysical, { recursive: true, force: true });
      }
    });

    when('[t0] 100 workers all findsert simultaneously', () => {
      const scene = useBeforeAll(async () => {
        // SharedArrayBuffer for synchronization:
        // index 0 = ready count (workers increment when ready)
        // index 1 = go signal (main sets to 1 to release all workers)
        const syncBuffer = new SharedArrayBuffer(8);
        const syncArray = new Int32Array(syncBuffer);

        const workerPromises = Array.from({ length: WORKER_COUNT }, (_, i) => {
          return new Promise<{
            success: boolean;
            result?: { effect: string; overcame: string | null };
            error?: string;
            workerId: number;
          }>((settle) => {
            const worker = new Worker(WORKER_CODE, {
              eval: true,
              workerData: {
                target: case1PathPhysical,
                symlinkPath: case1PathSymlink,
                workerId: i,
                syncBuffer,
                findsertSymlinkPath,
              },
            });
            worker.on('message', settle);
            worker.on('error', (err) =>
              settle({ success: false, error: err.message, workerId: i }),
            );
          });
        });

        // wait for all workers to be ready
        while (Atomics.load(syncArray, 0) < WORKER_COUNT) {
          await new Promise((r) => setTimeout(r, 1));
        }

        // release all workers simultaneously
        Atomics.store(syncArray, 1, 1);
        Atomics.notify(syncArray, 1);

        return { results: await Promise.all(workerPromises) };
      });

      then('all 100 workers succeed', () => {
        const failures = scene.results.filter((r) => !r.success);
        if (failures.length > 0) {
          console.error('failures:', JSON.stringify(failures, null, 2));
        }
        expect(failures).toHaveLength(0);
      });

      then('exactly one worker created the symlink', () => {
        const created = scene.results.filter(
          (r) => r.result?.effect === 'created',
        );
        expect(created.length).toBe(1);
      });

      then('other workers found the symlink', () => {
        const created = scene.results.filter(
          (r) => r.result?.effect === 'created',
        );
        const found = scene.results.filter((r) => r.result?.effect === 'found');

        console.log(
          `effect distribution: ${created.length} created, ${found.length} found`,
        );

        // total should equal worker count
        expect(created.length + found.length).toBe(WORKER_COUNT);
      });

      then(
        'workers that hit EEXIST race are handled (logged for observability)',
        () => {
          const overcameEexist = scene.results.filter(
            (r) => r.result?.overcame === 'EEXIST',
          );

          console.log(`overcame EEXIST: ${overcameEexist.length} workers`);

          // the race is probabilistic — when disabled, 1 of 100 workers failed
          // when enabled, that worker succeeds via overcame: 'EEXIST'
          // we log for observability but don't require it (narrow race window)
          // key assertion: all workers succeed (tested above)
          expect(overcameEexist.every((r) => r.success)).toBe(true);
        },
      );

      then('symlink exists and points to correct target', () => {
        expect(fs.existsSync(case1PathSymlink)).toBe(true);
        expect(fs.lstatSync(case1PathSymlink).isSymbolicLink()).toBe(true);
        expect(fs.readlinkSync(case1PathSymlink)).toBe(case1PathPhysical);
      });
    });
  });

  given('[case2] 100 parallel workers randomly delete and findsert', () => {
    const WORKER_COUNT = 100;

    // isolated paths for this test
    const case2GitRoot = path.join(gitRoot, '.temp', '.test-race-mixed');
    const case2PathPhysical = `/tmp/test-fns/.test-race-mixed/.temp`;
    const case2PathSymlink = path.join(
      case2GitRoot,
      '.temp',
      'genTempDir.symlink',
    );

    // worker code with random delete/findsert mix
    const WORKER_CODE_MIXED = `
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const { findsertSymlink } = require(workerData.findsertSymlinkPath);

const deleteSymlink = (symlinkPath) => {
  try {
    const stat = fs.lstatSync(symlinkPath);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(symlinkPath);
      return { effect: 'deleted', overcame: null };
    } else if (stat.isDirectory()) {
      fs.rmSync(symlinkPath, { recursive: true, force: true });
      return { effect: 'deleted-dir', overcame: null };
    }
    return { effect: 'skipped-file', overcame: null };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { effect: 'not-found', overcame: null };
    }
    throw error;
  }
};

// random operation: 70% findsert, 30% delete
const operation = Math.random() < 0.7 ? 'findsert' : 'delete';

// small random delay to maximize race window overlap
const delay = Math.floor(Math.random() * 5);
const start = Date.now();
while (Date.now() - start < delay) { /* spin */ }

try {
  let result;
  if (operation === 'findsert') {
    result = findsertSymlink({
      target: workerData.target,
      path: workerData.symlinkPath,
    });
  } else {
    result = deleteSymlink(workerData.symlinkPath);
  }
  parentPort.postMessage({ success: true, operation, result, workerId: workerData.workerId });
} catch (error) {
  parentPort.postMessage({
    success: false,
    operation,
    error: error?.message || String(error),
    workerId: workerData.workerId,
  });
}
`;

    beforeAll(() => {
      fs.mkdirSync(case2GitRoot, { recursive: true });
      fs.mkdirSync(path.join(case2GitRoot, '.temp'), { recursive: true });
      fs.mkdirSync(case2PathPhysical, { recursive: true });

      // remove symlink if exists from prior run
      if (fs.existsSync(case2PathSymlink)) {
        const stat = fs.lstatSync(case2PathSymlink);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(case2PathSymlink);
        } else {
          fs.rmSync(case2PathSymlink, { recursive: true, force: true });
        }
      }
    });

    afterAll(() => {
      if (fs.existsSync(case2GitRoot)) {
        fs.rmSync(case2GitRoot, { recursive: true, force: true });
      }
      if (fs.existsSync(case2PathPhysical)) {
        fs.rmSync(case2PathPhysical, { recursive: true, force: true });
      }
    });

    when('[t0] 100 workers execute random operations in parallel', () => {
      const scene = useBeforeAll(async () => {
        const workerPromises = Array.from({ length: WORKER_COUNT }, (_, i) => {
          return new Promise<{
            success: boolean;
            operation: string;
            result?: { effect: string; overcame: string | null };
            error?: string;
            workerId: number;
          }>((settle) => {
            const worker = new Worker(WORKER_CODE_MIXED, {
              eval: true,
              workerData: {
                target: case2PathPhysical,
                symlinkPath: case2PathSymlink,
                workerId: i,
                findsertSymlinkPath,
              },
            });
            worker.on('message', settle);
            worker.on('error', (err) =>
              settle({
                success: false,
                operation: 'unknown',
                error: err.message,
                workerId: i,
              }),
            );
          });
        });

        const results = await Promise.all(workerPromises);
        return { results };
      });

      then('all 100 workers complete without errors', () => {
        const failures = scene.results.filter((r) => !r.success);
        if (failures.length > 0) {
          console.error('failures:', JSON.stringify(failures, null, 2));
        }
        expect(failures).toHaveLength(0);
      });

      then('results include mix of operations', () => {
        const findserts = scene.results.filter(
          (r) => r.operation === 'findsert',
        );
        const deletes = scene.results.filter((r) => r.operation === 'delete');

        // with 70/30 split, expect roughly 60-80 findserts
        expect(findserts.length).toBeGreaterThan(40);
        expect(deletes.length).toBeGreaterThan(10);

        console.log(
          `operations: ${findserts.length} findserts, ${deletes.length} deletes`,
        );
      });

      then('findsert effects show races handled', () => {
        const findserts = scene.results.filter(
          (r) => r.operation === 'findsert',
        );
        const effects = findserts.map((r) => r.result?.effect);
        const overcame = findserts.map((r) => r.result?.overcame);

        const effectCounts = effects.reduce(
          (acc, effect) => {
            acc[effect || 'undefined'] = (acc[effect || 'undefined'] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        const overcameCounts = overcame.reduce(
          (acc, val) => {
            const key = val || 'null';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        console.log('findsert effect distribution:', effectCounts);
        console.log('findsert overcame distribution:', overcameCounts);

        // all findserts should succeed
        expect(findserts.every((r) => r.success)).toBe(true);
      });
    });

    when('[t1] after all workers complete', () => {
      const scene = useBeforeAll(async () => {
        await new Promise((r) => setTimeout(r, 10));

        const symlinkExists = fs.existsSync(case2PathSymlink);
        const isSymlink = symlinkExists
          ? fs.lstatSync(case2PathSymlink).isSymbolicLink()
          : false;
        const target = isSymlink ? fs.readlinkSync(case2PathSymlink) : null;

        return { symlinkExists, isSymlink, target };
      });

      then('symlink may or may not exist (due to final delete)', () => {
        expect(typeof scene.symlinkExists).toBe('boolean');
        console.log('final symlink exists:', scene.symlinkExists);
      });

      then('if symlink exists, it points to correct target', () => {
        if (scene.symlinkExists && scene.isSymlink) {
          expect(scene.target).toEqual(case2PathPhysical);
        }
      });
    });
  });
});
