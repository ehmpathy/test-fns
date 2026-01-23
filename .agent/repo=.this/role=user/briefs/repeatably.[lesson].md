# repeatably: test probabilistic behavior

## .what

`repeatably` is a modifier available on `given`, `when`, and `then` that runs test blocks multiple times to evaluate repeatability. use it to test probabilistic behavior, verify consistency, or identify flaky tests.

## .when to use

use `repeatably` when you need to:

1. **test probabilistic behavior** - when outcomes have randomness (e.g., retry logic, random selection)
2. **verify consistency** - ensure behavior is stable across multiple runs
3. **stress test** - run the same scenario multiple times to catch race conditions
4. **test retry mechanisms** - verify that something succeeds within N attempts

## .why to use

### for `then.repeatably`

two modes are available:

- **`criteria: 'EVERY'`** - all attempts must pass. useful to verify consistent behavior.
- **`criteria: 'SOME'`** - at least one attempt must pass. useful for probabilistic tests where success is expected eventually (uses jest's `retryTimes` or vitest's `retry`).

### for `given.repeatably` and `when.repeatably`

runs the describe block N times. useful to:
- test behavior under different attempt contexts
- stress test a scenario multiple times
- verify setup/teardown consistency

## .how to use

### `then.repeatably` with EVERY criteria

all attempts must pass:

```ts
given('a deterministic function', () => {
  when('called multiple times', () => {
    then.repeatably({ attempts: 5, criteria: 'EVERY' })(
      'it should return the same result',
      ({ attempt }) => {
        const result = deterministicFn();
        expect(result).toBe('expected');
        console.log(`attempt ${attempt} passed`);
      },
    );
  });
});
```

### `then.repeatably` with SOME criteria

at least one attempt must pass (useful for probabilistic tests):

```ts
given('a probabilistic function', () => {
  when('called multiple times', () => {
    then.repeatably({ attempts: 5, criteria: 'SOME' })(
      'it should eventually succeed',
      ({ attempt }) => {
        // this test will retry up to 5 times until it passes
        const result = probabilisticFn();
        expect(result).toBe('success');
      },
    );
  });
});
```

### `when.repeatably`

runs the when block multiple times:

```ts
given('a system under stress', () => {
  when.repeatably({ attempts: 10 })('the operation is performed', ({ attempt }) => {
    then('it should succeed', () => {
      const result = performOperation();
      expect(result.success).toBe(true);
    });

    then('it should complete within timeout', () => {
      expect(result.duration).toBeLessThan(1000);
    });
  });
});
```

### `given.repeatably`

runs the given block multiple times:

```ts
given.repeatably({ attempts: 3 })('different initial states', ({ attempt }) => {
  const state = setupState(attempt);

  when('the system processes the state', () => {
    then('it should handle all variations', () => {
      expect(process(state)).toBeDefined();
    });
  });
});
```

## .recommended: environment-specific criteria for probabilistic tests

for **inherently probabilistic** assertions (e.g., LLM responses, probabilistic algorithms, statistical samples), use different criteria based on the environment:

- **locally**: use `criteria: 'EVERY'` to verify the assertion is repeatable
- **CI/CD**: use `criteria: 'SOME'` to allow retries and prevent false failures that block deploys

```ts
given('an LLM-based classifier', () => {
  when('it classifies a clear-cut example', () => {
    then.repeatably({
      attempts: 3,
      criteria: process.env.CI ? 'SOME' : 'EVERY',
    })(
      'it should classify correctly',
      async () => {
        const result = await llmClassifier.classify('This product is amazing!');
        expect(result.sentiment).toBe('positive');
        expect(result.confidence).toBeGreaterThan(0.8);
      },
    );
  });
});
```

### why this pattern works

| environment | criteria | behavior | goal |
|-------------|----------|----------|------|
| local | `EVERY` | runs 3 times, all must pass | verify the assertion is reliably true |
| CI/CD | `SOME` | retries up to 3 times until one passes | tolerate inherent variance in probabilistic systems |

this gives you the best of both worlds:
- developers verify assertions are repeatable before they push
- CI/CD pipelines tolerate the inherent variance of probabilistic systems

### when NOT to use this pattern

**do not use `criteria: 'SOME'` to mask flaky deterministic tests.** if a test is flaky due to:
- race conditions
- shared mutable state
- time dependencies
- improper test isolation

**fix the root cause instead.** flaky deterministic tests that retry hide bugs and lead to unreliable systems. `repeatably` with `SOME` is only appropriate for behavior that is **inherently non-deterministic** by design.

## .context parameter

all `repeatably` variants provide an `{ attempt }` parameter to the callback:

- `attempt` starts at 1 and increments to `attempts`
- use it to vary test data, log progress, or assert on the attempt number

```ts
then.repeatably({ attempts: 3, criteria: 'EVERY' })(
  'attempt counter works',
  ({ attempt }) => {
    expect(attempt).toBeGreaterThan(0);
    expect(attempt).toBeLessThanOrEqual(3);
  },
);
```
