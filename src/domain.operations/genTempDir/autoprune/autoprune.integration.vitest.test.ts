/**
 * .what = the A2b probe — does the run id survive VITEST's worker pool?
 * .why = the whole design rests on one env value that must cross from the runner's
 *        main process into the workers that allocate dirs. jest's fork hop is
 *        proven by `autoprune.acceptance.jest.test.ts`; vitest's is a SEPARATE
 *        mechanism — its pool may be threads or forks, and those differ in whether
 *        `process.env` is shared or copied. so jest's proof transfers not at all
 *
 * .note = 🔴 this file exists because the acid test was GREEN AND BLIND. a count of
 *         dirs before and after `npm test` proved zero leak — but not one vitest
 *         test in this repo called `genTempDir`, so the vitest half of that count
 *         was zero over zero. a clamp that cannot observe the mechanism it guards
 *         reports the same green whether the mechanism works or is absent
 *
 * .note = it asserts the STAMP rather than the reclaim. the reclaim runs at this
 *         run's globalTeardown, which is strictly after every test file — so a
 *         test cannot observe it. the stamp is the half that must cross the pool,
 *         and it is the half that can silently break
 */
import { describe, expect } from 'vitest';

import { bdd } from '@src/domain.operations/givenWhenThen';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { asTempDirRun } from '../computeTempDirName';
import { genTempDir } from '../genTempDir';
import { getOneTempDirRoot } from '../getOneTempDirRoot';

// .note = destructured from `bdd` rather than imported by name, and typed here
//         because vitest cannot import a `then` export at all — the thenable
//         protocol resolves it (see limitation.esm-thenable-then-export)
const { given, when, then }: typeof bdd = bdd;

describe("autoprune (J3 — the A2b probe: vitest's pool)", () => {
  given('[case1] a vitest run whose globalSetup minted a run id', () => {
    when('[t0] a TEST FILE — inside the pool — reads the env', () => {
      then('the id arrived past the pool boundary', () => {
        // .why = this is A2b itself. red here means vitest copies or drops the env
        //        between its main process and its pool, so every dir a vitest run
        //        makes lands unstamped and survives its own teardown
        expect(process.env.TEST_FNS_RUN).toMatch(/^r[a-f0-9]{8}$/);
      });
    });

    when('[t1] that same test file allocates a temp dir', () => {
      then("the dir it made carries THIS run's id", () => {
        // .why = an env value present in the pool is necessary but insufficient —
        //        the read happens at genEphemeralTempDir, several modules deep, and
        //        vitest resolves those modules through its OWN transform pipeline
        const dirPath = genTempDir({ slug: 'j3-vitest-pool' });
        const run = asTempDirRun({ dirName: path.basename(dirPath) });
        expect(run).toEqual(process.env.TEST_FNS_RUN);
      });

      then(
        'that dir sits under BOTH views of the root the contract exports',
        () => {
          // .why = the reclaim sweeps the root `getOneTempDirRoot` names. were a
          //        vitest run to allocate somewhere else, the stamp would be right
          //        and the reclaim would still find zero
          //
          // .note = 🔴 `genTempDir` yields the SYMLINK view, never the physical one.
          //         a consumer who compares its parent against `pathPhysical` gets a
          //         mismatch on two paths that name the same place — which is exactly
          //         why the export yields BOTH rather than choose for the caller. this
          //         probe made that mistake first, so it now clamps the distinction
          const dirPath = genTempDir({ slug: 'j3-vitest-root' });
          const { pathPhysical, pathSymlink } = getOneTempDirRoot();

          expect(fs.existsSync(dirPath)).toEqual(true);
          expect(path.dirname(dirPath)).toEqual(pathSymlink);

          // and the SAME dir is visible through the physical view the reclaim sweeps
          const dirName = path.basename(dirPath);
          expect(fs.existsSync(path.join(pathPhysical, dirName))).toEqual(true);
        },
      );
    });
  });
});
