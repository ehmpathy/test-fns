# design: then-wrapper pattern for skip-on-success

## .what

leverage the `then()` wrapper to add skip-on-success and failure detection — no global override needed.

## .why

test-fns already wraps `test`/`it` via the `then()` function. users call `then()`, not raw `test`. this means we can add context detection directly in `then` without:
- mutation of `global.test`/`global.it`
- restoration logic
- race condition risks

## .how

### the `then` wrapper with context detection

```ts
export const then = (description: string, fn: () => Promise<void> | void) => {
  // capture context at registration time
  const ctx = registryDescribeRepeatable.current;

  test(`then: ${description}`, async (testContext) => {
    // skip if prior attempt succeeded
    if (ctx?.hasSucceeded()) {
      console.log(`    🫧  [SKIPPED] prior attempt passed`);
      testContext.skip?.(); // vitest 3.1+: proper skip marker
      return;               // jest: early return (shows as passed)
    }

    // failure detection via try/catch
    try {
      await fn();
    } catch (error) {
      ctx?.markFailed();
      throw error; // re-throw so framework marks test as failed
    }
  });
};
```

### framework behavior

| framework | `testContext.skip?.()` | result |
|-----------|------------------------|--------|
| vitest 3.1+ | calls `context.skip()` | test marked as "skipped" |
| jest | undefined, no-op | falls through to `return`, test "passes" |

### console output makes skip explicit

**jest output:**
```
✓ then: flaky operation runs
✓ then: result is valid
    🫧  [SKIPPED] prior attempt passed
✓ then: flaky operation runs
    🫧  [SKIPPED] prior attempt passed
✓ then: result is valid
```

**vitest output:**
```
✓ then: flaky operation runs
✓ then: result is valid
↓ then: flaky operation runs [skipped]
↓ then: result is valid [skipped]
```

the console.log makes it clear to jest users that tests were skipped, even though jest shows them as passed.

### why this works

1. **registration-time capture**: `then()` runs inside describe callback (synchronous)
2. **execution-time check**: `ctx?.hasSucceeded()` reads mutable state when test runs
3. **failure detection**: try/catch around user's test function
4. **no globals touched**: we wrap via our own function, not `global.test`

## .complete pattern

```ts
// registry for context capture
const registryDescribeRepeatable = {
  current: null as {
    hasSucceeded: () => boolean;
    markFailed: () => void;
  } | null,
};

// then wrapper with skip + failure detection
export const then = (description: string, fn: () => Promise<void> | void) => {
  const ctx = registryDescribeRepeatable.current;

  test(`then: ${description}`, async (testContext) => {
    if (ctx?.hasSucceeded()) {
      testContext.skip?.();
      return;
    }

    try {
      await fn();
    } catch (error) {
      ctx?.markFailed();
      throw error;
    }
  });
};

// genDescribeRepeatable sets up the context
const genDescribeRepeatable = (
  describeFn: typeof describe,
  config: RepeatableConfig,
) => {
  return (desc: string, fn: (context: RepeatableContext) => void) => {
    const state = { hasSucceeded: false, attemptFailed: false };

    for (let attempt = 1; attempt <= config.attempts; attempt++) {
      describeFn(`${desc}, attempt ${attempt}`, () => {
        state.attemptFailed = false;

        // set context for then/useBeforeAll/useAfterAll to capture
        registryDescribeRepeatable.current = {
          hasSucceeded: () => state.hasSucceeded,
          markFailed: () => { state.attemptFailed = true; },
        };

        afterAll(() => {
          if (!state.attemptFailed && !state.hasSucceeded) {
            state.hasSucceeded = true;
          }
        });

        // user's describe callback runs here — then() captures context
        fn({ getAttempt: () => attempt });

        // clear registry
        registryDescribeRepeatable.current = null;
      });
    }
  };
};
```

## .comparison: then-wrapper vs global override

| aspect | then-wrapper | global override |
|--------|--------------|-----------------|
| global mutation | none | yes (risky) |
| restoration needed | none | yes (crash risk) |
| race conditions | none | possible |
| vitest skip marker | yes (`context.skip()`) | yes |
| jest skip marker | no (shows as passed) | no |
| complexity | low | high |

## .jest limitation

jest has no `testContext.skip()`. skipped tests show as "passed" in jest output.

for proper skip markers in jest, users would need a custom environment — but that requires configuration and uses unsupported apis.

## .recommendation

use the then-wrapper approach:
- zero config
- no global mutation
- vitest users get proper skip markers
- jest users see "passed" (acceptable tradeoff for zero-config)
