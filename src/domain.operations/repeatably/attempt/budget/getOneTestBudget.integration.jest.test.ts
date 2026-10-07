import { getError, MalfunctionError } from 'helpful-errors';

import { given, then, when } from '@src/contract';

import { getOneTestBudget } from './getOneTestBudget';

describe('getOneTestBudget', () => {
  given('[case1] the jest runner, which holds the budget', () => {
    when('[t0] the budget is read', () => {
      then('it returns the positive budget jest applies', () => {
        const budget = getOneTestBudget({ runner: 'jest' });
        expect(budget).toBeGreaterThan(0);
      });
    });
  });

  given('[case2] a runner whose internal state is absent', () => {
    when('[t0] the vitest budget is read under jest', () => {
      then(
        'it fails loud with the runner version and the absent field',
        async () => {
          const error = await getError(() =>
            getOneTestBudget({ runner: 'vitest' }),
          );
          expect(error).toBeInstanceOf(MalfunctionError);
          expect(error.message).toContain(
            'could not read the test timeout budget',
          );
          expect(error.message).toContain('__vitest_worker__');

          // the full message shape, with the installed runner version masked
          expect(
            error.message.replace(/(jest|vitest)@[\w.-]+/g, '$1@<version>'),
          ).toMatchSnapshot();
        },
      );
    });
  });

  given('[case3] the jest runner, whose budget field is absent', () => {
    when('[t0] the jest budget is read with testTimeout removed', () => {
      then(
        'it fails loud with the runner version and the jest field',
        async () => {
          // remove the live field for one read, then restore it
          const symbolState = Object.getOwnPropertySymbols(globalThis).find(
            (symbol) => symbol.description === 'JEST_STATE_SYMBOL',
          );
          const state: unknown = symbolState
            ? Reflect.get(globalThis, symbolState)
            : null;
          if (typeof state !== 'object' || state === null)
            throw new MalfunctionError('jest state absent under jest', {
              hint: 'this case must run under jest-circus',
            });
          const budgetBefore: unknown = Reflect.get(state, 'testTimeout');
          Reflect.set(state, 'testTimeout', undefined);
          const error = await (async () => {
            try {
              return await getError(() => getOneTestBudget({ runner: 'jest' }));
            } finally {
              Reflect.set(state, 'testTimeout', budgetBefore);
            }
          })();

          expect(error).toBeInstanceOf(MalfunctionError);
          expect(error.message).toContain(
            'globalThis[Symbol(JEST_STATE_SYMBOL)].testTimeout',
          );
          expect(
            error.message.replace(/(jest|vitest)@[\w.-]+/g, '$1@<version>'),
          ).toMatchSnapshot();
        },
      );
    });
  });
});
