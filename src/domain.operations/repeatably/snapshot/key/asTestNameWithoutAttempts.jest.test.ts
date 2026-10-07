import { given, then, when } from '@src/contract';

import { asTestNameWithoutAttempts } from './asTestNameWithoutAttempts';

const TEST_CASES = [
  {
    description: 'strips the ordinal of one when.repeatably scope',
    given: {
      name: 'given: a scene when: the ask, attempt 2 then: it passes',
      scopes: [
        { nameAttempt: 'when: the ask, attempt 2', nameBase: 'when: the ask' },
      ],
    },
    expect: { output: 'given: a scene when: the ask then: it passes' },
  },
  {
    description: 'strips the ordinals of nested scopes',
    given: {
      name: 'given: a scene, attempt 1 when: the ask, attempt 3 then: it passes',
      scopes: [
        {
          nameAttempt: 'given: a scene, attempt 1',
          nameBase: 'given: a scene',
        },
        { nameAttempt: 'when: the ask, attempt 3', nameBase: 'when: the ask' },
      ],
    },
    expect: { output: 'given: a scene when: the ask then: it passes' },
  },
  {
    description: 'strips the ordinal of a then.repeatably test name',
    given: {
      name: 'given: a scene when: the ask then: it passes, attempt 2',
      scopes: [
        {
          nameAttempt: 'then: it passes, attempt 2',
          nameBase: 'then: it passes',
        },
      ],
    },
    expect: { output: 'given: a scene when: the ask then: it passes' },
  },
  {
    description: 'keeps a consumer-authored ", attempt N" outside any scope',
    given: {
      name: 'given: a scene when: the login, attempt 2 then: it locks',
      scopes: [],
    },
    expect: {
      output: 'given: a scene when: the login, attempt 2 then: it locks',
    },
  },
];

describe('asTestNameWithoutAttempts', () => {
  TEST_CASES.map((thisCase, index) =>
    given(`[case${index + 1}] ${thisCase.description}`, () => {
      when('[t0] the name is stripped', () => {
        then('it returns the expected name', () => {
          const output = asTestNameWithoutAttempts(thisCase.given);
          expect(output).toEqual(thisCase.expect.output);
        });
      });
    }),
  );
});
