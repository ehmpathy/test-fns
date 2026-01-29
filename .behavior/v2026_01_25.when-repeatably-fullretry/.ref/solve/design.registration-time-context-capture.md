# design: registration-time context capture

## .what

a pattern to share state between `genDescribeRepeatable` and `useBeforeAll` without custom runners, via context capture at describe-body registration time.

## .the problem

`useBeforeAll` needs to know whether a prior attempt succeeded so it can skip expensive operations. but:
- `useBeforeAll` is a separate exported function
- the success state lives inside `genDescribeRepeatable`
- custom runners require user config (bad dx)

## .the insight

describe body callbacks run **synchronously at registration time**, not at test execution time. we can:
1. set a context pointer at registration
2. let `useBeforeAll` capture that pointer in its closure
3. the pointer references a function that reads mutable state
4. at execution time, the function returns the current state

## .why this works

```
registration phase (synchronous):
  genDescribeRepeatable sets registryDescribeRepeatable.current
    → user's fn() runs
      → useBeforeAll captures ctx = registryDescribeRepeatable.current
    → registryDescribeRepeatable.current cleared

execution phase (later):
  attempt 1:
    beforeAll runs → ctx.hasSucceeded() returns false → fn runs
    tests pass
    afterAll sets contextDescribeRepeatable.hasSucceeded = true

  attempt 2:
    beforeAll runs → ctx.hasSucceeded() returns TRUE → fn SKIPPED
    tests skipped via beforeEach
```

the key: `hasSucceeded: () => contextDescribeRepeatable.hasSucceeded` is a **function**, not a value. it reads from shared mutable state at call time, not capture time.

## .why parallel describe blocks don't conflict

concern: "wouldn't all parallel describe blocks compete for `registryDescribeRepeatable.current`?"

answer: **no** — describe callbacks run **synchronously during registration**, not in parallel.

```
given.repeatably(...)('scenario A', fnA)
  → contextDescribeRepeatableA = { hasSucceeded: false }
  → for attempt 1:
    → describe('A, attempt 1', () => {
        current = { hasSucceeded: () => contextA.hasSucceeded }  // SET
        fnA()  // useBeforeAll captures current → points to A
        current = null  // CLEAR
      })
      ↑ runs IMMEDIATELY, synchronously
  → for attempt 2: same pattern (immediate)
  → for attempt 3: same pattern (immediate)
  → returns

given.repeatably(...)('scenario B', fnB)  // only runs AFTER A completes
  → contextDescribeRepeatableB = { hasSucceeded: false }
  → same pattern, captures B's context
```

key guarantees:
- describe callbacks run immediately, not queued
- the for loop completes synchronously before returning
- each `.repeatably()` call finishes entirely before the next begins
- separate test files run in separate workers with separate module state

## .implementation

```ts
// minimal module-level registry — only the pointer
const registryDescribeRepeatable = {
  current: null as { hasSucceeded: () => boolean } | null,
};

export const genDescribeRepeatable = (
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

        beforeEach((testContext: { skip?: () => void }) => {
          if (config.criteria === 'SOME' && contextDescribeRepeatable.hasSucceeded) {
            testContext.skip?.();
          }
        });

        afterEach((testContext: { task?: { result?: { state: string } } }) => {
          if (testContext.task?.result?.state === 'fail') {
            thisAttemptFailed = true;
          }
        });

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
```

## .benefits

| aspect | custom runner approach | registration-time capture |
|--------|------------------------|---------------------------|
| user config required | yes | **no** |
| beforeAll skipped | yes | **yes** |
| works with vitest | requires vitest.config.ts | **zero config** |
| works with jest | requires jest.config.js | **zero config** |

## .constraints

- only works for `useBeforeAll` calls **inside** a repeatably block
- `useBeforeAll` outside repeatably blocks works normally (ctx is null, no skip check)
- registration must be synchronous (standard for describe bodies)

## .scope

this pattern applies to:
- `given.repeatably` with `criteria: 'SOME'`
- `when.repeatably` with `criteria: 'SOME'`

for `criteria: 'EVERY'`, all attempts run regardless — no skip needed.

## .references

- related brief: `spec.repeatably-some-skip-on-success.md`
- related brief: `design.repeatably-criteria-semantics.md`
