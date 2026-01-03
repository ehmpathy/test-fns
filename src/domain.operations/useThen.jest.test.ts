import { given, then, when } from './givenWhenThen';
import { useThen } from './useThen';

describe('useThen', () => {
  given('useThen is used to capture an operation result', () => {
    when('the operation returns an object', () => {
      const result = useThen('operation succeeds', async () => {
        return { status: 'success', data: { id: 123 } };
      });

      then('return value is accessible in subsequent then blocks', () => {
        expect(result.status).toEqual('success');
      });

      then('nested properties are accessible', () => {
        expect(result.data.id).toEqual(123);
      });
    });

    when('the operation is synchronous', () => {
      const result = useThen('sync operation succeeds', () => {
        return { value: 42 };
      });

      then('return value is accessible', () => {
        expect(result.value).toEqual(42);
      });
    });
  });

  given('useThen.skip is used', () => {
    when('the test is skipped', () => {
      const result = useThen.skip('this test is skipped', async () => {
        return { skipped: true };
      });

      then.skip('this assertion is also skipped', () => {
        expect(result.skipped).toEqual(true);
      });
    });
  });

  given('useThen.skipIf is used', () => {
    when('condition is true', () => {
      const result = useThen.skipIf(true)('conditionally skipped', async () => {
        return { value: 'should not run' };
      });

      then.skip('this is skipped because condition is true', () => {
        expect(result.value).toBeDefined();
      });
    });

    when('condition is false', () => {
      const result = useThen.skipIf(false)('conditionally runs', async () => {
        return { value: 'runs' };
      });

      then('return value is accessible', () => {
        expect(result.value).toEqual('runs');
      });
    });
  });

  given('useThen.runIf is used', () => {
    when('condition is true', () => {
      const result = useThen.runIf(true)('conditionally runs', async () => {
        return { value: 'runs' };
      });

      then('return value is accessible', () => {
        expect(result.value).toEqual('runs');
      });
    });

    when('condition is false', () => {
      const result = useThen.runIf(false)('conditionally skipped', async () => {
        return { value: 'should not run' };
      });

      then.skip('this is skipped because condition is false', () => {
        expect(result.value).toBeDefined();
      });
    });
  });

  given('multiple useThen calls in same when block', () => {
    when('operations are chained', () => {
      const first = useThen('first operation', async () => {
        return { step: 1 };
      });

      const second = useThen('second operation', async () => {
        return { step: 2, prevStep: first.step };
      });

      then('first result is accessible', () => {
        expect(first.step).toEqual(1);
      });

      then('second result references first', () => {
        expect(second.step).toEqual(2);
        expect(second.prevStep).toEqual(1);
      });
    });
  });

  given('Object.keys is called on useThen result', () => {
    when('the result has multiple properties', () => {
      const result = useThen('operation with props', async () => {
        return { a: 1, b: 2, c: 3 };
      });

      then('Object.keys returns the property names', () => {
        expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
      });
    });
  });
});
