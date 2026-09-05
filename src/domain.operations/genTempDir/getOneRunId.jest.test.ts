/**
 * .what = clamps the run id's mint, its grammar, and the boundary between them
 * .why = 🔴 this module had NO test at all, while it declared two facts that must
 *        agree — `genRunId` mints the id, `RUN_STAMP_PATTERN` is the shape every
 *        reader parses it by — and no clamp held them to each other. its own doc
 *        says "the two facts must agree and a reader must not have to find the
 *        second one"; a doc is not a clamp
 *
 * .note = a unit test, never an integration one. `process.env` is process memory,
 *         not a remote boundary — no fs, no db, no network
 *         (`rule.forbid.unit.remote-boundaries`)
 */
import { getError, given, then, when } from '@src/contract';

import {
  genRunId,
  getOneRunId,
  RUN_ID_ENV_KEY,
  RUN_STAMP_PATTERN,
} from './getOneRunId';

/**
 * .what = runs one act with the run-id env key set to a given value, then restores it
 * .why = the key is process-wide, so a leak of it here would stamp the OUTER run's
 *        own fixture dirs with a value this test chose — the same hazard that keeps
 *        every other clamp in this suite restoring in a `finally`
 */
const withRunIdEnv = <T>(input: { value: string | null }, act: () => T): T => {
  const before = process.env[RUN_ID_ENV_KEY];
  try {
    if (input.value === null) delete process.env[RUN_ID_ENV_KEY];
    if (input.value !== null) process.env[RUN_ID_ENV_KEY] = input.value;
    return act();
  } finally {
    if (before === undefined) delete process.env[RUN_ID_ENV_KEY];
    if (before !== undefined) process.env[RUN_ID_ENV_KEY] = before;
  }
};

describe('getOneRunId', () => {
  given('[case1] the mint and the grammar that reads it back', () => {
    // .note = minted inline, never via `useThen`. that helper exists to share an
    //         EXPENSIVE result, and it hands back a deferred proxy — through which
    //         neither iteration nor `instanceof` passes. a mint of 50 ids is cheap,
    //         so the proxy would buy a defect and no speed
    //         (`rule.forbid.redundant-expensive-operations` bounds itself to
    //         operations with a real cost)
    const genAllMinted = (): string[] =>
      Array.from({ length: 50 }, () => genRunId());

    when('[t0] a batch of ids is minted', () => {
      then(
        '🔴 every one of them matches the grammar every reader parses by',
        () => {
          // .why = a divergence here is the design's worst mode: the stamp lands on
          //        the dir, no reader can read it back, and the reclaim matches zero
          //        under a green suite. the mint's assert catches it at the mint, but
          //        only once a run reaches the mint — this holds the two facts direct
          for (const id of genAllMinted())
            expect(id).toMatch(RUN_STAMP_PATTERN);
        },
      );

      then(
        'they are distinct, so two runs cannot claim one set of dirs',
        () => {
          const minted = genAllMinted();
          expect(new Set(minted).size).toEqual(minted.length);
        },
      );
    });
  });

  given('[case2] no run id in the env — an unhooked consumer', () => {
    when('[t0] the run id is read', () => {
      then('it yields null rather than throw', () => {
        // .why = unhooked is the DEFAULT state of every consumer on release day.
        //        it must be a quiet null, never an error — case=7 owns the notice
        expect(withRunIdEnv({ value: null }, () => getOneRunId())).toEqual(
          null,
        );
      });
    });
  });

  given('[case3] a well-formed run id in the env', () => {
    when('[t0] the run id is read', () => {
      then('it yields the id unchanged', () => {
        const run = genRunId();
        expect(withRunIdEnv({ value: run }, () => getOneRunId())).toEqual(run);
      });
    });
  });

  given('[case4] a MALFORMED run id in the env', () => {
    // .note = read inline per assertion rather than shared through `useThen`, whose
    //         deferred proxy `instanceof` cannot see through. a synchronous throw
    //         costs microseconds, so there is no expense to amortize
    const getOneRefusal = (value: string): Error =>
      withRunIdEnv({ value }, () => getError(() => getOneRunId()));

    /**
     * .what = the words the refusal must carry, asserted rather than `instanceof`
     * .why = 🔴 a bite probe caught these assertions green on the very defect they
     *        were written to catch. with the validation reverted, `getOneRunId`
     *        returns the bad value and throws no error — but `getError` hands back
     *        an Error ANYWAY (its own "no error was thrown" report), so
     *        `toBeInstanceOf(Error)` held on both sides of the fix
     *
     *        the lesson generalizes past this file: an assertion on a value's TYPE
     *        cannot discriminate when the failure path yields that same type. the
     *        assertion has to name a fact only the intended error carries
     */
    const REFUSAL_WORDS = 'is not a run id';

    when('[t0] the run id is read', () => {
      then('🔴 it throws at the boundary, never hands the value onward', () => {
        // .why = handed onward, this value rode two modules to computeTempDirName,
        //        whose assert threw "minted a temp dir name whose run stamp does
        //        not parse back" — our mint blamed for their env
        expect(getOneRefusal('hello world').message).toContain(REFUSAL_WORDS);
      });

      then('it names the env variable at fault', () => {
        expect(getOneRefusal('hello world').message).toContain(RUN_ID_ENV_KEY);
      });

      then('it names the fix, not merely the symptom', () => {
        // .why = `rule.require.errors-name-the-fix` — a human who set this by hand
        //        must be told to unset it, and told who sets it for them instead
        expect(JSON.stringify(getOneRefusal('hello world'))).toContain('unset');
      });

      then('it quotes the offending value back', () => {
        expect(JSON.stringify(getOneRefusal('hello world'))).toContain(
          'hello world',
        );
      });
    });

    when('[t1] the value is close, but not the shape', () => {
      then('a bare hex with no r prefix is refused', () => {
        expect(getOneRefusal('a1b2c3d4').message).toContain(REFUSAL_WORDS);
      });

      then('a stamp of the wrong length is refused', () => {
        // .why = the length is what the reader anchors on, so an id one char short
        //        parses back as null and reaps not one dir
        expect(getOneRefusal('ra1b2c3d').message).toContain(REFUSAL_WORDS);
      });

      then('a non-hex body is refused', () => {
        expect(getOneRefusal('rzzzzzzzz').message).toContain(REFUSAL_WORDS);
      });
    });
  });
});
