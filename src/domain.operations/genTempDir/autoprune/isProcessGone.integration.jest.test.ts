/**
 * .what = clamps the liveness question the whole arrears check turns on
 * .why = 🔴 this operation had NO test at all, and it is the SECOND TERM of the
 *        arrears predicate — the one that separates "a run died and left residue"
 *        from "a peer is minutes into a long suite". the vision raised it from an
 *        assumption to a requirement precisely because no age window can make that
 *        separation, and then no clamp held the mechanism that replaced the window
 *
 * .note = an INTEGRATION test, never a unit one. `process.kill` is a syscall — a
 *         boundary outside this process's memory — so a unit test could only reach
 *         it through a mock, and a mock of a syscall proves only the mock
 *         (`rule.forbid.unit.remote-boundaries`, `rule.require.test-coverage-by-grain`)
 *
 * .note = every assertion below reads a THREE-valued answer: true (gone), false
 *         (alive), null (unanswerable). null is not a shrug — it is the value that
 *         routes the caller to the age window, so a test that only checked
 *         truthiness would let a null pass for a "gone" and slander a live peer
 */
import { given, then, when } from '@src/contract';

import * as childProcess from 'node:child_process';
import { isProcessGone } from './isProcessGone';

describe('isProcessGone', () => {
  given('[case1] a process that is certainly alive — this one', () => {
    when('[t0] the liveness question is asked', () => {
      then(
        '🔴 it answers false, so no live run is ever named as arrears',
        () => {
          // .why = a false positive here is the one failure mode this design keeps
          //        off the table: a live peer reported as a casualty, on every run
          expect(isProcessGone({ pid: process.pid })).toEqual(false);
        },
      );
    });
  });

  given('[case2] a process we may exist beside but may not signal', () => {
    when('[t0] the liveness question is asked of pid 1', () => {
      then('it answers false — unsignalable is ALIVE, never gone', () => {
        // .why = pid 1 exists on every unix. as a non-root user the kill raises
        //        EPERM; as root it succeeds outright. BOTH paths must answer
        //        false, so this assertion holds either way and needs no branch on
        //        who we are — the EPERM arm and the success arm agree by design
        expect(isProcessGone({ pid: 1 })).toEqual(false);
      });
    });
  });

  given('[case3] a process that really has exited', () => {
    when('[t0] a child is run to completion, then asked after', () => {
      then('🔴 it answers true, so a real casualty IS named', () => {
        // a real child, run to exit — never an invented pid. a number picked out
        // of the air might belong to a live process, so the clamp would pass by
        // luck on a quiet machine and fail on a busy one
        const child = childProcess.spawnSync(process.execPath, ['-e', '0']);
        expect(child.status).toEqual(0);
        expect(typeof child.pid).toEqual('number');

        expect(isProcessGone({ pid: child.pid ?? -1 })).toEqual(true);
      });
    });
  });

  given('[case4] a pid that is no pid at all', () => {
    when('[t0] the liveness question cannot be asked', () => {
      then('🔴 pid 0 answers null, never true', () => {
        // .why = 🔴 pid 0 is an easy read as "dead", and it is not: on posix, a
        //        signal to 0 addresses the whole process GROUP, so a kill would
        //        reach every process in it. this operation refuses the question
        //        rather than answer it, and that refusal is the guard
        expect(isProcessGone({ pid: 0 })).toEqual(null);
      });

      then(
        'a negative pid answers null — it addresses a group, not a process',
        () => {
          expect(isProcessGone({ pid: -1 })).toEqual(null);
        },
      );

      then(
        'a fractional pid answers null rather than round toward a stranger',
        () => {
          expect(isProcessGone({ pid: 1.5 })).toEqual(null);
        },
      );

      then('NaN answers null', () => {
        expect(isProcessGone({ pid: Number.NaN })).toEqual(null);
      });
    });
  });

  given('[case5] the three answers are distinct, never a boolean cast', () => {
    when('[t0] all three are read side by side', () => {
      then('🔴 null is distinguishable from false by a strict read', () => {
        // .why = the caller branches `=== true` then `=== false` then falls back to
        //        the age window. were null to read as false, an unanswerable
        //        question would silently mean "alive" and the age fallback — the
        //        whole reason null exists — would never fire
        const unanswerable = isProcessGone({ pid: 0 });
        const alive = isProcessGone({ pid: process.pid });

        expect(unanswerable).toEqual(null);
        expect(alive).toEqual(false);
        expect(unanswerable === alive).toEqual(false);
      });
    });
  });
});
