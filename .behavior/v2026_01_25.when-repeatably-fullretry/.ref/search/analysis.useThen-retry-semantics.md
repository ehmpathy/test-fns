# analysis: useThen retry semantics

## .what

analysis of whether `useThen` semantics could enable re-run of passed tests when dependent tests fail.

## .the question

given:
- test A = `useThen` (creates a test that caches result in proxy)
- test B = `then` (depends on test A's cached result)
- test B fails and triggers retry

could we make test A (the `useThen`) re-run when test B retries?

## .current useThen behavior

### how useThen works

```ts
when('scenario', () => {
  // creates a test called "then: operation succeeds"
  // runs fn(), caches result in `toolbox` closure variable
  // returns proxy that provides access to cached result
  const result = useThen('operation succeeds', async () => {
    return await expensiveOperation();
  });

  // subsequent then blocks access the cached result via proxy
  then('assertion 1', () => {
    expect(result.status).toBe('success');  // reads from cached toolbox
  });

  then('assertion 2', () => {
    expect(result.data).toBeDefined();  // reads from same cached toolbox
  });
});
```

### execution flow (current)

```
useThen "operation succeeds"  → runs → caches result → PASS
then "assertion 1"            → reads cache → PASS
then "assertion 2"            → reads cache → FAIL
then "assertion 2" (retry 1)  → reads SAME cache → FAIL
then "assertion 2" (retry 2)  → reads SAME cache → PASS
```

**problem**: the `useThen` test ran once and passed. the cached result is from that single run. retries of dependent tests use stale cached data.

## .why useThen cannot leverage retry

### 1. useThen creates a real test

```ts
// useThen.ts line 44-53
input.thenFn(input.desc, async () => {
  toolbox = await input.fn();
  Object.assign(drawer, toolbox);
  delete proxyHandler.get;  // remove trap once complete
});
```

`useThen` registers via `then()` which calls `globals().test()`. it's a real test in the framework's test registry.

### 2. test frameworks don't re-run passed tests

neither jest nor vitest provide a mechanism to say "test B is about to retry, please re-run test A first."

the retry mechanism is scoped to the individual failed test:
- jest: `jest.retryTimes(N)` affects only the test that fails
- vitest: `{ retry: N }` affects only the test that fails

### 3. no "beforeRetry" hook exists

the hook we would need:

```ts
// pseudocode - does not exist
beforeRetry((testName) => {
  // find useThen proxies that testName depends on
  // clear their caches
  // mark their tests for re-run
});
```

neither framework exposes this hook.

### 4. cache is in closure scope

the `toolbox` variable is a closure inside `createUseThenProxy`. there's no external mechanism to:
- detect that a dependent test is about to retry
- clear the cached value
- trigger a re-run of the `useThen` test

## .theoretical solutions

### option 1: expose a reset method on proxy

add `result.__reset()` to clear the cache:

```ts
const result = useThen('operation', async () => { ... });

// in beforeEach
beforeEach(() => {
  if (isRetry()) result.__reset();
});
```

**problems**:
- `isRetry()` doesn't exist in test frameworks
- even if we clear the cache, the `useThen` test won't re-run
- proxy access after clear would throw "tried to access value before test ran"

### option 2: use beforeEach semantics instead

make `useThen` run before each dependent test instead of once:

```ts
// would need a variant like
const result = useThen.beforeEach('operation', async () => { ... });
```

**problems**:
- massive performance regression (runs N times instead of once)
- defeats the purpose of `useThen` (share expensive operation result)

### option 3: track dependencies and detect retry

```ts
// track which tests access the proxy
// detect retry via beforeEach counter
// reset cache on retry detection
```

**problems**:
- even with cache reset, the `useThen` test is marked as passed
- no way to re-queue a passed test for re-execution
- would cause proxy access errors

### option 4: don't register useThen as a test

instead of a test, use `beforeAll` that runs lazily:

```ts
// register setup, not test
let toolbox: T | undefined;
globals().beforeAll(async () => {
  toolbox = await fn();
});
```

**problems**:
- `beforeAll` also doesn't re-run on test retry
- loses the test output for the `useThen` operation
- same fundamental limitation

## .what test-fns COULD support

### useThen with EVERY criteria (already works)

```ts
when.repeatably({ attempts: 3, criteria: 'EVERY' })('scenario', () => {
  const result = useThen('operation', async () => expensiveOperation());

  then('assertion', () => {
    expect(result.value).toBe(expected);
  });
});
```

execution:
```
when "scenario, attempt 1":
  useThen "operation"  → runs fresh
  then "assertion"     → runs

when "scenario, attempt 2":
  useThen "operation"  → runs fresh (separate describe block)
  then "assertion"     → runs

when "scenario, attempt 3":
  useThen "operation"  → runs fresh (separate describe block)
  then "assertion"     → runs
```

**works**: each attempt is a separate describe block with its own `useThen` instance.

**limitation**: all 3 attempts run, not "stop on first success."

### useThen with SOME criteria (current limitation)

```ts
when.repeatably({ attempts: 3, criteria: 'SOME' })('scenario', () => {
  const result = useThen('operation', async () => expensiveOperation());

  then('assertion', () => {
    expect(result.value).toBe(expected);
  });
});
```

execution:
```
when "scenario":
  useThen "operation"   → runs once, caches result
  then "assertion"      → FAIL (attempt 1, uses cache)
  then "assertion"      → FAIL (attempt 2, uses SAME cache)
  then "assertion"      → PASS (attempt 3, uses SAME cache)
```

**limitation**: `useThen` does NOT re-run. the cached result is from the first execution.

## .could custom vitest runner help?

from the vitest runner api analysis:

| capability | runner can do? |
|------------|----------------|
| detect test failure | ✅ yes |
| skip subsequent tests | ✅ yes |
| reset test results | ❌ no (internal state) |
| re-run passed tests | ❌ no (not in api) |
| re-run beforeAll | ❌ no (not exposed) |
| clear module state | ❌ no (would need re-import) |

even with a custom runner, we cannot force a passed test to re-run.

## .the fundamental constraint

```
┌─────────────────────────────────────────────────────┐
│  TEST FRAMEWORK RETRY = SINGLE TEST SCOPE           │
│                                                     │
│  when test B fails:                                 │
│    ✅ retry test B                                  │
│    ❌ re-run test A (already passed)                │
│    ❌ re-run beforeAll hooks                        │
│    ❌ reset module/closure state                    │
│                                                     │
│  the framework has no concept of:                   │
│    "test B depends on test A"                       │
│    "retry the dependency chain, not just the test" │
└─────────────────────────────────────────────────────┘
```

## .verdict

**useThen semantics do NOT provide an advantage for retry.**

the proxy pattern is excellent for:
- eliminate `let` declarations
- share operation results between assertions
- lazy access with clear error on premature access

but it cannot enable re-run of passed tests because:
1. `useThen` creates a real test that the framework marks as passed
2. the cache is in a closure with no external reset mechanism
3. test frameworks don't provide hooks for "before retry, re-run dependencies"
4. even a custom runner cannot re-queue passed tests

## .what would be required

to achieve the desired behavior ("if test B fails, retry test A too"):

1. **framework-level change**: jest/vitest would need to add:
   - suite-level retry (re-run entire describe block)
   - or: dependency track between tests
   - or: `beforeRetry` hook

2. **or: different test structure**:
   - use `criteria: 'EVERY'` to get N independent runs
   - or: put all logic in a single test with retry
   - or: use playwright which has native serial retry

## .recommendation

document the limitation clearly:

| pattern | useThen behavior on retry |
|---------|---------------------------|
| `then.repeatably({ criteria: 'SOME' })` | n/a (no useThen involved) |
| `when` with `useThen` + `then` (test fails) | `useThen` does NOT re-run |
| `when.repeatably({ criteria: 'EVERY' })` | each attempt gets fresh `useThen` |
| `when.repeatably({ criteria: 'SOME' })` | `useThen` does NOT re-run |

for users who need "retry the whole chain":
1. use `criteria: 'EVERY'` (runs all attempts, each fresh)
2. use single-test pattern (all logic in one retryable test)
3. use playwright for true serial retry semantics

## .references

- `useThen.ts` implementation: lines 18-57 (proxy pattern)
- `givenWhenThen.ts` implementation: lines 154-222 (repeatably logic)
- related: `limitation.vitest-serial-retry-gap.md`
- related: `limitation.describe-block-retry-semantics.md`
