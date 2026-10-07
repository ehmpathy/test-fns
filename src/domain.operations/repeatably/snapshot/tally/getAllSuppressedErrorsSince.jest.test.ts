import { given, then, when } from '@src/contract';

import type { ExpectSnapshotState } from '../getOneExpectSnapshotState';
import { getAllSuppressedErrorsSince } from './getAllSuppressedErrorsSince';

/**
 * .what = a snapshot state with only the field this transformer reads
 * .why = getAllSuppressedErrorsSince touches suppressedErrors alone
 */
const genSnapDemo = (input: {
  suppressedErrors: unknown[] | null;
}): ExpectSnapshotState => ({
  expect: { getState: () => ({}), setState: () => undefined },
  counters: { get: () => undefined, set: () => undefined },
  snapshotData: {},
  suppressedErrors: input.suppressedErrors,
  snapshotState: {},
});

const errorPrior = new Error('prior');
const errorBody = new Error('body');

const TEST_CASES = [
  {
    description: 'jest: returns only the mismatches recorded after the tally',
    given: { suppressedErrors: [errorPrior, errorBody], suppressedQuant: 1 },
    expect: { output: [errorBody] },
  },
  {
    description: 'jest: returns none when the body recorded no mismatch',
    given: { suppressedErrors: [errorPrior], suppressedQuant: 1 },
    expect: { output: [] },
  },
  {
    description: 'jest: returns all when the tally was noted on an empty list',
    given: { suppressedErrors: [errorBody], suppressedQuant: 0 },
    expect: { output: [errorBody] },
  },
  {
    description: 'vitest: returns none when suppressedErrors is null',
    given: { suppressedErrors: null, suppressedQuant: 0 },
    expect: { output: [] },
  },
];

describe('getAllSuppressedErrorsSince', () => {
  TEST_CASES.map((thisCase, index) =>
    given(`[case${index + 1}] ${thisCase.description}`, () => {
      when('[t0] the mismatches since the tally are read', () => {
        then('it returns the expected mismatches', () => {
          const output = getAllSuppressedErrorsSince({
            snap: genSnapDemo({
              suppressedErrors: thisCase.given.suppressedErrors,
            }),
            tally: { suppressedQuant: thisCase.given.suppressedQuant },
          });
          expect(output).toEqual(thisCase.expect.output);
        });
      });
    }),
  );
});
