import { given, then, when } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { GATE_SWEPT_ENV_KEY } from './getOneRunId';
import {
  getOneMaxAgeMs,
  hasPrunedThisProcess,
  MAX_AGE_ENV_KEY,
  MAX_AGE_MS_DEFAULT,
  pruneStale,
  pruneStaleOnce,
  resetPruneThrottle,
} from './pruneStale';
import { genRunMarkerOpen, setRunMarker } from './runMarker';

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

  given('a run pre-empted mid-suite, whose residue has since aged out', () => {
    /**
     * .why = 🔴 case=4 END TO END, and it had no demo until this test.
     *
     *        every ATOM of case=4 was clamped — an aged dir is reclaimed (given 1),
     *        an aged marker is reclaimed (given 3), a STAMPED name still parses
     *        (computeStaleDirs `given('a stamped directory name')`). not one test
     *        staged the SCENARIO those atoms compose into, which is the wish's own
     *        bullet: a run dies to a signal, its teardown never fires, and the age
     *        gate is the ONLY mechanism left that will ever take what it left
     *
     *        the gap was invisible because the coverage table mapped case=4 to this
     *        file by NAME — "the age gate" — and this file does clamp the age gate
     *        thoroughly. a map from a scenario to a mechanism reads as coverage
     *        while it verifies a different question
     *
     * .note = the residue here is SHAPED like a real pre-empt, never merely old: a
     *         dir the killed run STAMPED with its own id, plus the `open` marker its
     *         teardown never settled. a bare unstamped dir would have passed this
     *         test while the stamp broke the gate — which is case=14's whole hazard
     */
    when('the next run in that scope fires the gate', () => {
      then(
        "🔴 it takes the killed run's stamped dir AND its unsettled marker",
        async () => {
          fs.mkdirSync(testTmpDir, { recursive: true });
          const runKilled = 'rdeadbee1';

          // the dir the killed run stamped, aged past the window
          const stampedAged = [
            new Date(Date.now() - 2 * ONE_HOUR_MS)
              .toISOString()
              .replace(/:/g, '-'),
            runKilled,
            'killed-mid-suite',
            'a1b2c3d4',
          ].join('.');
          fs.mkdirSync(path.join(testTmpDir, stampedAged));

          // the marker its teardown never settled — still `open`, and now aged
          setRunMarker({
            tmpDir: testTmpDir,
            marker: genRunMarkerOpen({
              run: runKilled,
              teardownWired: true,
            }),
          });
          const pathMarker = path.join(
            testTmpDir,
            `run.${runKilled}.marker.json`,
          );
          const aged = new Date(Date.now() - 2 * ONE_HOUR_MS);
          fs.utimesSync(pathMarker, aged, aged);

          // a LIVE peer's dir, minted this instant — the gate must not touch it
          const stampedFresh = [
            new Date().toISOString().replace(/:/g, '-'),
            'r99887766',
            'live-peer',
            'b2c3d4e5',
          ].join('.');
          fs.mkdirSync(path.join(testTmpDir, stampedFresh));

          const audit = await pruneStale({
            tmpDir: testTmpDir,
            maxAgeMs: ONE_HOUR_MS,
          });

          // the residue is GONE — the gate is the killed run's only reclaim
          expect(fs.existsSync(path.join(testTmpDir, stampedAged))).toEqual(
            false,
          );
          expect(fs.existsSync(pathMarker)).toEqual(false);
          expect(audit.dirsReclaimed).toContain(stampedAged);
          expect(audit.markersReclaimed).toContain(
            `run.${runKilled}.marker.json`,
          );

          // 🔴 and the stamp did not blind the gate. an unparseable name is
          // PRESERVED in silence by design, so a stamp in the wrong position
          // would leave this dir immortal while every assertion above still
          // passed on a bare name (case=14)
          expect(audit.namesUnreadable).toEqual([]);

          // the live peer is untouched — the gate fails toward LEAK, never LOSS
          expect(fs.existsSync(path.join(testTmpDir, stampedFresh))).toEqual(
            true,
          );
        },
      );
    });
  });

  given('a default window, with no maxAgeMs supplied', () => {
    when('pruneStale is called', () => {
      then('the window is 24 hours, not 7 days', async () => {
        fs.mkdirSync(testTmpDir, { recursive: true });

        // a dir aged past 24h, but well within any wider window
        const stampAged = new Date(Date.now() - 48 * ONE_HOUR_MS)
          .toISOString()
          .replace(/:/g, '-');
        const dirAged = `${stampAged}.two-days-old.a1b2c3d4`;
        fs.mkdirSync(path.join(testTmpDir, dirAged));

        // a dir aged past an hour, but within 24h
        const stampYoung = new Date(Date.now() - 6 * ONE_HOUR_MS)
          .toISOString()
          .replace(/:/g, '-');
        const dirYoung = `${stampYoung}.six-hours-old.b2c3d4e5`;
        fs.mkdirSync(path.join(testTmpDir, dirYoung));

        const audit = await pruneStale({ tmpDir: testTmpDir });

        expect(audit.dirsReclaimed).toEqual([dirAged]);
        expect(fs.existsSync(path.join(testTmpDir, dirYoung))).toBe(true);
      });

      // .why = 🔴 the key is cleared in a `finally`, never on the happy path alone.
      //        a single failed expect would otherwise leave `soon` or `-1` in the
      //        env for every later test in this file — and the key decides the age
      //        WINDOW, so the residue moves the very boundary the rest of this
      //        suite measures
      then('the window is configurable via env', () => {
        try {
          process.env[MAX_AGE_ENV_KEY] = String(ONE_HOUR_MS);
          expect(getOneMaxAgeMs()).toEqual(ONE_HOUR_MS);

          delete process.env[MAX_AGE_ENV_KEY];
          expect(getOneMaxAgeMs()).toEqual(MAX_AGE_MS_DEFAULT);
          expect(MAX_AGE_MS_DEFAULT).toEqual(24 * ONE_HOUR_MS);
        } finally {
          delete process.env[MAX_AGE_ENV_KEY];
        }
      });

      then('a junk env value falls back to the default, never to zero', () => {
        try {
          process.env[MAX_AGE_ENV_KEY] = 'soon';
          expect(getOneMaxAgeMs()).toEqual(MAX_AGE_MS_DEFAULT);

          process.env[MAX_AGE_ENV_KEY] = '-1';
          expect(getOneMaxAgeMs()).toEqual(MAX_AGE_MS_DEFAULT);
        } finally {
          delete process.env[MAX_AGE_ENV_KEY];
        }
      });
    });
  });

  given('run markers of various ages, beside the infra files', () => {
    when('pruneStale is called', () => {
      then(
        'it sweeps the aged marker a pre-empted run left behind',
        async () => {
          fs.mkdirSync(testTmpDir, { recursive: true });

          // the marker of a run pre-empted long ago — no teardown will ever settle it
          setRunMarker({
            tmpDir: testTmpDir,
            marker: genRunMarkerOpen({ teardownWired: true, run: 'raaaaaaaa' }),
          });
          const pathAged = path.join(testTmpDir, 'run.raaaaaaaa.marker.json');
          const whenAged = new Date(Date.now() - 48 * ONE_HOUR_MS);
          fs.utimesSync(pathAged, whenAged, whenAged);

          // the marker of a run still in flight
          setRunMarker({
            tmpDir: testTmpDir,
            marker: genRunMarkerOpen({ teardownWired: true, run: 'rbbbbbbbb' }),
          });

          const audit = await pruneStale({ tmpDir: testTmpDir });

          expect(audit.markersReclaimed).toEqual(['run.raaaaaaaa.marker.json']);
          expect(fs.existsSync(pathAged)).toBe(false);
        },
      );

      then(
        'a young OPEN marker survives — it is the arrears evidence',
        async () => {
          fs.mkdirSync(testTmpDir, { recursive: true });
          setRunMarker({
            tmpDir: testTmpDir,
            marker: genRunMarkerOpen({ teardownWired: true, run: 'rcccccccc' }),
          });

          await pruneStale({ tmpDir: testTmpDir });

          expect(
            fs.existsSync(path.join(testTmpDir, 'run.rcccccccc.marker.json')),
          ).toBe(true);
        },
      );

      then(
        'the marker sweep does not eat readme.md or .gitignore',
        async () => {
          fs.mkdirSync(testTmpDir, { recursive: true });
          const whenAged = new Date(Date.now() - 48 * ONE_HOUR_MS);
          for (const name of ['readme.md', '.gitignore']) {
            fs.writeFileSync(path.join(testTmpDir, name), 'x', 'utf8');
            fs.utimesSync(path.join(testTmpDir, name), whenAged, whenAged);
          }

          const audit = await pruneStale({ tmpDir: testTmpDir });

          expect(audit.markersReclaimed).toEqual([]);
          expect(fs.existsSync(path.join(testTmpDir, 'readme.md'))).toBe(true);
          expect(fs.existsSync(path.join(testTmpDir, '.gitignore'))).toBe(true);
        },
      );
    });
  });

  given('a dir whose name the gate cannot read', () => {
    when('pruneStale is called', () => {
      then(
        'it preserves the dir AND reports that it could not read it',
        async () => {
          fs.mkdirSync(testTmpDir, { recursive: true });
          fs.mkdirSync(path.join(testTmpDir, 'a-name-we-did-not-mint'));

          const audit = await pruneStale({ tmpDir: testTmpDir });

          expect(
            fs.existsSync(path.join(testTmpDir, 'a-name-we-did-not-mint')),
          ).toBe(true);
          expect(audit.namesUnreadable).toEqual(['a-name-we-did-not-mint']);
        },
      );
    });
  });

  given('an aged dir the gate cannot remove', () => {
    when('pruneStale is called', () => {
      then('it names the residue rather than swallow the failure', async () => {
        fs.mkdirSync(testTmpDir, { recursive: true });

        const stampAged = new Date(Date.now() - 48 * ONE_HOUR_MS)
          .toISOString()
          .replace(/:/g, '-');
        const dirAged = `${stampAged}.stuck.c3d4e5f6`;
        const pathSealed = path.join(testTmpDir, dirAged, 'sealed');
        fs.mkdirSync(pathSealed, { recursive: true });
        fs.writeFileSync(path.join(pathSealed, 'child.txt'), 'x', 'utf8');
        fs.chmodSync(pathSealed, 0o500);

        const audit = await pruneStale({ tmpDir: testTmpDir });

        // unseal so afterEach can reclaim it
        fs.chmodSync(pathSealed, 0o700);

        expect(audit.dirsReclaimed).toEqual([]);
        expect(audit.residue).toHaveLength(1);
        expect(audit.residue[0]?.errno).toEqual('EACCES');
        expect(audit.residue[0]?.path).toContain(dirAged);
      });
    });
  });
});

describe('pruneStaleOnce', () => {
  const testTmpDir = path.join(__dirname, '.test-tmp-prune-once');

  // 🔴 this repo DOGFOODS the autoprune hooks, so its own `setupAutoprune` stamps
  // the sweep key on every run of this very suite — which `pruneStaleOnce` obeys.
  // a test that reads the gate must therefore OWN the key rather than inherit it,
  // or it grades the host runner's config instead of the product.
  //
  // .note = a test that reads only `prunedThisProcess` is silently dependent on an
  //         unhooked host, which is a dependency no assertion states and no reader
  //         can see
  const sweptBeforeSuite = process.env[GATE_SWEPT_ENV_KEY];
  beforeEach(() => {
    delete process.env[GATE_SWEPT_ENV_KEY];
  });
  afterAll(() => {
    if (sweptBeforeSuite !== undefined)
      process.env[GATE_SWEPT_ENV_KEY] = sweptBeforeSuite;
  });

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

  given('[case2] a RUN whose global setup already swept the age gate', () => {
    // .why THIS EXISTS = the skip lives in the OPERATION, keyed on a stamp that
    //      records the sweep itself — so a test can reach it here rather than only
    //      through a caller's branch. and the collapse is an improvement only if
    //      the cost the branch saved is still saved.
    //
    //      that cost is real: this runs per WORKER, so an unconditional sweep
    //      costs one full directory scan per worker per invocation. so the saving
    //      is clamped rather than assumed — a stamped env must reach ZERO dirs, or
    //      the collapse traded a code path for a regression in the exact
    //      environment this behavior exists for
    //      (`rule.require.fewer-paths-via-idempotency`)
    when('[t0] a worker calls genTempDir under that run', () => {
      then(
        '🔴 the gate does NOT sweep again — the stamp is obeyed',
        async () => {
          fs.mkdirSync(testTmpDir, { recursive: true });

          // an aged dir the gate WOULD take, were it to run
          const oldTimestamp = new Date(Date.now() - 2 * ONE_HOUR_MS)
            .toISOString()
            .replace(/:/g, '-');
          const aged = `${oldTimestamp}._.swept-test.c3d4e5f6`;
          fs.mkdirSync(path.join(testTmpDir, aged));

          const sweptBefore = process.env[GATE_SWEPT_ENV_KEY];
          try {
            process.env[GATE_SWEPT_ENV_KEY] = new Date().toISOString();
            await pruneStaleOnce({ tmpDir: testTmpDir, maxAgeMs: ONE_HOUR_MS });
            await new Promise((done) => setTimeout(done, 50));
          } finally {
            if (sweptBefore === undefined)
              delete process.env[GATE_SWEPT_ENV_KEY];
            if (sweptBefore !== undefined)
              process.env[GATE_SWEPT_ENV_KEY] = sweptBefore;
          }

          // 🔴 the dir survives, which is the whole point: the setup already swept
          // in the main process, so a per-worker pass would be pure redundant cost
          expect(fs.existsSync(path.join(testTmpDir, aged))).toBe(true);

          // and the throttle was never even armed — it returned before that
          expect(hasPrunedThisProcess()).toBe(false);
        },
      );
    });

    when('[t1] the SAME call with no stamp set', () => {
      then(
        '🔴 it sweeps — so [t0] proves the stamp, not a dead call',
        async () => {
          // .why = guard the guard. [t0] passes vacuously if this operation never
          //        reaps under these fixtures for any other reason — a bad name, a
          //        wrong maxAge, a path that does not exist. this is the same
          //        fixture with the ONE variable changed
          fs.mkdirSync(testTmpDir, { recursive: true });

          const oldTimestamp = new Date(Date.now() - 2 * ONE_HOUR_MS)
            .toISOString()
            .replace(/:/g, '-');
          const aged = `${oldTimestamp}._.swept-test.c3d4e5f6`;
          fs.mkdirSync(path.join(testTmpDir, aged));

          const sweptBefore = process.env[GATE_SWEPT_ENV_KEY];
          try {
            delete process.env[GATE_SWEPT_ENV_KEY];
            await pruneStaleOnce({ tmpDir: testTmpDir, maxAgeMs: ONE_HOUR_MS });
            await new Promise((done) => setTimeout(done, 50));
          } finally {
            if (sweptBefore !== undefined)
              process.env[GATE_SWEPT_ENV_KEY] = sweptBefore;
          }

          expect(fs.existsSync(path.join(testTmpDir, aged))).toBe(false);
          expect(hasPrunedThisProcess()).toBe(true);
        },
      );
    });
  });
});
