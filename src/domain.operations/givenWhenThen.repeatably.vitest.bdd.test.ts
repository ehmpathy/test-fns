/**
 * .what = test suites for .repeatably functionality via bdd namespace
 * .why = isolated from main test file; then.repeatably is last to avoid pollution
 */
import { describe, expect } from 'vitest';

import { bdd } from './givenWhenThen';

describe('bdd.when.repeatably', () => {
  bdd.given('criteria = EVERY (default)', () => {
    bdd.when.repeatably({ attempts: 3 })(
      'a repeated when block',
      ({ attempt }) => {
        bdd.then('it should have access to the attempt counter', () => {
          expect(attempt).toBeGreaterThan(0);
          expect(attempt).toBeLessThanOrEqual(3);
        });
      },
    );
  });

  bdd.given('criteria = EVERY (explicit)', () => {
    bdd.when.repeatably({ attempts: 3, criteria: 'EVERY' })(
      'a repeated when block',
      ({ attempt }) => {
        bdd.then('it should have access to the attempt counter', () => {
          expect(attempt).toBeGreaterThan(0);
          expect(attempt).toBeLessThanOrEqual(3);
        });
      },
    );
  });

  bdd.given('criteria = SOME', () => {
    const whenRepeatablySomeExecutedAttempts: number[] = [];
    bdd.when.repeatably({ attempts: 3, criteria: 'SOME' })(
      'a block where subsequent attempts skip on success',
      ({ attempt }) => {
        bdd.then('attempt counter is valid and tracks execution', () => {
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

  bdd.given('criteria = SOME with multiple then blocks', () => {
    // track which then blocks execute on which attempts
    const thenAExecutedAttempts: number[] = [];
    const thenBExecutedAttempts: number[] = [];

    bdd.when.repeatably({ attempts: 3, criteria: 'SOME' })(
      'a block with two then assertions',
      ({ attempt }) => {
        // both then blocks track their execution
        bdd.then('thenA runs', () => {
          thenAExecutedAttempts.push(attempt);
          expect(true).toBe(true);
        });

        bdd.then('thenB runs', () => {
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

describe('bdd.given.repeatably', () => {
  bdd.given.repeatably({ attempts: 3 })(
    'criteria = EVERY (default)',
    ({ attempt }) => {
      bdd.when('a repeated given block', () => {
        bdd.then('it should have access to the attempt counter', () => {
          expect(attempt).toBeGreaterThan(0);
          expect(attempt).toBeLessThanOrEqual(3);
        });
      });
    },
  );

  bdd.given.repeatably({ attempts: 3, criteria: 'EVERY' })(
    'criteria = EVERY (explicit)',
    ({ attempt }) => {
      bdd.when('a repeated given block', () => {
        bdd.then('it should have access to the attempt counter', () => {
          expect(attempt).toBeGreaterThan(0);
          expect(attempt).toBeLessThanOrEqual(3);
        });
      });
    },
  );

  const givenRepeatablySomeExecutedAttempts: number[] = [];
  bdd.given.repeatably({ attempts: 3, criteria: 'SOME' })(
    'criteria = SOME with skip on success',
    ({ attempt }) => {
      bdd.when('test runs', () => {
        bdd.then('attempt counter is valid and tracks execution', () => {
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

describe('bdd.then.repeatably', () => {
  bdd.given('criteria = EVERY', () => {
    // track that all attempts actually run
    const everyExecutedAttempts: number[] = [];

    bdd.then.repeatably({ attempts: 3, criteria: 'EVERY' })(
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

  bdd.given('criteria = SOME', () => {
    // track how many times test was called before success
    const someExecutedAttempts: number[] = [];

    bdd.then.repeatably({ attempts: 5, criteria: 'SOME' })(
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
