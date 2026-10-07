import { given, then, when } from '@src/contract';

import type { ExpectSnapshotState } from '../getOneExpectSnapshotState';
import { getOneSnapshotTally } from './getOneSnapshotTally';

/**
 * .what = a snapshot state with only the fields a tally reads
 * .why = getOneSnapshotTally touches suppressedErrors and snapshotState.unmatched alone
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

const unmatchedMap = new Map<string, number>([['task-a', 1]]);

const TEST_CASES = [
  {
    description: 'jest: counts the suppressed mismatches and reads the count',
    given: { suppressedErrors: [new Error('a'), new Error('b')], unmatched: 3 },
    expect: { output: { suppressedQuant: 2, unmatched: 3 } },
  },
  {
    description: 'jest: an empty suppressed list tallies as zero',
    given: { suppressedErrors: [], unmatched: 0 },
    expect: { output: { suppressedQuant: 0, unmatched: 0 } },
  },
  {
    description: 'vitest: a null suppressed list tallies as zero',
    given: { suppressedErrors: null, unmatched: unmatchedMap },
    expect: { output: { suppressedQuant: 0, unmatched: unmatchedMap } },
  },
];

describe('getOneSnapshotTally', () => {
  TEST_CASES.map((thisCase, index) =>
    given(`[case${index + 1}] ${thisCase.description}`, () => {
      when('[t0] the tally is noted', () => {
        then('it returns the expected tally', () => {
          const output = getOneSnapshotTally({
            snap: genSnapDemo(thisCase.given),
          });
          expect(output).toEqual(thisCase.expect.output);
        });
      });
    }),
  );

  given(
    `[case${TEST_CASES.length + 1}] vitest: a per-task unmatched map`,
    () => {
      when('[t0] the tally is noted', () => {
        then('the map is held by reference, not copied', () => {
          const output = getOneSnapshotTally({
            snap: genSnapDemo({
              suppressedErrors: null,
              unmatched: unmatchedMap,
            }),
          });
          expect(output.unmatched).toBe(unmatchedMap);
        });
      });
    },
  );
});
