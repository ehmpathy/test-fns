import type { TestRunner } from '@src/infra/isomorph.test/detectTestRunner';

import type {
  RepeatableScope,
  RepeatableState,
} from '../registryDescribeRepeatable';
import { getOneAttemptOutcome } from './attempt/budget/getOneAttemptOutcome';
import { getOneTestBudget } from './attempt/budget/getOneTestBudget';
import { setAttemptFailed } from './attempt/setAttemptFailed';
import { reportAttemptWithheld } from './attempt/withheld/reportAttemptWithheld';
import { getOneExpectSnapshotState } from './snapshot/getOneExpectSnapshotState';
import { isSnapshotKeyRenamed } from './snapshot/key/isSnapshotKeyRenamed';
import { setSnapshotCounterRebased } from './snapshot/key/setSnapshotCounterRebased';
import { setSnapshotErrorsHinted } from './snapshot/key/setSnapshotErrorsHinted';
import {
  setSnapshotKeyStripped,
  type VitestTaskNamed,
} from './snapshot/key/setSnapshotKeyStripped';
import { getAllSuppressedErrorsSince } from './snapshot/tally/getAllSuppressedErrorsSince';
import { getOneSnapshotTally } from './snapshot/tally/getOneSnapshotTally';
import { setSnapshotTallyRestored } from './snapshot/tally/setSnapshotTallyRestored';

/**
 * .what = the slice of vitest's test context this body reads
 * .why = vitest hands each test its task (the key lever) and a skip marker
 */
export interface VitestTestContext {
  task?: VitestTaskNamed & { id?: string };
  skip?: () => void;
}

/**
 * .what = builds the body of one test inside a repeatable block
 * .why = an attempt must check one snapshot baseline, and under `criteria: 'SOME'` a
 *        non-final attempt must not fail the file, whatever failed in it — a throw, a
 *        suppressed snapshot mismatch, or an overrun of the time budget
 *
 * .note = per attempt:
 *         1. skip, where a prior SOME attempt already passed
 *         2. strip the attempt ordinal from the snapshot key, and rebase its count
 *         3. run the body; under SOME, against the runner's own time budget
 *         4. name a renamed key, where the baseline predates the strip
 *         5. under SOME on a non-final attempt, withhold the failure and log it
 *         6. otherwise, surface the failure as the runner would
 */
export const genRepeatableTestBody =
  (input: {
    /**
     * .note = called with no args: a repeatable body takes no done callback
     */
    testFn: (...args: never[]) => unknown;
    ctx: RepeatableState | null;
    scopes: RepeatableScope[];
    runner: TestRunner;
  }) =>
  async (testContext: VitestTestContext | null): Promise<void> => {
    const { ctx, runner } = input;

    // skip, where a prior SOME attempt already passed
    if (ctx?.anyAttemptPassed) {
      // eslint-disable-next-line no-console -- explicit skip message in test output
      console.log('      🫧  [skipped] prior repeatably attempt passed');
      testContext?.skip?.();
      return;
    }

    // read the runner state first: each read fails loud, and a throw here must
    // land before any mutation, so no neighbor test inherits a renamed task
    const snap = getOneExpectSnapshotState({ runner });
    const budgetMs = ctx ? getOneTestBudget({ runner }) : null;

    // point the snapshot key at the ordinal-free name, from the attempt-1 count
    const keyStripped = setSnapshotKeyStripped({
      runner,
      snap,
      scopes: input.scopes,
      task: testContext?.task ?? null,
    });
    setSnapshotCounterRebased({
      snap,
      nameStripped: keyStripped.nameStripped,
      attemptKey: input.scopes.map((scope) => scope.nameAttempt).join(' | '),
    });

    // note the snapshot tallies before the body, so a withhold can restore them
    const tallyBefore = getOneSnapshotTally({ snap });

    // run the body; under SOME the wrapper owns the deadline
    const outcome = await getOneAttemptOutcome({
      body: () => input.testFn(),
      budgetMs,
    });
    keyStripped.restore();
    const suppressedNew = getAllSuppressedErrorsSince({
      snap,
      tally: tallyBefore,
    });

    // name a renamed key, where the baseline predates the strip
    const keyRenamed = isSnapshotKeyRenamed({
      snapshotData: snap.snapshotData,
      nameStripped: keyStripped.nameStripped,
      scopes: input.scopes,
    });
    if (keyRenamed)
      setSnapshotErrorsHinted({ failures: [...suppressedNew, outcome.error] });

    // outside SOME, surface as the runner would; suppressed errors stay in place
    if (!ctx) {
      if (outcome.error !== null) throw outcome.error;
      return;
    }

    // a clean attempt is done
    const failure = outcome.error ?? suppressedNew[0] ?? null;
    if (failure === null) return;

    // mark the attempt failed, and judge whether it is final
    const verdict = setAttemptFailed({ ctx, error: outcome.error });

    // the final attempt surfaces the failure: a throw rethrows the first error of any
    // attempt (extant contract); a snapshot mismatch stays in jest's own report
    if (verdict.isFinal) {
      if (outcome.error !== null) throw verdict.errorFirst ?? outcome.error;
      return;
    }

    // withhold a non-final failure: roll the snapshot tallies back, and log it
    setSnapshotTallyRestored({
      snap,
      tally: tallyBefore,
      taskId: testContext?.task?.id ?? null,
    });
    reportAttemptWithheld({ attemptIndex: ctx.thisAttemptIndex, failure });
  };
