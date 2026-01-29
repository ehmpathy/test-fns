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
});
