import { describe, expect } from 'vitest';

import { bdd } from './givenWhenThen';
import { useThen } from './useThen';
import { useWhen } from './useWhen';

const { given, when, then } = bdd;

describe('useWhen', () => {
  /**
   * primary use case: capture operation response from a when block
   * and share it with sibling when blocks for idempotency verification
   */
  given('idempotency verification pattern', () => {
    when('[t0] before any changes', () => {
      then('initial state is confirmed', () => {
        expect(true).toEqual(true);
      });
    });

    const responseFirst = useWhen('[t1] operation is called', () => {
      const response = useThen('operation succeeds', async () => {
        return { id: 123, status: 'created', affected: ['resource-a'] };
      });

      then('response has expected id', () => {
        expect(response.id).toEqual(123);
      });

      then('response has expected status', () => {
        expect(response.status).toEqual('created');
      });

      return response;
    });

    when('[t2] operation is repeated', () => {
      const responseSecond = useThen('operation still succeeds', async () => {
        return { id: 123, status: 'created', affected: ['resource-a'] };
      });

      then('response is idempotent', () => {
        expect(responseSecond.id).toEqual(responseFirst.id);
        expect(responseSecond.status).toEqual(responseFirst.status);
      });

      then('affected resources match', () => {
        expect(responseSecond.affected).toEqual(responseFirst.affected);
      });
    });
  });

  /**
   * use case: sequential operations where t1 feeds into t2
   */
  given('sequential operations pattern', () => {
    const createResult = useWhen('[t1] resource is created', () => {
      const response = useThen('create succeeds', async () => {
        return { uuid: 'abc-123', version: 1 };
      });

      then('resource was created with uuid', () => {
        expect(response.uuid).toEqual('abc-123');
      });

      return response;
    });

    when('[t2] resource is updated', () => {
      const updateResult = useThen('update succeeds', async () => {
        return { uuid: createResult.uuid, version: 2 };
      });

      then('update references created resource', () => {
        expect(updateResult.uuid).toEqual(createResult.uuid);
      });

      then('version was incremented', () => {
        expect(updateResult.version).toEqual(createResult.version + 1);
      });
    });
  });

  /**
   * modifier support
   */
  given('useWhen.skip is used', () => {
    const result = useWhen.skip('[t1] this when is skipped', () => {
      return { skipped: true };
    });

    when('[t2] sibling when block runs', () => {
      then.skip('skipped result is undefined', () => {
        expect(result).toBeUndefined();
      });
    });
  });

  given('useWhen.skipIf is used', () => {
    const shouldSkip = true;

    const result = useWhen.skipIf(shouldSkip)(
      '[t1] conditionally skipped',
      () => {
        return { value: 'should not run' };
      },
    );

    when('[t2] sibling when block runs', () => {
      then.skip('skipped result is undefined', () => {
        expect(result).toBeUndefined();
      });
    });
  });

  given('useWhen.runIf is used', () => {
    const shouldRun = true;

    const result = useWhen.runIf(shouldRun)('[t1] conditionally runs', () => {
      const response = useThen('operation succeeds', async () => {
        return { value: 'executed' };
      });

      then('operation executed', () => {
        expect(response.value).toEqual('executed');
      });

      return response;
    });

    when('[t2] sibling when block runs', () => {
      then('result from t1 is accessible', () => {
        expect(result.value).toEqual('executed');
      });
    });
  });
});
