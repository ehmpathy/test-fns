/**
 * .what = clamps the live vitest read of the test timeout budget
 * .why = `getOneTestBudget` reads `__vitest_worker__.config.testTimeout`, a vitest
 *        internal with no public read. the jest twin of this file runs under jest, so
 *        only a run under real vitest can catch a vitest upgrade that moves the field
 */
import { describe, expect, vi } from 'vitest';

import { bdd } from '@src/domain.operations/givenWhenThen';

import { getOneTestBudget } from './getOneTestBudget';

// .note = destructured from `bdd`, since vitest cannot import a `then` export by name
//         (see limitation.esm-thenable-then-export)
const { given, when, then }: typeof bdd = bdd;

describe('getOneTestBudget (vitest)', () => {
  given('[case1] the vitest runner, which holds the budget', () => {
    when('[t0] the budget is read', () => {
      then('it returns the positive budget vitest applies', () => {
        const budget = getOneTestBudget({ runner: 'vitest' });
        expect(budget).toBeGreaterThan(0);
      });
    });

    when('[t1] the consumer sets a budget via vi.setConfig', () => {
      then('the read returns that budget, live', () => {
        vi.setConfig({ testTimeout: 7_777 });
        try {
          expect(getOneTestBudget({ runner: 'vitest' })).toEqual(7_777);
        } finally {
          vi.resetConfig();
        }
      });
    });
  });
});
