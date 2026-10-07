import { ConstraintError } from 'helpful-errors';

/**
 * .what = runs one attempt's body against a time budget, and reports how it ended
 * .why = a repeatable attempt must be able to withhold any failure — a throw or an
 *        overrun alike. the runner's own timer fails a test from outside any catch, so
 *        the wrapper owns the deadline and turns an overrun into a returned error
 *
 * .note = an overrun does not cancel the body; it cannot be cancelled. the body may
 *         still settle later, and its result or rejection is dropped on purpose
 */
export const getOneAttemptOutcome = async (input: {
  body: () => unknown;
  budgetMs: number | null;
}): Promise<{ error: unknown | null }> => {
  // start the body; the async wrap turns a sync throw into a rejection
  const drive = (async () => input.body())().then(
    () => ({ error: null }),
    (error: unknown) => ({ error }),
  );

  // no budget means the runner owns the deadline, as for any plain test
  if (input.budgetMs === null) return drive;

  // race the body against the budget; the timer clears once the body settles
  const budgetMs = input.budgetMs;
  const overrun = new Promise<{ error: unknown }>((settle) => {
    const timer = setTimeout(
      () =>
        settle({
          error: new ConstraintError(
            `exceeded the ${budgetMs}ms budget (the test timeout)`,
            {
              budgetMs,
              hint: 'raise it via jest.setTimeout, vi.setConfig, or testTimeout in config',
            },
          ),
        }),
      budgetMs,
    );
    void drive.then(() => clearTimeout(timer));
  });
  return Promise.race([drive, overrun]);
};
