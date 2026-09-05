import { getError, given, then, when } from '@src/contract';

import {
  asTempDirRun,
  asTempDirTimestamp,
  computeTempDirName,
} from './computeTempDirName';
import { isTempDir } from './isTempDir';

describe('computeTempDirName', () => {
  given('computeTempDirName is called', () => {
    when('invoked', () => {
      then('it returns a string with iso timestamp prefix', () => {
        const dirName = computeTempDirName({ slug: 'test-slug', run: null });
        expect(dirName).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\./,
        );
      });

      then('timestamp is parseable as a date', () => {
        const dirName = computeTempDirName({ slug: 'test-slug', run: null });
        const parsed = asTempDirTimestamp({ dirName });
        expect(parsed).toBeInstanceOf(Date);
        expect(parsed?.getTime()).toBeLessThanOrEqual(Date.now());
      });

      then('it includes the slug in the directory name', () => {
        const dirName = computeTempDirName({ slug: 'my-test', run: null });
        expect(dirName).toContain('.my-test.');
      });

      then(
        '🔴 it emits the run slot even with no run — one arity, always',
        () => {
          // .why = the whole point of the sentinel. an optional slot forced every
          //        reader to find the run by POSITION and confirm it by SHAPE, which
          //        is what let a run-shaped slug read back as a run
          const dirName = computeTempDirName({ slug: 'my-test', run: null });
          expect(dirName).toContain('._.my-test.');

          const stamped = computeTempDirName({
            slug: 'my-test',
            run: 'r7f3a91c2',
          });
          expect(dirName.split('.').length).toEqual(stamped.split('.').length);
        },
      );

      then('it includes 8-char uuid suffix', () => {
        const dirName = computeTempDirName({ slug: 'test-slug', run: null });
        expect(dirName).toMatch(/\.[a-f0-9]{8}$/i);
      });

      then('it returns unique value on each call', () => {
        const dirName1 = computeTempDirName({ slug: 'test-slug', run: null });
        const dirName2 = computeTempDirName({ slug: 'test-slug', run: null });
        expect(dirName1).not.toEqual(dirName2);
      });
    });
  });

  given('a run id to stamp', () => {
    when('the name is minted', () => {
      then('it folds the run id INSIDE the slug segment', () => {
        const dirName = computeTempDirName({
          slug: 'my-test',
          run: 'r7f3a91c2',
        });
        expect(dirName).toContain('.r7f3a91c2.my-test.');
      });

      then('the age gate can still read its timestamp', () => {
        const dirName = computeTempDirName({
          slug: 'my-test',
          run: 'r7f3a91c2',
        });
        expect(asTempDirTimestamp({ dirName })).toBeInstanceOf(Date);
      });

      then('isTempDir still claims it as ours', () => {
        const dirName = computeTempDirName({
          slug: 'my-test',
          run: 'r7f3a91c2',
        });
        expect(isTempDir({ path: dirName })).toBe(true);
      });

      then('the run id parses back out', () => {
        const dirName = computeTempDirName({
          slug: 'my-test',
          run: 'r7f3a91c2',
        });
        expect(asTempDirRun({ dirName })).toEqual('r7f3a91c2');
      });
    });
  });

  given('a run id the readers could NOT parse back', () => {
    when('the name is minted', () => {
      then('it throws, before any dir is made', () => {
        const error = getError(() =>
          computeTempDirName({ slug: 'my-test', run: 'not-a-run-id' }),
        );
        expect(error.message).toContain('run stamp does not parse back');
      });

      then('it names the shape a run id must take', () => {
        const error = getError(() =>
          computeTempDirName({ slug: 'my-test', run: 'R7F3A91C2XX' }),
        );
        expect(error.message).toContain('run stamp does not parse back');
      });
    });
  });

  given('an UNHOOKED run whose slug is shaped like a run stamp', () => {
    // .why THIS CASE = the mint ACCEPTS it, and must never throw. an optional run
    //      slot would put the slug in the run's position, where `r` + 8 hex reads
    //      back as an id no run ever minted — and the mint would then have to
    //      reject the consumer's own slug to stay correct. the slot is ALWAYS
    //      emitted, so the collision is unreachable rather than caught, and no
    //      constraint on slugs is owed
    //      (`rule.prefer.prevent-over-correct`, rung 1 over rung 3)
    //
    // .note = the assertions below check MESSAGES, never mere definedness. an
    //         `expect(error).toBeDefined()` over a `getError` result cannot observe
    //         this case at all: `getError` yields a `NoErrorThrownError` when the
    //         call does NOT throw — an object that is, of course, defined. *an
    //         assertion that cannot observe its own subject's absence is not a
    //         test of it* (`rule.forbid.failhide`)
    when('[t0] the name is minted', () => {
      then('🔴 it is ACCEPTED — no slug is rejected for its shape', () => {
        const dirName = computeTempDirName({ slug: 'rdeadbeef', run: null });
        expect(isTempDir({ path: dirName })).toEqual(true);
      });

      then(
        '🔴 the slug does NOT parse back as a run — the slot says none',
        () => {
          // 🔴 the assertion that carries the weight. were the slug taken for a run,
          // this dir would carry a phantom id: no run's reclaim would ever match it
          // and the age gate alone would stand between it and immortality
          const dirName = computeTempDirName({ slug: 'rdeadbeef', run: null });
          expect(asTempDirRun({ dirName })).toBeNull();
          expect(dirName).toContain('._.rdeadbeef.');
        },
      );

      then('the age gate can still read its timestamp', () => {
        const dirName = computeTempDirName({ slug: 'rdeadbeef', run: null });
        expect(asTempDirTimestamp({ dirName })).toBeInstanceOf(Date);
      });
    });

    when('[t1] the SAME slug is used on an ENHOOKED run', () => {
      then('the real stamp takes the slot, and the slug stays a slug', () => {
        const dirName = computeTempDirName({
          slug: 'rdeadbeef',
          run: 'r7f3a91c2',
        });
        expect(asTempDirRun({ dirName })).toEqual('r7f3a91c2');
        expect(dirName).toContain('.r7f3a91c2.rdeadbeef.');
      });
    });

    when('[t2] the slug is the run slot sentinel itself', () => {
      then(
        '🔴 even `_` is a legal slug — position decides, never shape',
        () => {
          // .why = the sentinel is a value in ONE position, never a reserved word.
          //        a consumer who slugs a dir `_` must not collide with it, and the
          //        fixed arity is what makes that true by construction
          const dirName = computeTempDirName({ slug: '_', run: null });
          expect(asTempDirRun({ dirName })).toBeNull();
          expect(isTempDir({ path: dirName })).toEqual(true);

          const stamped = computeTempDirName({ slug: '_', run: 'r7f3a91c2' });
          expect(asTempDirRun({ dirName: stamped })).toEqual('r7f3a91c2');
        },
      );
    });
  });
});

describe('asTempDirRun', () => {
  given('a stamped temp directory name', () => {
    when('parsed', () => {
      then('it returns the run id', () => {
        expect(
          asTempDirRun({
            dirName: '2026-01-19T12-34-56.789Z.r7f3a91c2.my-test.a1b2c3d4',
          }),
        ).toEqual('r7f3a91c2');
      });

      then('it reads a slug that carries dots of its own', () => {
        expect(
          asTempDirRun({
            dirName:
              '2026-01-19T12-34-56.789Z.r7f3a91c2.my.dotted.slug.a1b2c3d4',
          }),
        ).toEqual('r7f3a91c2');
      });
    });
  });

  given('an unstamped temp directory name — the run slot holds `_`', () => {
    when('parsed', () => {
      then('it returns null', () => {
        expect(
          asTempDirRun({
            dirName: '2026-01-19T12-34-56.789Z._.my-test.a1b2c3d4',
          }),
        ).toBeNull();
      });

      then('a dotted slug is not mistaken for a run id', () => {
        expect(
          asTempDirRun({
            dirName: '2026-01-19T12-34-56.789Z._.my.dotted.slug.a1b2c3d4',
          }),
        ).toBeNull();
      });
    });
  });

  given('a LEGACY name, minted before the run slot existed', () => {
    // .why = the age gate must still reclaim the population it made under the old
    //        three-segment shape. a grammar that rejected these would PRESERVE
    //        them — an unreadable name is never removed — so every pre-upgrade dir
    //        would be stranded on disk forever, which is the exact outcome this
    //        behavior exists to prevent
    when('[t0] parsed', () => {
      then(
        '🔴 it is still claimed as ours, so the age gate can reap it',
        () => {
          const dirName = '2026-01-19T12-34-56.789Z.my-test.a1b2c3d4';
          expect(isTempDir({ path: dirName })).toEqual(true);
          expect(asTempDirTimestamp({ dirName })).toBeInstanceOf(Date);
        },
      );

      then('it names no run, so no run-scoped reclaim claims it', () => {
        expect(
          asTempDirRun({
            dirName: '2026-01-19T12-34-56.789Z.my-test.a1b2c3d4',
          }),
        ).toBeNull();
      });

      then('a legacy dotted slug is not mistaken for a run id', () => {
        expect(
          asTempDirRun({
            dirName: '2026-01-19T12-34-56.789Z.my.dotted.slug.a1b2c3d4',
          }),
        ).toBeNull();
      });
    });
  });

  given('a name that is not ours at all', () => {
    when('parsed', () => {
      then('it returns null', () => {
        expect(asTempDirRun({ dirName: 'random-folder' })).toBeNull();
        expect(asTempDirRun({ dirName: '' })).toBeNull();
      });
    });
  });
});

describe('asTempDirTimestamp', () => {
  given('a valid temp directory name', () => {
    when('parsed', () => {
      then('it returns the correct date', () => {
        const dirName = '2026-01-19T12-34-56.789Z.my-test.a1b2c3d4';
        const parsed = asTempDirTimestamp({ dirName });
        expect(parsed).toBeInstanceOf(Date);
        expect(parsed?.toISOString()).toEqual('2026-01-19T12:34:56.789Z');
      });
    });
  });

  given('an invalid directory name', () => {
    when('parsed', () => {
      then('it returns null for malformed names', () => {
        expect(asTempDirTimestamp({ dirName: 'not-a-valid-dir' })).toBeNull();
        expect(asTempDirTimestamp({ dirName: 'random-folder' })).toBeNull();
        expect(asTempDirTimestamp({ dirName: '' })).toBeNull();
      });

      then('it returns null for names with invalid timestamps', () => {
        expect(
          asTempDirTimestamp({ dirName: 'invalid-date.a1b2c3d4' }),
        ).toBeNull();
      });
    });
  });
});

/**
 * .what = clamps that every reader of a temp dir name reads the SAME grammar
 * .why = 🔴 a YAGNI pass found that grammar written twice — character-identical, in
 *        `isTempDir` and in `asTempDirTimestamp` — with only a prose `.note` to
 *        link them. one rule decides three things (what the age gate reclaims, what
 *        the public predicate admits, what a consumer's clamp counts), so an edit to
 *        one copy splits the three apart, in silence, with every test green
 *
 * .note = they now share one exported constant, so agreement holds BY CONSTRUCTION.
 *         this is the clamp that catches a future re-split — the one way the defect
 *         can return
 */
describe('the temp dir name grammar (one rule, one copy)', () => {
  /** names that span the shapes the readers must agree about */
  const NAMES = [
    // a plain minted name
    '2026-01-19T12-34-56.789Z.my-test.a1b2c3d4',
    // a stamped one — the run id folded into the slug segment
    '2026-01-19T12-34-56.789Z.r7f3a91c2.my-test.a1b2c3d4',
    // a slug with dots of its own, which the `.+` segment must still admit
    '2026-01-19T12-34-56.789Z.a.b.c.a1b2c3d4',
    // near misses, each wrong in exactly one segment
    '2026-01-19T12-34-56.789Z.my-test.a1b2c3d',
    '2026-01-19T12-34-56.789Z.my-test.g1b2c3d4',
    '2026-01-19T12-34-56.789.my-test.a1b2c3d4',
    'not-a-temp-dir',
    '',
  ];

  given('[case1] the names both readers must classify', () => {
    when('[t0] each is put to both readers', () => {
      then('🔴 they NEVER disagree', () => {
        // .why = a disagreement is the exact silent failure: the mint's own assert
        //        passes on a name the age gate then preserves forever, or a
        //        consumer's clamp counts a dir the reclaim will never take
        for (const dirName of NAMES) {
          const admitted = isTempDir({ path: dirName });
          const parsed = asTempDirTimestamp({ dirName }) !== null;
          expect({ dirName, admitted, parsed }).toEqual({
            dirName,
            admitted: parsed,
            parsed,
          });
        }
      });
    });
  });
});
