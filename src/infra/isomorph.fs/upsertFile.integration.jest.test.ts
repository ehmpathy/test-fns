/**
 * .what = clamps that upsertFile converges content and leaves NO sibling entry
 * .why = every upsertFile call in this repo writes into the temp ROOT — the shared
 *        namespace the run reclaim, both age-gate passes, the arrears check, and a
 *        consumer's own clamp all iterate. an entry it leaves there that matches
 *        none of those filters is reclaimed by NO mechanism, ever
 *
 * .note = 🔴 the no-extra-entry clamp is the point. a stage-and-rename form writes
 *         `<path>.<pid>.staged` first, and a process killed between the two calls
 *         leaves that file behind permanently — planted by the very behavior whose
 *         wish is that no entry outlive the run that made it. atomicity is not
 *         required here (no code reads the doc), so it would buy a cosmetic
 *         property and pay in immortal residue
 */
import { genTempDir, given, then, useThen, when } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { upsertFile } from './upsertFile';

describe('upsertFile', () => {
  given('[case1] a fresh directory', () => {
    when(
      '[t0] a file is upserted, then upserted again with new content',
      () => {
        const scene = useThen('both writes land', () => {
          const dir = genTempDir({ slug: 'upsert-file-test' });
          const pathFile = path.join(dir, 'readme.md');

          upsertFile({ path: pathFile, content: 'first' });
          const contentFirst = fs.readFileSync(pathFile, 'utf8');
          const namesAfterFirst = fs.readdirSync(dir);

          upsertFile({ path: pathFile, content: 'second' });
          const contentSecond = fs.readFileSync(pathFile, 'utf8');
          const namesAfterSecond = fs.readdirSync(dir);

          return {
            dir,
            contentFirst,
            contentSecond,
            namesAfterFirst,
            namesAfterSecond,
          };
        });

        then('it writes the content', () => {
          expect(scene.contentFirst).toEqual('first');
        });

        then('it OVERWRITES on drift rather than throws', () => {
          // .why = findsertFile throws on drift, which is right for a contract and
          //        catastrophic for a doc: a readme edit would break the next
          //        genTempDir call of every consumer whose root predates the upgrade
          expect(scene.contentSecond).toEqual('second');
        });

        then('🔴 it leaves EXACTLY one entry — no staged sibling', () => {
          // .why = a `.staged` sibling matches no reclaim filter: the dir passes
          //        skip it (it is a file), the marker pass skips it (wrong prefix).
          //        so a process killed mid-write would leave it forever
          expect(scene.namesAfterFirst).toEqual(['readme.md']);
          expect(scene.namesAfterSecond).toEqual(['readme.md']);
        });
      },
    );
  });

  given('[case2] a file that already holds exactly the target content', () => {
    when('[t0] it is upserted again', () => {
      const scene = useThen('the upsert is made', () => {
        const dir = genTempDir({ slug: 'upsert-file-converged' });
        const pathFile = path.join(dir, 'readme.md');

        upsertFile({ path: pathFile, content: 'same' });
        const mtimeBefore = fs.statSync(pathFile).mtimeMs;

        upsertFile({ path: pathFile, content: 'same' });
        const mtimeAfter = fs.statSync(pathFile).mtimeMs;

        return { mtimeBefore, mtimeAfter };
      });

      then('it performs NO write at all', () => {
        // .why = this runs on EVERY genTempDir call, in every worker. once the
        //        content matches there is no write, so concurrent writers become
        //        almost unreachable rather than merely made safe — which is what
        //        lets the staged-write go, and with it the immortal residue class
        expect(scene.mtimeAfter).toEqual(scene.mtimeBefore);
      });
    });
  });
});
