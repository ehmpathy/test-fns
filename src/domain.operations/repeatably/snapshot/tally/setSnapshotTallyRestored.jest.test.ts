import { given, then, when } from '@src/contract';

import type { ExpectSnapshotState } from '../getOneExpectSnapshotState';
import { getAllSuppressedErrorsSince } from './getAllSuppressedErrorsSince';
import { getOneSnapshotTally } from './getOneSnapshotTally';
import { setSnapshotTallyRestored } from './setSnapshotTallyRestored';

/**
 * .what = a snapshot state with only the fields a tally reads
 * .why = the tally ops touch suppressedErrors and snapshotState.unmatched alone
 */
const genSnapDemo = (input: {
  suppressedErrors: unknown[] | null;
  unmatched: unknown;
}): ExpectSnapshotState => ({
  expect: { getState: () => ({}), setState: () => undefined },
  counters: { get: () => undefined, set: () => undefined },
  snapshotData: {},
  suppressedErrors: input.suppressedErrors,
  snapshotState: { unmatched: input.unmatched },
});

describe('setSnapshotTallyRestored', () => {
  given('[case1] jest: a body that recorded a mismatch', () => {
    const errorPrior = new Error('prior');
    const snap = genSnapDemo({ suppressedErrors: [errorPrior], unmatched: 1 });
    const tally = getOneSnapshotTally({ snap });

    // the body records one mismatch and one unmatched key
    const errorBody = new Error('body');
    snap.suppressedErrors?.push(errorBody);
    Reflect.set(snap.snapshotState, 'unmatched', 2);

    when('[t0] the new mismatches are read', () => {
      then('only the body mismatch is returned', () => {
        expect(getAllSuppressedErrorsSince({ snap, tally })).toEqual([
          errorBody,
        ]);
      });
    });

    when('[t1] the tally is restored', () => {
      then('the prior mismatch stays and the count returns', () => {
        setSnapshotTallyRestored({ snap, tally, taskId: null });
        expect(snap.suppressedErrors).toEqual([errorPrior]);
        expect(Reflect.get(snap.snapshotState, 'unmatched')).toEqual(1);
      });
    });
  });

  given('[case2] vitest: a per-task unmatched map', () => {
    const unmatched = new Map<string, number>([
      ['task-a', 1],
      ['task-b', 1],
    ]);
    const snap = genSnapDemo({ suppressedErrors: null, unmatched });
    const tally = getOneSnapshotTally({ snap });

    when('[t0] the tally is restored for task-b', () => {
      then('only task-b drops from the map', () => {
        setSnapshotTallyRestored({ snap, tally, taskId: 'task-b' });
        expect([...unmatched.keys()]).toEqual(['task-a']);
      });
    });
  });
});
