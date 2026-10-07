/**
 * .what = clamps the live vitest read of the expect + snapshot state
 * .why = `getOneExpectSnapshotState` reads vitest internals (`snapshotState._counters`,
 *        `_snapshotData`) with no public read. the jest twin of this file runs under
 *        jest, so only a run under real vitest can catch a vitest upgrade that moves them
 */
import { describe, expect } from 'vitest';

import { bdd } from '@src/domain.operations/givenWhenThen';

import { getOneExpectSnapshotState } from './getOneExpectSnapshotState';

// .note = destructured from `bdd`, since vitest cannot import a `then` export by name
//         (see limitation.esm-thenable-then-export)
const { given, when, then }: typeof bdd = bdd;

describe('getOneExpectSnapshotState (vitest)', () => {
  given('[case1] the vitest runner, with every internal in place', () => {
    when('[t0] the state is read inside a test', () => {
      then('it returns the typed slice, with no jest-only tally', () => {
        const snap = getOneExpectSnapshotState({ runner: 'vitest' });
        expect(typeof snap.expect.getState).toEqual('function');
        expect(typeof snap.expect.setState).toEqual('function');
        expect(typeof snap.snapshotData).toEqual('object');
        expect(snap.suppressedErrors).toEqual(null);
      });

      then('the counters read and write the live snapshot state', () => {
        const snap = getOneExpectSnapshotState({ runner: 'vitest' });
        const key = 'getOneExpectSnapshotState probe';
        const countBefore = snap.counters.get(key);
        snap.counters.set(key, 7);
        try {
          expect(snap.counters.get(key)).toEqual(7);
        } finally {
          snap.counters.set(key, countBefore ?? 0);
        }
      });
    });
  });
});
