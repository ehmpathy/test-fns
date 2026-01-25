/**
 * .what = test suite via bdd namespace WITHOUT globals
 * .why = proves vitest works with `import { bdd }` pattern,
 *        independent of the globals setup file
 *
 * @see .agent/repo=.this/role=any/briefs/limitation.esm-thenable-then-export.md
 */
import { describe, expect } from 'vitest';

import { bdd } from './givenWhenThen';

describe('givenWhenThen via bdd namespace', () => {
  describe('bdd.given/when/then', () => {
    bdd.given('bdd namespace is used', () => {
      bdd.when('tests are structured with bdd.given/when/then', () => {
        bdd.then('it should display the hierarchy correctly', () => {
          expect(true).toBe(true);
        });
      });
    });
  });

  describe('bdd.then.skip', () => {
    bdd.given('bdd.then.skip is used', () => {
      bdd.when('a test is skipped', () => {
        bdd.then.skip('this test should be skipped', () => {
          throw new Error('should not run');
        });
      });
    });
  });

  describe('bdd.then.todo', () => {
    bdd.given('bdd.then.todo is used', () => {
      bdd.when('a test is marked as todo', () => {
        bdd.then.todo('this test is marked as todo');
      });
    });
  });

  describe('bdd.then.skipIf', () => {
    bdd.given('bdd.then.skipIf is used', () => {
      bdd.when('condition is true', () => {
        bdd.then.skipIf(true)('should be skipped', () => {
          throw new Error('should not run');
        });
      });
      bdd.when('condition is false', () => {
        bdd.then.skipIf(false)('this should run', () => {
          expect(true).toBe(true);
        });
      });
    });
  });

  describe('bdd.then.repeatably', () => {
    bdd.given('a test with repeatably', () => {
      bdd.when('criteria = EVERY', () => {
        bdd.then.repeatably({ attempts: 3, criteria: 'EVERY' })(
          'it should succeed every time',
          () => {
            expect(true).toBe(true);
          },
        );
      });
      bdd.when('criteria = SOME', () => {
        bdd.then.repeatably({ attempts: 3, criteria: 'SOME' })(
          'it should have access to the attempt counter',
          ({ attempt }) => {
            expect(attempt).toBeGreaterThan(0);
          },
        );
      });
    });
  });

  describe('bdd.when.repeatably', () => {
    bdd.given('criteria = EVERY (default)', () => {
      bdd.when.repeatably({ attempts: 3 })(
        'a repeated when block',
        ({ getAttempt }) => {
          bdd.then('it should have access to the attempt counter', () => {
            expect(getAttempt()).toBeGreaterThan(0);
            expect(getAttempt()).toBeLessThanOrEqual(3);
          });
        },
      );
    });

    bdd.given('criteria = EVERY (explicit)', () => {
      bdd.when.repeatably({ attempts: 3, criteria: 'EVERY' })(
        'a repeated when block',
        ({ getAttempt }) => {
          bdd.then('it should have access to the attempt counter', () => {
            expect(getAttempt()).toBeGreaterThan(0);
            expect(getAttempt()).toBeLessThanOrEqual(3);
          });
        },
      );
    });

    bdd.given('criteria = SOME', () => {
      bdd.when.repeatably({ attempts: 5, criteria: 'SOME' })(
        'a block where tests retry on failure',
        ({ getAttempt }) => {
          bdd.then('tests inside retry until success', () => {
            // fail on first 2 attempts, succeed on 3rd
            expect(getAttempt()).toBeGreaterThanOrEqual(3);
          });
        },
      );
    });
  });

  describe('bdd.given.repeatably', () => {
    bdd.given.repeatably({ attempts: 3 })(
      'criteria = EVERY (default)',
      ({ getAttempt }) => {
        bdd.when('a repeated given block', () => {
          bdd.then('it should have access to the attempt counter', () => {
            expect(getAttempt()).toBeGreaterThan(0);
            expect(getAttempt()).toBeLessThanOrEqual(3);
          });
        });
      },
    );

    bdd.given.repeatably({ attempts: 3, criteria: 'EVERY' })(
      'criteria = EVERY (explicit)',
      ({ getAttempt }) => {
        bdd.when('a repeated given block', () => {
          bdd.then('it should have access to the attempt counter', () => {
            expect(getAttempt()).toBeGreaterThan(0);
            expect(getAttempt()).toBeLessThanOrEqual(3);
          });
        });
      },
    );

    bdd.given.repeatably({ attempts: 5, criteria: 'SOME' })(
      'criteria = SOME',
      ({ getAttempt }) => {
        bdd.when('tests inside retry on failure', () => {
          bdd.then('tests inside retry until success', () => {
            // fail on first 2 attempts, succeed on 3rd
            expect(getAttempt()).toBeGreaterThanOrEqual(3);
          });
        });
      },
    );
  });
});
