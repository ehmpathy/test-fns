import { ConstraintError } from 'helpful-errors';

import { given, then, useThen, when } from '@src/contract';

import { getOneAttemptOutcome } from './getOneAttemptOutcome';

describe('getOneAttemptOutcome', () => {
  given('[case1] a body that settles within the budget', () => {
    when('[t0] the outcome is read', () => {
      const outcome = useThen('it settles', () =>
        getOneAttemptOutcome({ body: async () => 'ok', budgetMs: 1000 }),
      );

      then('it reports no error', () => {
        expect(outcome.error).toEqual(null);
      });
    });
  });

  given('[case2] a body that throws synchronously', () => {
    when('[t0] the outcome is read', () => {
      const outcome = useThen('it settles', () =>
        getOneAttemptOutcome({
          body: () => {
            throw new Error('boom');
          },
          budgetMs: 1000,
        }),
      );

      then('it returns the throw as the error, never rejects', () => {
        expect(outcome.error).toBeInstanceOf(Error);
        expect(String(outcome.error)).toContain('boom');
      });
    });
  });

  given('[case3] a body that overruns the budget', () => {
    when('[t0] the outcome is read', () => {
      const outcome = useThen('it settles at the budget', () =>
        getOneAttemptOutcome({
          body: () => new Promise((settle) => setTimeout(settle, 500)),
          budgetMs: 20,
        }),
      );

      then(
        'it returns an overrun error that names the budget and the fix',
        () => {
          expect(outcome.error).toBeInstanceOf(ConstraintError);
          expect(String(outcome.error)).toContain('exceeded the 20ms budget');
          expect(String(outcome.error)).toContain('testTimeout');
        },
      );

      then('the overrun message matches its snapshot', () => {
        // .note = the message alone, as the withheld log line shows it
        const message =
          outcome.error instanceof Error ? outcome.error.message : null;
        expect(message).toMatchSnapshot();
      });
    });
  });

  given('[case4] no budget', () => {
    when('[t0] the body rejects', () => {
      const outcome = useThen('it settles', () =>
        getOneAttemptOutcome({
          body: async () => {
            throw new Error('late');
          },
          budgetMs: null,
        }),
      );

      then('it returns the rejection as the error', () => {
        expect(outcome.error).toBeInstanceOf(Error);
        expect(String(outcome.error)).toContain('late');
      });
    });
  });
});
