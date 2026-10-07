import { UnexpectedCodePathError } from 'helpful-errors';

import { getTestRunner } from '@src/infra/isomorph.test/detectTestRunner';
import { globals } from '@src/infra/isomorph.test/getTestGlobals';

import {
  findRepeatableContext,
  getCurrentRepeatableContext,
  getDescribePath,
} from './registryDescribeRepeatable';
import { getOneAttemptOutcome } from './repeatably/attempt/budget/getOneAttemptOutcome';
import {
  getOneTestBudget,
  TIMEOUT_MAX_MS,
} from './repeatably/attempt/budget/getOneTestBudget';
import { setAttemptFailed } from './repeatably/attempt/setAttemptFailed';
import { reportAttemptWithheld } from './repeatably/attempt/withheld/reportAttemptWithheld';

/**
 * .what = declare a resource to be prepared before tests
 * .why = simplifies devexp via `const thing = usePrep(...)` syntax
 * .mode =
 *   - 'beforeAll': prepare once for all tests
 *   - 'beforeEach': prepare fresh for each test run
 */
export const usePrep = <T extends Record<string, any>>(
  setup: () => Promise<T>,
  options: {
    mode: 'beforeAll' | 'beforeEach';
  } = { mode: 'beforeAll' },
): T => {
  // metaphor: "drawer" = proxy target, "toolbox" = real resolved resource
  const drawer: Partial<T> = {}; // exposed object users access
  let toolbox: T | undefined; // holds the resolved result of setup()

  // declare proxy handler up front so we can mutate it
  const proxyHandler: ProxyHandler<any> = {
    get(_, prop) {
      if (toolbox === undefined)
        throw new UnexpectedCodePathError(
          'usePrep: tried to access value before setup completed',
        );
      return (toolbox as any)[prop];
    },
    ownKeys() {
      return Reflect.ownKeys(drawer);
    },
    getOwnPropertyDescriptor(_, prop) {
      return Object.getOwnPropertyDescriptor(drawer, prop);
    },
    apply() {
      throw new Error('usePrep: value is not callable');
    },
  };

  // capture path + context at registration time (synchronous)
  const path = getDescribePath();
  const ctxAtRegistration = getCurrentRepeatableContext();
  const isInsideSome =
    (findRepeatableContext(path) ?? ctxAtRegistration)?.criteria === 'SOME';

  const register =
    options.mode === 'beforeEach' ? globals().beforeEach : globals().beforeAll;

  // .note = inside a SOME block the hook registers with TIMEOUT_MAX_MS, so the
  //         runner's own timer never fires; the race below owns the real budget
  const hook = async () => {
    // lookup context by path hierarchy (explicit, not implicit global)
    const ctx = findRepeatableContext(path) ?? ctxAtRegistration;

    // skip if prior attempt succeeded
    if (ctx?.anyAttemptPassed) {
      console.log(
        `      🫧  [skipped] prior repeatably attempt passed (setup)`,
      );
      return;
    }

    // outside a SOME block, a setup failure fails the hook, as for any hook
    if (ctx?.criteria !== 'SOME') {
      toolbox = await setup();
      Object.assign(drawer, toolbox);
      delete proxyHandler.get;
      return;
    }

    // inside a SOME block, run the setup against the runner's own time budget
    // .note = deliberate mutation: toolbox is the closure the proxy reads; ctx is the one
    //         state every attempt of the block shares
    const outcome = await getOneAttemptOutcome({
      body: async () => {
        toolbox = await setup();
      },
      budgetMs: getOneTestBudget({ runner: getTestRunner() }),
    });

    // a clean setup exposes its toolbox
    // .note = judged by the outcome alone: a side-effect setup may return undefined
    if (outcome.error === null) {
      // assign properties from toolbox to drawer so Object.keys(), for..in, etc work
      Object.assign(drawer, toolbox);

      // remove get trap once setup is complete — access becomes direct
      delete proxyHandler.get;
      return;
    }

    // a failed setup marks the attempt failed, so it never counts as the pass
    const verdict = setAttemptFailed({ ctx, error: outcome.error });

    // the final attempt rethrows the first error of any attempt, as a test body does
    if (verdict.isFinal) throw verdict.errorFirst ?? outcome.error;

    // a non-final setup failure is withheld; its tests read the unset toolbox and
    // are withheld too, and the next attempt runs the setup afresh
    toolbox = undefined;
    reportAttemptWithheld({
      attemptIndex: ctx.thisAttemptIndex,
      failure: outcome.error,
    });
  };
  register(hook, isInsideSome ? TIMEOUT_MAX_MS : undefined);

  // return a proxy that looks and feels like toolbox
  return new Proxy(drawer, proxyHandler) as T;
};

export const useBeforeAll = <T extends Record<string, any>>(
  setup: Parameters<typeof usePrep<T>>[0],
): ReturnType<typeof usePrep<T>> => usePrep<T>(setup, { mode: 'beforeAll' });
export const useBeforeEach = <T extends Record<string, any>>(
  setup: Parameters<typeof usePrep<T>>[0],
): ReturnType<typeof usePrep<T>> => usePrep<T>(setup, { mode: 'beforeEach' });
