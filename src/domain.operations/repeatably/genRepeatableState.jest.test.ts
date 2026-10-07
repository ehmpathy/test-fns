import { given, then, when } from '@src/contract';

import { genRepeatableState } from './genRepeatableState';

describe('genRepeatableState', () => {
  given('[case1] a SOME block of three attempts', () => {
    when('[t0] its state is constructed', () => {
      then(
        'it starts before any attempt, with no pass, failure, or error',
        () => {
          expect(genRepeatableState({ attempts: 3 })).toEqual({
            criteria: 'SOME',
            anyAttemptPassed: false,
            thisAttemptFailed: false,
            thisAttemptIndex: 0,
            allAttemptsQuant: 3,
            anyError: null,
          });
        },
      );

      then('each call yields its own record', () => {
        const stateA = genRepeatableState({ attempts: 3 });
        const stateB = genRepeatableState({ attempts: 3 });
        expect(stateA).not.toBe(stateB);
      });
    });
  });
});
