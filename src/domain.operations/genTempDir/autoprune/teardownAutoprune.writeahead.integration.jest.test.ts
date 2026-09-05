import { given, then, when } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * .what = clamps that the teardown marks `partial` BEFORE it starts the reclaim
 * .why = 🔴 `RunMarker.state` declares "each state is written AHEAD of the work it
 *        describes. a pre-empted process gets no second write, so a state written
 *        after the fact would never land." the teardown broke that rule: it wrote
 *        `partial` only AFTER `pruneRun` returned. so a process killed mid-rmSync
 *        left `open`, and the next run told its human "its teardown never ran" —
 *        who then audits a config that was never at fault, while the cause sits in
 *        a file mode
 *
 * .note = 🔴 this is a SOURCE-ORDER assertion, and that is a deliberate second
 *         choice rather than a preference. the behavior it pins is "what is on disk
 *         when the process dies at an arbitrary instant", and to stage that in-process
 *         needs either a mock of `pruneRun` (forbidden here — `rule.forbid.integration.mocks`)
 *         or a child process killed on a timer, which trades this determinism for a
 *         race. the honest bound: this clamp catches the ORDER regression, and it
 *         cannot catch a rewrite that keeps the order and breaks the write some
 *         other way. the child-process SIGKILL clamp the vision asks for remains owed
 *
 * .note = the companion BEHAVIOR clamp is `reportRunArrears.integration.jest.test.ts`
 *         `[case5]`, which drives the state this order makes reachable — a `partial`
 *         marker with an EMPTY residue — and proves the report tells it apart from
 *         both `open` and a `partial` that carries residue
 */

/** the module under clamp, read as text — the order is a property of the source */
const CONTENT_TEARDOWN: string = fs.readFileSync(
  path.join(__dirname, 'teardownAutoprune.ts'),
  'utf8',
);

describe('teardownAutoprune write-ahead', () => {
  given('[case1] the teardown source', () => {
    when('[t0] the order of its marker write and its reclaim is read', () => {
      then('🔴 it marks `partial` BEFORE it awaits the reclaim', () => {
        const atPartial = CONTENT_TEARDOWN.indexOf("state: 'partial'");
        const atPrune = CONTENT_TEARDOWN.indexOf('await pruneRun(');

        // guard the guard: both anchors must EXIST, else a rename would make this
        // pass vacuously on two -1s that compare equal-ish
        expect(atPartial).toBeGreaterThan(-1);
        expect(atPrune).toBeGreaterThan(-1);

        expect(atPartial).toBeLessThan(atPrune);
      });

      then('the reclaim is AWAITED, never fire-and-forget', () => {
        // .why = `--forceExit` calls exit(code) the instant the teardown promise
        //        resolves, so an unawaited reclaim is killed mid-rmSync on every run
        expect(CONTENT_TEARDOWN).toContain('await pruneRun(');
      });
    });
  });
});
