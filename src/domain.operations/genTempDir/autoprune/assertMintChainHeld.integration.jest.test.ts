/**
 * .what = clamps the mint-chain invariant — the guard that catches the ONE failure
 *         this whole behavior exists to end: dirs land unstamped, the reclaim
 *         matches zero, and the suite stays GREEN while the leak resumes
 * .why = 🔴 `assertMintChainHeld` is the guard this file exists to exercise, and it
 *        is the runtime invariant the vision leans on in place of a probe of jest's
 *        undocumented env handoff (assumption A1), so it is the one guard that ships
 *        to every consumer's machine and fires years from now on a runner upgrade.
 *        an unexercised guard is a guess, and this one guards the design's linchpin
 *
 * .note = the four cases below are not four scenarios; they are the FOUR REASONS
 *         the predicate is an ORPHAN rather than a delta, each turned into a test:
 *           [case2] it fires when the chain truly breaks
 *           [case3] a live PEER cannot trip it — the delta form's false positive
 *           [case4] an unhooked run's older residue cannot trip it
 *           [case5] a hand-rolled teardown cannot trip it — it leaves no entry
 *         a reason with no test is a reason that decays into a comment
 */
import { genTempDir, given, then, when } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeTempDirName } from '../computeTempDirName';
import { assertMintChainHeld } from './assertMintChainHeld';

/** the moment every check in this file treats as "when our run began" */
const SINCE: Date = new Date(Date.now() - 60 * 1000);

/** a run id that is ours, and one that belongs to a peer */
const RUN_OURS = 'ra1b2c3d4';
const RUN_PEER = 'rf9e8d7c6';

/**
 * .what = makes one temp dir inside a sandbox, with the run stamp asked for
 * .why = the guard reads NAMES off the disk, so the fixture must be a real entry
 *        rather than a stub — a stub would clamp a shape we invented
 */
const setOneDir = (input: {
  tmpDir: string;
  slug: string;
  run: string | null;
}): string => {
  const name = computeTempDirName({ slug: input.slug, run: input.run });
  fs.mkdirSync(path.join(input.tmpDir, name));
  return name;
};

/** ages one entry back past our own start, so it is not ours to judge */
const setEntryOlderThanUs = (input: { tmpDir: string; name: string }): void => {
  const past = new Date(SINCE.getTime() - 60 * 1000);
  fs.utimesSync(path.join(input.tmpDir, input.name), past, past);
};

/** runs the guard against a sandbox, and yields the error it threw, if any */
const getOneErrorThrown = (input: { tmpDir: string }): Error | null => {
  try {
    assertMintChainHeld({
      tmpDir: input.tmpDir,
      run: RUN_OURS,
      since: SINCE,
      runner: 'jest',
    });
    return null;
  } catch (error) {
    // narrowed, never cast. a non-Error throw re-throws rather than masquerade as
    // an Error — a cast here would let `String(error)` read as a message on every
    // assertion below, so the clamp would report on a shape it never verified
    if (!(error instanceof Error)) throw error;
    return error;
  }
};

describe('assertMintChainHeld', () => {
  given('[case1] a run whose stamp DID reach the workers', () => {
    when('[t0] the chain is checked, even beside an unstamped dir', () => {
      then('it says no word — term 2 short-circuits the check', () => {
        const tmpDir = genTempDir({ slug: 'mintchain-held' });
        setOneDir({ tmpDir, slug: 'ours', run: RUN_OURS });
        setOneDir({ tmpDir, slug: 'orphan', run: null });

        // .why = one dir carries our id, so the chain demonstrably held. an
        //        unstamped dir beside it is someone else's business — a consumer
        //        may allocate through a second path we do not stamp
        expect(getOneErrorThrown({ tmpDir })).toEqual(null);
      });
    });
  });

  given('[case2] a run whose stamp reached NO worker', () => {
    when('[t0] the chain is checked', () => {
      then('🔴 it throws, and the throw names what a maintainer needs', () => {
        const tmpDir = genTempDir({ slug: 'mintchain-broken' });
        const nameOrphan = setOneDir({ tmpDir, slug: 'orphan', run: null });

        const error = getOneErrorThrown({ tmpDir });

        // guard the guard: an absent throw here would make every assertion
        // below vacuous, so the shape is pinned before it is read
        expect(error).not.toEqual(null);
        expect(error?.message).toContain('never reached the workers');

        // it must name the runner VERSION, because the report's whole value is
        // that it sends a maintainer to the handoff that broke
        const spoken = String(error?.message) + JSON.stringify(error);
        expect(spoken).toContain(nameOrphan);
        expect(spoken).toContain(RUN_OURS);
        expect(spoken).toContain(process.version);
      });
    });
  });

  given(
    '[case3] a LIVE PEER run allocates beside us, and we match zero',
    () => {
      when('[t0] the chain is checked', () => {
        then(
          '🔴 it says no word — the delta form would have accused us here',
          () => {
            const tmpDir = genTempDir({ slug: 'mintchain-peer' });
            setOneDir({ tmpDir, slug: 'theirs-1', run: RUN_PEER });
            setOneDir({ tmpDir, slug: 'theirs-2', run: RUN_PEER });

            // .why = the root GREW, and not one dir is ours — the exact input a
            //        delta predicate reads as a broken chain. a peer's dir carries
            //        the PEER's stamp, so it can never satisfy the orphan term.
            //        the false positive is excluded BY CONSTRUCTION, which is rung
            //        1 of prevent-over-correct rather than a sharper check
            expect(getOneErrorThrown({ tmpDir })).toEqual(null);
          },
        );
      });
    },
  );

  given(
    '[case4] an UNHOOKED run left unstamped residue before we began',
    () => {
      when('[t0] the chain is checked', () => {
        then('it says no word — the residue predates our own window', () => {
          const tmpDir = genTempDir({ slug: 'mintchain-stale' });
          const name = setOneDir({ tmpDir, slug: 'not-ours', run: null });
          setEntryOlderThanUs({ tmpDir, name });

          // .why = FRESH means "made since THIS run began", never "within the age
          //        window". a window as wide as the gate's would trip on any
          //        unhooked run of the past day — residue that is genuinely
          //        someone else's, and genuinely no evidence about our own chain
          expect(getOneErrorThrown({ tmpDir })).toEqual(null);
        });
      });
    },
  );

  given('[case5] a consumer who kept a hand-rolled afterEach teardown', () => {
    when('[t0] the chain is checked, and the root is bare', () => {
      then('it says no word — they leave no entry to find', () => {
        const tmpDir = genTempDir({ slug: 'mintchain-handrolled' });

        // .why = their own teardown deleted our dirs before we looked, so we
        //        match zero AND find no orphan. this is the third term the
        //        orphan predicate SUBSUMES: a delta form would have told a
        //        healthy consumer to file an issue against us
        expect(getOneErrorThrown({ tmpDir })).toEqual(null);
      });
    });
  });

  given('[case6] a root that does not exist at all', () => {
    when('[t0] the chain is checked', () => {
      then('it says no word rather than throw on the readdir', () => {
        const tmpDir = path.join(
          genTempDir({ slug: 'mintchain-absent' }),
          'never-made',
        );

        expect(fs.existsSync(tmpDir)).toEqual(false);
        expect(getOneErrorThrown({ tmpDir })).toEqual(null);
      });
    });
  });
});
