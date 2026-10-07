import type { TestRunner } from '@src/infra/isomorph.test/detectTestRunner';

import { getOneAttemptOutcome } from '../budget/getOneAttemptOutcome';
import { getOneTestBudget } from '../budget/getOneTestBudget';
import { reportAttemptWithheld } from './reportAttemptWithheld';

/**
 * .what = the shape of the vitest test context this wrapper reads
 * .why = vitest records the 0-based retry index on `task.result.retryCount`
 *        (`@vitest/runner` runTest), and bumps it before each retry; jest has no
 *        such field, so it stays optional
 */
type ContextWithRetry =
  | { task?: { result?: { retryCount?: number } } }
  | undefined;

/**
 * .what = wraps a test body that a runner's native retry re-runs, so a non-final
 *         failure logs the withheld line before the runner retries it
 * .why = vitest `then.repeatably` SOME rides vitest's own `retry` option, which
 *        withholds a failed try silently; this keeps the one-line log contract
 *        the readme promises for every repeatable path
 * .note = the attempt number comes from the runner's own retry index, so it names
 *         this test's try — never a counter that a neighbor test also bumps
 * .note = the runner still owns the retry; this wrapper only reports and rethrows
 * .note = the caller registers the test with TIMEOUT_MAX_MS, so the runner's own timer
 *         never fires; the wrapper races the body against the real budget, so an
 *         overrun is a throw it can report, not a silent timeout
 */
export const withAttemptWithheldReport =
  (input: {
    testFn: (input: { attempt: number }) => unknown | Promise<unknown>;
    retriesMax: number;
    runner: TestRunner;
  }) =>
  async (context?: ContextWithRetry): Promise<void> => {
    const retryIndex = context?.task?.result?.retryCount ?? 0;

    // run the body against the budget the consumer set, read at run time
    const outcome = await getOneAttemptOutcome({
      body: () => input.testFn({ attempt: retryIndex + 1 }),
      budgetMs: getOneTestBudget({ runner: input.runner }),
    });
    if (outcome.error === null) return;

    // report the failure if the runner will retry it
    if (retryIndex < input.retriesMax)
      reportAttemptWithheld({
        attemptIndex: retryIndex + 1,
        failure: outcome.error,
      });

    // the runner decides pass or fail from the throw
    throw outcome.error;
  };
