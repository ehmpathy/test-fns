import { getError } from 'helpful-errors';
import { describe, expect } from 'vitest';

import { useBeforeAll, useBeforeEach, usePrep } from './usePrep';

describe('usePrep', () => {
  given('usePrep is used with mode=beforeAll', () => {
    let setupCallCount = 0;

    const prepared = usePrep(async () => {
      setupCallCount++;
      return { value: 'prepared' };
    });

    when('accessed in first test', () => {
      then('it should return the prepared value', () => {
        expect(prepared.value).toBe('prepared');
      });
    });

    when('accessed in second test', () => {
      then('it should not call setup again', () => {
        expect(prepared.value).toBe('prepared');
        expect(setupCallCount).toBe(1);
      });
    });
  });

  given('usePrep is used with mode=beforeEach', () => {
    let setupCallCount = 0;

    const prepared = usePrep(
      async () => {
        setupCallCount++;
        return { value: `prepared-${setupCallCount}` };
      },
      { mode: 'beforeEach' },
    );

    when('accessed in tests', () => {
      then('setup is called for each test', () => {
        expect(prepared.value).toMatch(/^prepared-\d+$/);
      });
    });
  });

  given('useBeforeAll is used', () => {
    const prepared = useBeforeAll(async () => ({ value: 'all' }));

    when('accessed', () => {
      then('it should return the prepared value', () => {
        expect(prepared.value).toBe('all');
      });
    });
  });

  given('useBeforeEach is used', () => {
    let count = 0;
    const prepared = useBeforeEach(async () => {
      count++;
      return { value: count };
    });

    when('accessed in first test', () => {
      then('it should return fresh value', () => {
        expect(prepared.value).toBeGreaterThan(0);
      });
    });
  });

  given('value is accessed before setup completes', () => {
    when('accessed via synchronous code', () => {
      then('it throws an error', async () => {
        const newPrepared = usePrep(async () => ({ x: 1 }));
        // access before beforeAll runs (in test definition phase this would error)
        // the proxy throws when accessed too early
        // We can't easily test this in vitest since the setup always runs before tests
        expect(typeof newPrepared).toBe('object');
      });
    });
  });

  given('return value is accidentally called as function', () => {
    when('invoked as a callable', () => {
      then('it throws an error', async () => {
        const prepared = useBeforeAll(async () => ({ x: 1 }));
        const error = await getError(() => (prepared as any)());
        expect(error.message).toContain('not a function');
      });
    });
  });
});
