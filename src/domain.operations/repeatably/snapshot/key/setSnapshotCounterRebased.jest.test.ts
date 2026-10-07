import { given, then, when } from '@src/contract';

import type { ExpectSnapshotState } from '../getOneExpectSnapshotState';
import { setSnapshotCounterRebased } from './setSnapshotCounterRebased';

/**
 * .what = a fake snapshot state, with a real map for the per-name counters
 * .why = the rebase reads and writes only the counters and keys on the state object
 */
const genSnapFake = (): {
  snap: ExpectSnapshotState;
  counters: Map<string, number>;
} => {
  const counters = new Map<string, number>();
  const snap: ExpectSnapshotState = {
    expect: { getState: () => ({}), setState: () => undefined },
    counters: {
      get: (name) => counters.get(name),
      set: (name, count) => counters.set(name, count),
    },
    snapshotData: {},
    suppressedErrors: [],
    snapshotState: {},
  };
  return { snap, counters };
};

describe('setSnapshotCounterRebased', () => {
  given('[case1] one test name across two attempts', () => {
    when('[t0] attempt 2 begins after attempt 1 counted one snapshot', () => {
      then('the count rebases to where attempt 1 began', () => {
        const { snap, counters } = genSnapFake();
        setSnapshotCounterRebased({
          snap,
          nameStripped: 'then: it matches',
          attemptKey: 'attempt 1',
        });
        counters.set('then: it matches', 1); // the runner counts attempt 1's snapshot

        setSnapshotCounterRebased({
          snap,
          nameStripped: 'then: it matches',
          attemptKey: 'attempt 2',
        });
        expect(counters.get('then: it matches')).toEqual(0);
      });
    });
  });

  given('[case2] two tests of one name inside one attempt', () => {
    when('[t0] the second test begins', () => {
      then('the count runs on, as outside a repeatable block', () => {
        const { snap, counters } = genSnapFake();
        setSnapshotCounterRebased({
          snap,
          nameStripped: 'then: it matches',
          attemptKey: 'attempt 1',
        });
        counters.set('then: it matches', 1);

        setSnapshotCounterRebased({
          snap,
          nameStripped: 'then: it matches',
          attemptKey: 'attempt 1',
        });
        expect(counters.get('then: it matches')).toEqual(1);
      });
    });
  });

  given('[case3] one test name in two files that share this module', () => {
    when('[t0] the second file reaches the name with its own count', () => {
      then('it records its own start, never the first file', () => {
        const fileA = genSnapFake();
        const fileB = genSnapFake();

        // file A: attempt 1 starts at 0
        setSnapshotCounterRebased({
          snap: fileA.snap,
          nameStripped: 'then: it matches',
          attemptKey: 'attempt 1',
        });

        // file B: attempt 1 starts at 3, then attempt 2 begins
        fileB.counters.set('then: it matches', 3);
        setSnapshotCounterRebased({
          snap: fileB.snap,
          nameStripped: 'then: it matches',
          attemptKey: 'attempt 1',
        });
        fileB.counters.set('then: it matches', 4);
        setSnapshotCounterRebased({
          snap: fileB.snap,
          nameStripped: 'then: it matches',
          attemptKey: 'attempt 2',
        });
        expect(fileB.counters.get('then: it matches')).toEqual(3);
      });
    });
  });
});
