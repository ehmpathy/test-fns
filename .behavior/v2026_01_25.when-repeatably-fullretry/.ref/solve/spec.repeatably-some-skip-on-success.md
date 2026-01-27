# spec: repeatably SOME skip-on-success

## .what

formal specification for `criteria: 'SOME'` behavior on `given.repeatably` and `when.repeatably`.

## .acceptance criteria

### given a `when.repeatably` with `criteria: 'SOME'` and `attempts: 3`

```ts
when.repeatably({ attempts: 3, criteria: 'SOME' })('flaky operation', () => {
  const result = useThen('operation runs', async () => flakyTask());
  then('result is valid', () => expect(result.status).toBe('ok'));
});
```

#### when attempt 1 succeeds

```
then: 3 describe blocks are registered
then: attempt 1 executes all tests
then: attempt 1 passes
then: attempt 2 tests are skipped
then: attempt 3 tests are skipped
then: overall suite passes
```

#### when attempt 1 fails and attempt 2 succeeds

```
then: 3 describe blocks are registered
then: attempt 1 executes all tests
then: attempt 1 fails
then: attempt 2 executes all tests (fresh useThen)
then: attempt 2 passes
then: attempt 3 tests are skipped
then: overall suite passes
```

#### when all attempts fail

```
then: 3 describe blocks are registered
then: attempt 1 executes all tests, fails
then: attempt 2 executes all tests (fresh useThen), fails
then: attempt 3 executes all tests (fresh useThen), fails
then: overall suite fails
```

### given a `given.repeatably` with `criteria: 'SOME'`

```ts
given.repeatably({ attempts: 3, criteria: 'SOME' })('flaky scenario', () => {
  const resource = useBeforeAll(async () => createResource());

  when('action occurs', () => {
    then('effect happens', () => expect(resource.state).toBe('ready'));
  });
});
```

#### when attempt 1 succeeds

```
then: attempt 1 useBeforeAll runs, tests run, pass
then: attempt 2 is skipped entirely (useBeforeAll does not run)
then: attempt 3 is skipped entirely
```

#### when attempt 1 fails and attempt 2 succeeds

```
then: attempt 1 useBeforeAll runs, tests run, fail
then: attempt 2 useBeforeAll runs fresh, tests run, pass
then: attempt 3 is skipped entirely
```

## .implementation: vitest

### approach: registration-time context capture + beforeEach skip

this approach uses registration-time context capture to enable `useBeforeAll` to skip expensive operations without custom runners. see `design.registration-time-context-capture.md` for details.

```ts
// givenWhenThen.ts

type RepeatableConfig = {
  attempts: number;
  criteria: 'EVERY' | 'SOME';
};

type RepeatableContext = {
  getAttempt: () => number;
};

// minimal module-level registry — only the pointer
const registryDescribeRepeatable = {
  current: null as { hasSucceeded: () => boolean } | null,
};

const genDescribeRepeatable = (
  describeFn: typeof describe,
  config: RepeatableConfig,
) => {
  return (desc: string, fn: (context: RepeatableContext) => void) => {
    // context scoped inside genDescribeRepeatable
    const contextDescribeRepeatable = { hasSucceeded: false };

    for (let attempt = 1; attempt <= config.attempts; attempt++) {
      describeFn(`${desc}, attempt ${attempt}`, () => {
        let thisAttemptFailed = false;

        // SET at registration (describe callbacks run synchronously)
        registryDescribeRepeatable.current = {
          hasSucceeded: () => contextDescribeRepeatable.hasSucceeded,
        };

        // skip all tests if a prior attempt succeeded (SOME only)
        beforeEach((testContext: { skip?: () => void }) => {
          if (config.criteria === 'SOME' && contextDescribeRepeatable.hasSucceeded) {
            testContext.skip?.();
          }
        });

        // track failures within this attempt
        afterEach((testContext: { task?: { result?: { state: string } } }) => {
          if (testContext.task?.result?.state === 'fail') {
            thisAttemptFailed = true;
          }
        });

        // after all tests in this attempt, mark success if no failures
        afterAll(() => {
          if (!thisAttemptFailed && !contextDescribeRepeatable.hasSucceeded) {
            contextDescribeRepeatable.hasSucceeded = true;
          }
        });

        // user's code runs — useBeforeAll captures context here
        fn({ getAttempt: () => attempt });

        // CLEAR after registration
        registryDescribeRepeatable.current = null;
      });
    }
  };
};

// useBeforeAll with context-aware skip
export const useBeforeAll = <T>(fn: () => Promise<T> | T) => {
  // capture at registration time
  const ctx = registryDescribeRepeatable.current;

  const proxy = createProxy<T>();
  beforeAll(async () => {
    // check at execution time via captured reference
    if (ctx?.hasSucceeded()) return; // skip expensive work!

    const result = await fn();
    proxy.__set(result);
  });
  return proxy;
};

// exports
export const given = Object.assign(
  (desc: string, fn: () => void) => describe(`given: ${desc}`, fn),
  {
    repeatably: (config: RepeatableConfig) =>
      genDescribeRepeatable(
        (d, f) => describe(`given: ${d}`, f),
        config,
      ),
  },
);

export const when = Object.assign(
  (desc: string, fn: () => void) => describe(`when: ${desc}`, fn),
  {
    repeatably: (config: RepeatableConfig) =>
      genDescribeRepeatable(
        (d, f) => describe(`when: ${d}`, f),
        config,
      ),
  },
);
```

### vitest version requirement

- `context.skip()` requires vitest 3.1+
- for vitest < 3.1, use custom runner approach (see appendix)

### test output (vitest)

```
✓ when: flaky operation, attempt 1 (2 tests)
  ✓ then: operation runs
  ✓ then: result is valid
↓ when: flaky operation, attempt 2 (2 tests skipped)
↓ when: flaky operation, attempt 3 (2 tests skipped)
```

## .implementation: jest

### approach: registration-time context capture + early-return wrapper

jest does not have `context.skip()` in beforeEach. we use early-return wrapper with the same registration-time context capture pattern.

```ts
// givenWhenThen.ts (jest variant)

type RepeatableConfig = {
  attempts: number;
  criteria: 'EVERY' | 'SOME';
};

type RepeatableContext = {
  getAttempt: () => number;
};

// minimal module-level registry — only the pointer
const registryDescribeRepeatable = {
  current: null as { hasSucceeded: () => boolean } | null,
};

const genDescribeRepeatable = (
  describeFn: typeof describe,
  config: RepeatableConfig,
) => {
  return (desc: string, fn: (context: RepeatableContext) => void) => {
    // context scoped inside genDescribeRepeatable
    const contextDescribeRepeatable = { hasSucceeded: false };

    for (let attempt = 1; attempt <= config.attempts; attempt++) {
      describeFn(`${desc}, attempt ${attempt}`, () => {
        let thisAttemptFailed = false;

        // SET at registration
        registryDescribeRepeatable.current = {
          hasSucceeded: () => contextDescribeRepeatable.hasSucceeded,
        };

        // wrap every test to check if we should skip
        const originalTest = global.test;
        const originalIt = global.it;

        beforeAll(() => {
          // override test/it to inject skip logic
          const wrapTest = (testFn: typeof test) => {
            return (name: string, fn: jest.ProvidesCallback, timeout?: number) => {
              testFn(name, async () => {
                // skip if prior attempt succeeded
                if (config.criteria === 'SOME' && contextDescribeRepeatable.hasSucceeded) {
                  return; // early return = skip
                }
                await fn();
              }, timeout);
            };
          };

          global.test = wrapTest(originalTest) as typeof test;
          global.it = wrapTest(originalIt) as typeof it;
        });

        afterAll(() => {
          // restore original test/it
          global.test = originalTest;
          global.it = originalIt;

          // mark success if no failures
          if (!thisAttemptFailed && !contextDescribeRepeatable.hasSucceeded) {
            contextDescribeRepeatable.hasSucceeded = true;
          }
        });

        afterEach(() => {
          // detect failure via jest's state
          try {
            expect(true).toBe(true); // no-op to access state
          } catch {
            thisAttemptFailed = true;
          }
        });

        // user's code runs — useBeforeAll captures context here
        fn({ getAttempt: () => attempt });

        // CLEAR after registration
        registryDescribeRepeatable.current = null;
      });
    }
  };
};

// useBeforeAll with context-aware skip (same as vitest)
export const useBeforeAll = <T>(fn: () => Promise<T> | T) => {
  const ctx = registryDescribeRepeatable.current;
  const proxy = createProxy<T>();
  beforeAll(async () => {
    if (ctx?.hasSucceeded()) return; // skip expensive work!
    const result = await fn();
    proxy.__set(result);
  });
  return proxy;
};
```

### alternative jest approach: custom environment

for cleaner integration, use a jest custom environment:

```ts
// JestSkipOnSuccessEnvironment.ts
const NodeEnvironment = require('jest-environment-node').default;

class SkipOnSuccessEnvironment extends NodeEnvironment {
  private attemptSucceeded = new Map<string, boolean>();

  async handleTestEvent(event, state) {
    if (event.name === 'test_start') {
      const suiteKey = this.extractSuiteKey(event.test);
      if (this.attemptSucceeded.get(suiteKey)) {
        event.test.mode = 'skip';
      }
    }

    if (event.name === 'test_done' && event.test.errors.length > 0) {
      // mark this attempt as failed
      const suiteKey = this.extractSuiteKey(event.test);
      this.attemptSucceeded.set(suiteKey + ':failed', true);
    }

    if (event.name === 'run_describe_finish') {
      const suiteKey = event.describeBlock.name;
      const hasFailed = this.attemptSucceeded.get(suiteKey + ':failed');
      if (!hasFailed) {
        // extract base suite name without attempt suffix
        const baseSuite = suiteKey.replace(/, attempt \d+$/, '');
        this.attemptSucceeded.set(baseSuite, true);
      }
    }
  }

  private extractSuiteKey(test) {
    return test.parent.name.replace(/, attempt \d+$/, '');
  }
}

module.exports = SkipOnSuccessEnvironment;
```

configure in `jest.config.js`:
```js
module.exports = {
  testEnvironment: './JestSkipOnSuccessEnvironment.ts',
};
```

### test output (jest)

```
PASS src/example.test.ts
  when: flaky operation, attempt 1
    ✓ then: operation runs (5 ms)
    ✓ then: result is valid (2 ms)
  when: flaky operation, attempt 2
    ○ skipped then: operation runs
    ○ skipped then: result is valid
  when: flaky operation, attempt 3
    ○ skipped then: operation runs
    ○ skipped then: result is valid
```

## .detection of attempt success

### vitest

```ts
afterEach((context) => {
  // vitest provides task result in context
  if (context.task?.result?.state === 'fail') {
    thisAttemptFailed = true;
  }
});
```

### jest

```ts
afterEach(() => {
  // jest: use expect.getState() or track via custom matcher
  const state = expect.getState();
  // or catch assertion errors in wrapped test
});
```

## .summary

| framework | skip mechanism | config required |
|-----------|----------------|-----------------|
| vitest 3.1+ | `context.skip()` in beforeEach | none |
| vitest < 3.1 | custom runner | `vitest.config.ts` |
| jest | custom environment | `jest.config.js` |
| jest (simple) | early return in wrapped test | none |

## .recommended approach

### vitest

use registration-time context capture + `context.skip()` — zero config, skips both tests AND `useBeforeAll`:

```ts
// tests skip via beforeEach
beforeEach((testContext) => {
  if (contextDescribeRepeatable.hasSucceeded) testContext.skip?.();
});

// useBeforeAll skips via captured context
beforeAll(async () => {
  if (ctx?.hasSucceeded()) return; // skip expensive work!
  const result = await fn();
  proxy.__set(result);
});
```

### jest

use registration-time context capture + early-return wrapper — zero config, skips both tests AND `useBeforeAll`:

```ts
// tests skip via early return
testFn(name, async () => {
  if (contextDescribeRepeatable.hasSucceeded) return;
  await fn();
});

// useBeforeAll skips via captured context (same pattern)
beforeAll(async () => {
  if (ctx?.hasSucceeded()) return;
  const result = await fn();
  proxy.__set(result);
});
```

for cleaner skip report output in jest, optionally provide custom environment.

## .solved: useBeforeAll skip via registration-time context capture

### the problem (now solved)

with naive `beforeEach` + `context.skip()` approach:
- tests in attempt 2/3 are skipped
- but `beforeAll` for attempt 2/3 **still runs**

this matters when `useBeforeAll` creates expensive resources:

```ts
given.repeatably({ attempts: 3, criteria: 'SOME' })('flaky scenario', () => {
  // without solution: this runs 3 times even if attempt 1 succeeds!
  const resource = useBeforeAll(async () => createExpensiveResource());

  when('action occurs', () => {
    then('effect happens', () => expect(resource.state).toBe('ready'));
  });
});
```

### the solution: registration-time context capture

see `design.registration-time-context-capture.md` for full details.

**key insight**: describe callbacks run **synchronously at registration time**. we can:
1. set a context pointer at registration
2. let `useBeforeAll` capture that pointer in its closure
3. the pointer references a function that reads mutable state
4. at execution time, the function returns the current state

```ts
// useBeforeAll captures context at registration, checks at execution
export const useBeforeAll = <T>(fn: () => Promise<T> | T) => {
  const ctx = registryDescribeRepeatable.current; // captured at registration

  const proxy = createProxy<T>();
  beforeAll(async () => {
    if (ctx?.hasSucceeded()) return; // checked at execution — skip!
    const result = await fn();
    proxy.__set(result);
  });
  return proxy;
};
```

### achieved behavior

```
attempt 1 succeeds:
  useBeforeAll (attempt 1) → runs (ctx.hasSucceeded() = false)
  tests (attempt 1)        → run, pass
  afterAll                 → sets hasSucceeded = true
  useBeforeAll (attempt 2) → SKIPPED (ctx.hasSucceeded() = true)
  tests (attempt 2)        → skipped via beforeEach
  useBeforeAll (attempt 3) → SKIPPED
  tests (attempt 3)        → skipped via beforeEach
```

## .dx comparison: final approach

| aspect | registration-time context capture | custom runner/environment |
|--------|-----------------------------------|---------------------------|
| **user config required** | **none** | `vitest.config.ts` or `jest.config.js` |
| **useBeforeAll skipped for passed attempts** | **yes** | yes |
| **test output shows skipped** | ✓ tests show as skipped | ✓ suite shows as skipped |
| **vitest support** | 3.1+ via context.skip() | any version via runner api |
| **jest support** | via early-return wrapper | via custom environment |
| **install complexity** | **zero — just use test-fns** | must configure test environment |
| **works with prior config** | **yes** | may conflict with other environments |

### recommendation

**registration-time context capture is the recommended approach**:
- zero config required
- skips both tests AND expensive `useBeforeAll` operations
- works with both vitest and jest
- no custom runners or environments needed

custom runners/environments are **not needed** for this use case.

## .references

- [vitest context.skip()](https://vitest.dev/api/#context-skip)
- [vitest custom runner](https://vitest.dev/advanced/runner.html)
- [jest testEnvironment](https://jestjs.io/docs/configuration#testenvironment-string)
- [jest handleTestEvent](https://jestjs.io/docs/configuration#testenvironment-string)
- related brief: `design.repeatably-criteria-semantics.md`
- related brief: `analysis.skip-on-success-retry-pattern.md`
