import { given, then, when } from '@src/contract';

import { isSnapshotKeyRenamed } from './isSnapshotKeyRenamed';

const NAME_STRIPPED = 'given: a scene when: the ask then: it matches';
const SCOPES = [
  { nameAttempt: 'when: the ask, attempt 2', nameBase: 'when: the ask' },
];

const TEST_CASES = [
  {
    description: 'false when a key under the stripped name is present',
    given: {
      snapshotData: { [`${NAME_STRIPPED} 1`]: '"good"' },
      nameStripped: NAME_STRIPPED,
      scopes: SCOPES,
    },
    expect: { output: false },
  },
  {
    description: 'true when only the attempt-ful twin is present',
    given: {
      snapshotData: {
        'given: a scene when: the ask, attempt 1 then: it matches 1': '"good"',
      },
      nameStripped: NAME_STRIPPED,
      scopes: SCOPES,
    },
    expect: { output: true },
  },
  {
    description: 'false when the snapshot is simply new',
    given: { snapshotData: {}, nameStripped: NAME_STRIPPED, scopes: SCOPES },
    expect: { output: false },
  },
  {
    description: 'false when only an unrelated key is present',
    given: {
      snapshotData: { 'given: another scene then: it matches 1': '"good"' },
      nameStripped: NAME_STRIPPED,
      scopes: SCOPES,
    },
    expect: { output: false },
  },
  {
    description:
      "true when a consumer's own title reads ', attempt 3' outside the scope",
    given: {
      snapshotData: {
        'given: gives up, attempt 3 is the cap when: the ask, attempt 1 then: it matches 1':
          '"good"',
      },
      nameStripped:
        'given: gives up, attempt 3 is the cap when: the ask then: it matches',
      scopes: SCOPES,
    },
    expect: { output: true },
  },
];

describe('isSnapshotKeyRenamed', () => {
  TEST_CASES.map((thisCase, index) =>
    given(`[case${index + 1}] ${thisCase.description}`, () => {
      when('[t0] the rename is checked', () => {
        then('it returns the expected verdict', () => {
          const output = isSnapshotKeyRenamed(thisCase.given);
          expect(output).toEqual(thisCase.expect.output);
        });
      });
    }),
  );
});
