import { given, then, when } from '@src/contract';

import { genRepeatableState } from '../genRepeatableState';
import { setAttemptStarted } from './setAttemptStarted';

describe('setAttemptStarted', () => {
  given('[case1] a block whose prior attempt failed', () => {
    when('[t0] attempt 2 starts', () => {
      const ctx = {
        ...genRepeatableState({ attempts: 3 }),
        thisAttemptFailed: true,
        thisAttemptIndex: 1,
      };
      setAttemptStarted({ ctx, attempt: 2 });

      then('the failure flag is cleared', () => {
        expect(ctx.thisAttemptFailed).toEqual(false);
      });

      then('the attempt is named', () => {
        expect(ctx.thisAttemptIndex).toEqual(2);
      });
    });
  });
});
