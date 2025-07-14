import { getError } from 'helpful-errors';

import { given, when, then } from './givenWhenThen';
import { usePrep } from './usePrep';

let callCount = 0;

describe('usePrep', () => {
  given('a setup function that returns a test object', () => {
    const setup = async () => {
      callCount++;
      return { value: `hello-${callCount}` };
    };

    describe('mode: beforeAll', () => {
      when('registered with usePrep', () => {
        const result = usePrep(setup, { mode: 'beforeAll' });

        then('value should be resolved once before all tests', async () => {
          expect(result.value).toBeDefined();
          expect(result.value).toMatch(/hello-1/);
        });

        then('subsequent tests still see the same value', async () => {
          expect(result.value).toBe(`hello-1`);
        });
      });
    });

    describe('mode: beforeEach', () => {
      when('registered with usePrep', () => {
        const capturedValues: string[] = [];
        const result = usePrep(setup, { mode: 'beforeEach' });

        then('each test gets a fresh value', async () => {
          capturedValues.push(result.value);
          expect(result.value).toMatch(/hello-\d+/);
        });

        then('value is recomputed between tests', async () => {
          capturedValues.push(result.value);
          expect(new Set(capturedValues).size).toBeGreaterThan(1);
        });
      });
    });
  });

  given('accessing the proxy too early', () => {
    when('getting a property before beforeAll runs', () => {
      const value = usePrep(async () => ({ foo: 'bar' }), {
        mode: 'beforeAll',
      });
      const err = getError(() => value.foo);

      then('it throws an error', async () => {
        expect(err.message).toMatch(/before setup completed/);
      });
    });
  });

  given('return value is accidentally called as function', () => {
    when('accessing as if it were a callable', () => {
      const value = usePrep(async () => ({ foo: 'bar' }), {
        mode: 'beforeAll',
      });
      const err = getError(() => (value as any)());

      then('it throws an error', async () => {
        expect(err.message).toMatch(/value is not a function/);
      });
    });
  });
});
