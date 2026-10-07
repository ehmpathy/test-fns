import { MalfunctionError } from 'helpful-errors';

import type { TestRunner } from '@src/infra/isomorph.test/detectTestRunner';
import { getOneRunnerVersion } from '@src/infra/isomorph.test/getOneRunnerVersion';

/**
 * .what = the largest delay a node timer accepts, in ms
 * .why = a repeatable attempt registers its test and its setup hook with this budget,
 *        so the runner's own timer never fires. the wrapper owns the real deadline,
 *        and turns an overrun into a failure it can withhold
 */
export const TIMEOUT_MAX_MS = 2_147_483_647;

/**
 * .what = reads the per-test time budget the runner would apply
 * .why = the wrapper races each attempt against the budget the consumer set — via
 *        `jest.setTimeout`, `testTimeout` in config, or the runner default — so an
 *        overrun fails at the same moment it would have before, only catchably
 *
 * .note = both runners hold the budget on internal state, with no public read:
 *         - jest: `globalThis[Symbol('JEST_STATE_SYMBOL')].testTimeout`. the symbol
 *           is unregistered, so it is found by its description
 *           (jest-circus `_callCircusTest`: `test.timeout || getState().testTimeout`)
 *         - vitest: `globalThis.__vitest_worker__.config.testTimeout`
 *         an absent field is a runner change this code must learn of, so it fails
 *         loud rather than guess a budget (invariant I4)
 */
export const getOneTestBudget = (input: { runner: TestRunner }): number => {
  // read the budget from the runner's own state
  const budget =
    input.runner === 'jest' ? getOneJestBudget() : getOneVitestBudget();

  // fail loud where the runner no longer exposes it
  if (typeof budget !== 'number' || !(budget > 0))
    throw new MalfunctionError(
      'repeatably: could not read the test timeout budget from the runner',
      {
        runner: getOneRunnerVersion({ runner: input.runner }),
        field:
          input.runner === 'jest'
            ? 'globalThis[Symbol(JEST_STATE_SYMBOL)].testTimeout'
            : 'globalThis.__vitest_worker__.config.testTimeout',
        found: budget,
        hint: 'test-fns reads this runner internal to own the deadline of a repeatable attempt; please report the runner version at https://github.com/ehmpathy/test-fns/issues',
      },
    );
  return budget;
};

/**
 * .what = reads jest's resolved test timeout
 * .why = jest-circus applies `getState().testTimeout` to every test with no own timeout
 */
const getOneJestBudget = (): unknown => {
  const symbolState = Object.getOwnPropertySymbols(globalThis).find(
    (symbol) => symbol.description === 'JEST_STATE_SYMBOL',
  );
  if (!symbolState) return undefined;
  const state: unknown = Reflect.get(globalThis, symbolState);
  if (typeof state !== 'object' || state === null) return undefined;
  return Reflect.get(state, 'testTimeout');
};

/**
 * .what = reads vitest's resolved test timeout
 * .why = vitest applies `config.testTimeout` to every test with no own timeout
 */
const getOneVitestBudget = (): unknown => {
  const worker: unknown = Reflect.get(globalThis, '__vitest_worker__');
  if (typeof worker !== 'object' || worker === null) return undefined;
  const config: unknown = Reflect.get(worker, 'config');
  if (typeof config !== 'object' || config === null) return undefined;
  return Reflect.get(config, 'testTimeout');
};
