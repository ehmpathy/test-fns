import { given, then, when } from './givenWhenThen';

/**
 * .what = test suites for .repeatably functionality
 * .why = verifies given.repeatably, when.repeatably, and then.repeatably with EVERY and SOME criteria
 */

describe('when.repeatably', () => {
  given('criteria = EVERY (default)', () => {
    when.repeatably({ attempts: 3 })('a repeated when block', ({ attempt }) => {
      then('it should have access to the attempt counter', () => {
        expect(attempt).toBeGreaterThan(0);
        expect(attempt).toBeLessThanOrEqual(3);
      });
    });
  });

  given('criteria = EVERY (explicit)', () => {
    when.repeatably({ attempts: 3, criteria: 'EVERY' })(
      'a repeated when block',
      ({ attempt }) => {
        then('it should have access to the attempt counter', () => {
          expect(attempt).toBeGreaterThan(0);
          expect(attempt).toBeLessThanOrEqual(3);
        });
      },
    );
  });

  given('criteria = SOME', () => {
    const whenRepeatablySomeExecutedAttempts: number[] = [];
    when.repeatably({ attempts: 3, criteria: 'SOME' })(
      'a block where subsequent attempts skip on success',
      ({ attempt }) => {
        then('attempt counter is valid and tracks execution', () => {
          whenRepeatablySomeExecutedAttempts.push(attempt);
          expect(attempt).toBeGreaterThan(0);
          expect(attempt).toBeLessThanOrEqual(3);
        });
      },
    );

    // verify skip behavior via afterAll
    afterAll(() => {
      // first attempt passes, so only attempt 1 should execute
      expect(whenRepeatablySomeExecutedAttempts).toEqual([1]);
    });
  });
});

/**
 * .what = isolated describe block to prove all then blocks run together per attempt
 * .why = verifies N-describe architecture runs complete block per attempt
 */
describe('when.repeatably multiple then blocks', () => {
  given('criteria = SOME with multiple then blocks', () => {
    // track which then blocks execute on which attempts
    const thenAExecutedAttempts: number[] = [];
    const thenBExecutedAttempts: number[] = [];

    when.repeatably({ attempts: 3, criteria: 'SOME' })(
      'a block with two then assertions',
      ({ attempt }) => {
        // both then blocks track their execution
        then('thenA runs', () => {
          thenAExecutedAttempts.push(attempt);
          expect(true).toBe(true);
        });

        then('thenB runs', () => {
          thenBExecutedAttempts.push(attempt);
          expect(true).toBe(true);
        });
      },
    );

    // verify both then blocks ran on attempt 1 only (skip-on-success)
    afterAll(() => {
      // both then blocks ran on attempt 1
      expect(thenAExecutedAttempts).toEqual([1]);
      expect(thenBExecutedAttempts).toEqual([1]);
    });
  });
});

describe('given.repeatably', () => {
  given.repeatably({ attempts: 3 })(
    'criteria = EVERY (default)',
    ({ attempt }) => {
      when('a repeated given block', () => {
        then('it should have access to the attempt counter', () => {
          expect(attempt).toBeGreaterThan(0);
          expect(attempt).toBeLessThanOrEqual(3);
        });
      });
    },
  );

  given.repeatably({ attempts: 3, criteria: 'EVERY' })(
    'criteria = EVERY (explicit)',
    ({ attempt }) => {
      when('a repeated given block', () => {
        then('it should have access to the attempt counter', () => {
          expect(attempt).toBeGreaterThan(0);
          expect(attempt).toBeLessThanOrEqual(3);
        });
      });
    },
  );

  const givenRepeatablySomeExecutedAttempts: number[] = [];
  given.repeatably({ attempts: 3, criteria: 'SOME' })(
    'criteria = SOME with skip on success',
    ({ attempt }) => {
      when('test runs', () => {
        then('attempt counter is valid and tracks execution', () => {
          givenRepeatablySomeExecutedAttempts.push(attempt);
          expect(attempt).toBeGreaterThan(0);
          expect(attempt).toBeLessThanOrEqual(3);
        });
      });
    },
  );

  // verify skip behavior via afterAll at describe level
  afterAll(() => {
    // first attempt passes, so only attempt 1 should execute
    expect(givenRepeatablySomeExecutedAttempts).toEqual([1]);
  });
});

/**
 * .what = then.repeatably tests
 * .why = verifies then.repeatably behavior for EVERY and SOME criteria
 */
describe('then.repeatably', () => {
  given('criteria = EVERY', () => {
    // track that all attempts actually run
    const everyExecutedAttempts: number[] = [];

    then.repeatably({ attempts: 3, criteria: 'EVERY' })(
      'it should run all attempts',
      ({ attempt }) => {
        everyExecutedAttempts.push(attempt);
        expect(attempt).toBeGreaterThan(0);
        expect(attempt).toBeLessThanOrEqual(3);
      },
    );

    // verify all 3 attempts ran
    afterAll(() => {
      expect(everyExecutedAttempts).toEqual([1, 2, 3]);
    });
  });

  given('criteria = SOME', () => {
    // track how many times test was called before success
    const someExecutedAttempts: number[] = [];

    then.repeatably({ attempts: 5, criteria: 'SOME' })(
      'it should retry until success',
      ({ attempt }) => {
        someExecutedAttempts.push(attempt);
        // fails on attempts 1-3, passes on attempt 4+
        expect(attempt).toBeGreaterThan(3);
      },
    );

    // verify retries happened: attempts 1-3 failed, attempt 4 passed
    afterAll(() => {
      expect(someExecutedAttempts).toEqual([1, 2, 3, 4]);
    });
  });
});
