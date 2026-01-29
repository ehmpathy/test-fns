# limitation: vitest cannot replicate playwright's serial retry

## .what

vitest cannot natively replicate playwright's `describe.serial` retry behavior where **all tests in a suite re-run together** when any test fails.

## .the playwright behavior we want

when `describe.serial` is combined with `retries`:

```ts
// playwright
test.describe.serial('checkout flow', () => {
  test.describe.configure({ retries: 2 });

  test('add to cart', async () => { /* ... */ });
  test('enter payment', async () => { /* fails */ });
  test('confirm order', async () => { /* ... */ });
});
```

**execution flow on failure:**

```
worker #1:
  beforeAll         → runs
  "add to cart"     → PASS
  "enter payment"   → FAIL
  "confirm order"   → SKIPPED (due to prior failure)

worker #2 (fresh process, retry #1):
  beforeAll         → runs again (fresh worker)
  "add to cart"     → runs again (even though it passed before)
  "enter payment"   → PASS (flaky test succeeded)
  "confirm order"   → PASS
```

**key characteristics:**
1. tests run sequentially
2. if any test fails, subsequent tests are skipped
3. on retry, **spawn fresh worker process**
4. on retry, **all tests re-run from the start** (including passed ones)
5. `beforeAll` re-runs because fresh worker = fresh module state

## .what vitest provides

### describe.sequential

```ts
// vitest
describe.sequential('checkout flow', () => {
  test('add to cart', () => { /* ... */ });
  test('enter payment', () => { /* ... */ });
  test('confirm order', () => { /* ... */ });
});
```

✅ tests run sequentially
❌ no automatic skip of subsequent tests on failure
❌ no suite-level retry

### per-test retry

```ts
describe('checkout flow', { retry: 2 }, () => {
  test('add to cart', () => { /* ... */ });
  test('enter payment', () => { /* ... */ });
  test('confirm order', () => { /* ... */ });
});
```

✅ failed tests retry
❌ only the **failed test** retries, not the whole suite
❌ `beforeAll` does NOT re-run on retry
❌ passed tests do NOT re-run

### execution flow in vitest

```
"add to cart"     → PASS
"enter payment"   → FAIL (attempt 1)
"enter payment"   → FAIL (attempt 2)
"enter payment"   → PASS (attempt 3)
"confirm order"   → runs (uses stale state from attempt 1's "add to cart")
```

**the problem**: "add to cart" ran once. "enter payment" retried 3 times. but "add to cart" never re-ran, so any state it created is from the first (and only) execution.

## .the fundamental gap

| capability | playwright serial | vitest |
|------------|-------------------|--------|
| sequential execution | ✅ | ✅ `describe.sequential` |
| skip on prior failure | ✅ automatic | ❌ must implement |
| fresh worker on retry | ✅ | ❌ same process |
| beforeAll re-runs on retry | ✅ | ❌ runs once only |
| passed tests re-run on retry | ✅ | ❌ only failed test retries |
| module state reset on retry | ✅ | ❌ state persists |

### why this matters for test-fns

```ts
given.repeatably({ attempts: 3, criteria: 'SOME' })('checkout flow', () => {
  const cart = useBeforeAll(async () => createCart());

  when('items are added', () => {
    const result = useThen('add succeeds', async () => addToCart(cart.id));

    then('cart has items', () => {
      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  when('payment fails then succeeds', () => {
    then('payment processes', async () => {
      // flaky - fails first 2 attempts, passes on 3rd
      await processPayment(cart.id);
    });
  });
});
```

**what we want:**
- attempt 1: cart created → add succeeds → payment FAILS
- attempt 2: **new cart** → add runs again → payment FAILS
- attempt 3: **new cart** → add runs again → payment PASSES

**what vitest does:**
- cart created once
- add runs once
- payment retries 3 times **with same cart** from attempt 1

## .why vitest can't fix this easily

### 1. beforeAll runs once by design

from [vitest issue #6726](https://github.com/vitest-dev/vitest/issues/6726): there's no built-in retry option for hooks. `beforeAll` runs once per suite, period.

### 2. test retry is test-scoped

vitest's retry mechanism operates at the individual test level. when test B retries, vitest has no concept of "go back and re-run test A too."

### 3. no fresh worker on retry

from [vitest issue #7834](https://github.com/vitest-dev/vitest/issues/7834): feature request for `--retry-isolated` that would spawn fresh worker on retry. status: open, not implemented.

### 4. module state persists

module-level variables, singletons, and closures retain their values between retry attempts. without fresh worker, no way to reset.

## .can custom runner solve this?

vitest's [runner api](https://vitest.dev/advanced/runner) provides:

```ts
class CustomRunner extends VitestTestRunner {
  runSuite(suite: Suite): Promise<void>  // override suite execution
  runTask(test: TaskPopulated): Promise<void>  // override test execution
}
```

### what we can do

1. **sequential execution**: iterate tasks in order
2. **skip on failure**: set `task.mode = 'skip'` for subsequent tests
3. **track failure state**: know when to trigger retry

### what we cannot do

1. **re-run beforeAll**: hooks are managed internally by vitest, not exposed to runner
2. **reset module state**: would require re-importing the file
3. **re-run passed tests**: vitest's result tracking doesn't support this
4. **spawn fresh worker**: pool management is outside runner scope

### attempted implementation

```ts
class SerialRetryRunner extends VitestTestRunner {
  async runSuite(suite: Suite) {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // PROBLEM: can't re-run beforeAll hooks
      // PROBLEM: can't reset module state
      // PROBLEM: test results from prior attempt persist

      let failed = false;
      for (const task of suite.tasks) {
        if (failed) {
          task.mode = 'skip';  // skip subsequent tests
          continue;
        }

        await this.runTask(task);

        if (task.result?.state === 'fail') {
          failed = true;
        }
      }

      if (!failed) return;  // success

      // PROBLEM: how do we reset and re-run?
      // - beforeAll won't re-run
      // - passed tests won't re-run
      // - module state won't reset
    }
  }
}
```

**verdict**: custom runner can implement "skip on failure" but **cannot implement "re-run all on retry"** without vitest core changes.

## .workarounds

### option 1: single-test wrapper

wrap entire suite in one test so retry retries all:

```ts
describe('checkout flow', () => {
  test('entire flow', { retry: 3 }, async () => {
    // setup (re-runs on each retry)
    const cart = await createCart();

    // all assertions in one test
    const addResult = await addToCart(cart.id);
    expect(addResult.items.length).toBeGreaterThan(0);

    await processPayment(cart.id);
    expect(cart.status).toBe('paid');
  });
});
```

✅ all logic re-runs on retry
✅ fresh state each attempt
❌ loses individual test granularity
❌ single failure point in reporting

### option 2: external orchestration

re-run entire test file on failure:

```ts
// wrapper command
const result = await vitest.run(['checkout.test.ts']);
if (result.failed && retries < maxRetries) {
  await vitest.run(['checkout.test.ts']);  // fresh run
}
```

✅ fresh worker, fresh state
✅ beforeAll re-runs
❌ file-level granularity (not suite-level)
❌ external to vitest

### option 3: use playwright for serial tests

for tests that truly need serial retry semantics:

```ts
// checkout.serial.spec.ts (playwright)
import { test, expect } from '@playwright/test';

test.describe.serial('checkout flow', () => {
  test.describe.configure({ retries: 2 });

  test('add to cart', async () => { /* ... */ });
  test('enter payment', async () => { /* ... */ });
  test('confirm order', async () => { /* ... */ });
});
```

✅ native serial retry support
✅ fresh worker on retry
❌ different test runner
❌ no module mock support

### option 4: restructure tests for isolation

avoid the need for serial retry by making tests independent:

```ts
// instead of serial dependent tests...
describe('checkout flow', () => {
  test('add to cart', async () => {
    const cart = await createCart();
    await addToCart(cart.id);
    expect(cart.items.length).toBeGreaterThan(0);
  });

  test('payment processes', async () => {
    // create fresh cart for this test
    const cart = await createCart();
    await addToCart(cart.id);
    await processPayment(cart.id);
    expect(cart.status).toBe('paid');
  });
});
```

✅ each test is independent
✅ retry works correctly
❌ duplicated setup
❌ slower execution

## .what vitest would need to support serial retry

### required changes

1. **suite-level retry option**
   ```ts
   describe('suite', { retry: 3, mode: 'serial' }, () => { ... });
   ```

2. **fresh worker spawn on suite retry**
   - discard current worker
   - spawn new worker for retry
   - re-import test file (fresh module state)

3. **beforeAll/afterAll re-execution**
   - hooks must re-run on each suite attempt
   - or: option to mark hooks as "re-run on retry"

4. **test result reset**
   - clear results of all tests in suite before retry
   - treat retry as fresh execution

### related issues

- [vitest #7834](https://github.com/vitest-dev/vitest/issues/7834) - run failed tests in clean environment on retry
- [vitest #6726](https://github.com/vitest-dev/vitest/issues/6726) - add retry option for hooks

## .recommendation for test-fns

given vitest's limitations:

1. **for `criteria: 'SOME'` on `then.repeatably`**: works correctly (test-level retry)

2. **for `criteria: 'SOME'` on `given.repeatably` / `when.repeatably`**: document the limitation
   - tests inside retry independently
   - `useBeforeAll` does NOT re-run
   - `useThen` results are cached (don't re-run)

3. **for true suite-level retry**: recommend one of:
   - single-test wrapper pattern
   - `criteria: 'EVERY'` (creates N separate suites, each runs fresh)
   - external orchestration
   - playwright for critical serial flows

4. **future**: monitor vitest #7834 for `--retry-isolated` support

## .summary

| question | answer |
|----------|--------|
| can vitest do sequential execution? | ✅ yes, `describe.sequential` |
| can vitest skip on failure? | ⚠️ with custom runner |
| can vitest re-run passed tests on retry? | ❌ no |
| can vitest re-run beforeAll on retry? | ❌ no |
| can vitest spawn fresh worker on retry? | ❌ no (open feature request) |
| can custom runner fully solve this? | ❌ no, needs vitest core changes |

**bottom line**: vitest cannot replicate playwright's serial retry behavior. the closest approximation is the single-test wrapper pattern or external file-level orchestration.

## .references

- [playwright test retries and serial mode](https://playwright.dev/docs/test-retries)
- [vitest runner api](https://vitest.dev/advanced/runner)
- [vitest #7834 - retry in clean environment](https://github.com/vitest-dev/vitest/issues/7834)
- [vitest #6726 - retry option for hooks](https://github.com/vitest-dev/vitest/issues/6726)
- [vitest #1067 - run suites serially](https://github.com/vitest-dev/vitest/discussions/1067)
