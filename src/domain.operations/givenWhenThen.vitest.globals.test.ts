import { describe, expect } from 'vitest';

describe('givenWhenThen', () => {
  describe('given', () => {
    given('given/when/then are used', () => {
      when('used for organize', () => {
        then('it should display the hierarchy correctly', () => {
          // this test proves the hierarchy works by its name in output
          expect(true).toBe(true);
        });
      });
    });
  });

  describe('then.only', () => {
    // can't test .only programmatically - it would skip other tests
  });

  describe('then.skip', () => {
    given('then.skip is used', () => {
      when('a test is skipped', () => {
        then.skip('this test should be skipped', () => {
          throw new Error('should not run');
        });
      });
    });
  });

  describe('then.todo', () => {
    given('then.todo is used', () => {
      when('a test is marked as todo', () => {
        then.todo('this test is marked as todo');
      });
    });
  });

  describe('then.skipIf', () => {
    given('then.skipIf is used', () => {
      when('skipIf=true', () => {
        then.skipIf(true)('should be skipped', () => {
          throw new Error('should not run');
        });
      });
      when('skipIf=false', () => {
        then.skipIf(false)('this should run', () => {
          expect(true).toBe(true);
        });
        then.runIf(true)('this should run', () => {
          expect(true).toBe(true);
        });
        then.runIf(false)('this should be skipped', () => {
          throw new Error('should not run');
        });
        then.skipIf(true)('this should be skipped', () => {
          throw new Error('should not run');
        });
      });
    });
  });

  describe('then.repeatably', () => {
    given('a probabilistic test', () => {
      when('criteria = EVERY', () => {
        then.repeatably({ attempts: 3, criteria: 'EVERY' })(
          'it should succeed every time',
          () => {
            expect(true).toBe(true);
          },
        );
        then.repeatably({ attempts: 3, criteria: 'EVERY' })(
          'it should have access to the attempt counter',
          ({ attempt }) => {
            expect(attempt).toBeGreaterThan(0);
            expect(attempt).toBeLessThanOrEqual(3);
          },
        );
      });
      when('criteria = SOME', () => {
        then.repeatably({ attempts: 3, criteria: 'SOME' })(
          'it should have access to the attempt counter',
          ({ attempt }) => {
            expect(attempt).toBeGreaterThan(0);
          },
        );
      });
    });
  });

  describe('when.repeatably', () => {
    given('criteria = EVERY (default)', () => {
      when.repeatably({ attempts: 3 })(
        'a repeated when block',
        ({ getAttempt }) => {
          then('it should have access to the attempt counter', () => {
            expect(getAttempt()).toBeGreaterThan(0);
            expect(getAttempt()).toBeLessThanOrEqual(3);
          });
        },
      );
    });

    given('criteria = EVERY (explicit)', () => {
      when.repeatably({ attempts: 3, criteria: 'EVERY' })(
        'a repeated when block',
        ({ getAttempt }) => {
          then('it should have access to the attempt counter', () => {
            expect(getAttempt()).toBeGreaterThan(0);
            expect(getAttempt()).toBeLessThanOrEqual(3);
          });
        },
      );
    });

    given('criteria = SOME', () => {
      when.repeatably({ attempts: 5, criteria: 'SOME' })(
        'a block where tests retry on failure',
        ({ getAttempt }) => {
          then('tests inside retry until success', () => {
            // fail on first 2 attempts, succeed on 3rd
            expect(getAttempt()).toBeGreaterThanOrEqual(3);
          });
        },
      );
    });
  });

  describe('given.repeatably', () => {
    given.repeatably({ attempts: 3 })(
      'criteria = EVERY (default)',
      ({ getAttempt }) => {
        when('a repeated given block', () => {
          then('it should have access to the attempt counter', () => {
            expect(getAttempt()).toBeGreaterThan(0);
            expect(getAttempt()).toBeLessThanOrEqual(3);
          });
        });
      },
    );

    given.repeatably({ attempts: 3, criteria: 'EVERY' })(
      'criteria = EVERY (explicit)',
      ({ getAttempt }) => {
        when('a repeated given block', () => {
          then('it should have access to the attempt counter', () => {
            expect(getAttempt()).toBeGreaterThan(0);
            expect(getAttempt()).toBeLessThanOrEqual(3);
          });
        });
      },
    );

    given.repeatably({ attempts: 5, criteria: 'SOME' })(
      'criteria = SOME',
      ({ getAttempt }) => {
        when('tests inside retry on failure', () => {
          then('tests inside retry until success', () => {
            // fail on first 2 attempts, succeed on 3rd
            expect(getAttempt()).toBeGreaterThanOrEqual(3);
          });
        });
      },
    );
  });
});
