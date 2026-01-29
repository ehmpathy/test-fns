# limitation: describe block retry semantics differ between jest and vitest

## .what

jest and vitest have fundamentally different retry mechanisms for describe blocks. this affects how `given.repeatably` and `when.repeatably` with `criteria: 'SOME'` can be implemented.

## .summary

| feature | jest | vitest |
|---------|------|--------|
| test-level retry | ✅ `jest.retryTimes(N)` | ✅ `test('name', { retry: N }, fn)` |
| describe-level retry option | ❌ not supported | ✅ `describe('name', { retry: N }, fn)` |
| retry inherits to child tests | ❌ no (must call retryTimes in describe) | ✅ yes (automatic inheritance) |
| beforeAll/afterAll retried | ❌ no | ❌ no |
| suite-level retry (re-run entire describe) | ❌ not supported | ❌ not supported |

## .jest

### what gets retried

| hook/block | retried on test failure? | runs per attempt? |
|------------|--------------------------|-------------------|
| `describe` callback | ❌ no | once total |
| `beforeAll` | ❌ no | once total |
| `afterAll` | ❌ no | once total |
| `beforeEach` | ✅ yes | once per attempt |
| `afterEach` | ✅ yes | once per attempt |
| `test`/`it` | ✅ yes | once per attempt |

### execution flow example

```
test fails on attempt 1, passes on attempt 3:

describe callback    → runs once
  beforeAll          → runs once
    beforeEach       → attempt 1
      test           → attempt 1 (FAIL)
    afterEach        → attempt 1
    beforeEach       → attempt 2
      test           → attempt 2 (FAIL)
    afterEach        → attempt 2
    beforeEach       → attempt 3
      test           → attempt 3 (PASS)
    afterEach        → attempt 3
  afterAll           → runs once
```

### how `jest.retryTimes` works

```js
jest.retryTimes(3, { logErrorsBeforeRetry: true });

describe('my suite', () => {
  beforeAll(() => { /* runs ONCE, not retried */ });
  beforeEach(() => { /* runs before each attempt */ });

  test('flaky test', () => {
    // retried up to 3 times if it fails
  });
});
```

### key limitations

1. **`jest.retryTimes` only affects tests, not describe blocks**
   - the describe callback runs once
   - only `test`/`it` blocks are retried

2. **`beforeAll`/`afterAll` are NOT retried**
   - only `beforeEach`/`afterEach` run on each retry attempt
   - workaround: [jest-retry-all-hooks](https://github.com/wix-incubator/jest-retry-all-hooks) package

3. **no suite-level retry**
   - open feature request: [jestjs/jest#10520](https://github.com/jestjs/jest/issues/10520)
   - status: "help wanted", not implemented

4. **placement matters**
   - `jest.retryTimes()` must be at top-level or inside describe
   - cannot be called inside `beforeEach` or `test`

### jest 30 enhancements (june 2025)

```js
jest.retryTimes(3, {
  logErrorsBeforeRetry: true,
  waitBeforeRetry: 1000,      // wait 1s between retries
  retryImmediately: true,     // don't wait for other tests
});
```

## .vitest

### what gets retried

| hook/block | retried on test failure? | runs per attempt? |
|------------|--------------------------|-------------------|
| `describe` callback | ❌ no | once total |
| `beforeAll` | ❌ no | once total |
| `afterAll` | ❌ no | once total |
| `beforeEach` | ✅ yes | once per attempt |
| `afterEach` | ✅ yes | once per attempt |
| `test`/`it` | ✅ yes | once per attempt |

### execution flow example

```
test fails on attempt 1, passes on attempt 3:

describe callback    → runs once
  beforeAll          → runs once
    beforeEach       → attempt 1
      test           → attempt 1 (FAIL)
    afterEach        → attempt 1
    beforeEach       → attempt 2
      test           → attempt 2 (FAIL)
    afterEach        → attempt 2
    beforeEach       → attempt 3
      test           → attempt 3 (PASS)
    afterEach        → attempt 3
  afterAll           → runs once
```

**identical to jest** — vitest follows the same retry semantics.

### how vitest retry works

```ts
// option 1: global config
// vitest.config.ts
export default defineConfig({
  test: {
    retry: 3,
  },
});

// option 2: per-test (second argument syntax, vitest 1.3+)
test('flaky test', { retry: 3 }, () => {
  // retried up to 3 times
});

// option 3: per-describe (inherits to child tests)
describe('my suite', { retry: 3 }, () => {
  test('inherits retry', () => {
    // retried up to 3 times (inherited from describe)
  });

  test('override', { retry: 1 }, () => {
    // retried only 1 time (overrides parent)
  });
});
```

### key differences from jest

1. **describe accepts options as second argument**
   - syntax: `describe('name', { retry: N }, fn)`
   - vitest 1.3+ (old syntax deprecated, removed in 2.0)

2. **retry inherits to child tests**
   - tests inside a describe with `{ retry: N }` automatically inherit
   - can be overridden per-test

3. **no suite-level retry either**
   - vitest also does not re-run the entire describe block
   - only individual tests are retried

## .implications for test-fns

### `then.repeatably({ criteria: 'SOME' })`

works correctly in both jest and vitest:
- jest: uses `jest.retryTimes(N)` + tracks `attempt` via `beforeEach`
- vitest: uses `test('name', { retry: N }, fn)`

### `given.repeatably({ criteria: 'SOME' })` and `when.repeatably({ criteria: 'SOME' })`

**the problem**: describe blocks don't have true retry semantics in either framework.

**what actually happens**:
- the describe callback runs **once**
- `jest.retryTimes` or vitest `{ retry: N }` affects tests **inside**
- the `attempt` counter only reflects test retries, not describe re-runs

**correct implementation**:

for **jest**:
```ts
given.repeatably({ attempts: 3, criteria: 'SOME' })('scene', ({ attempt }) => {
  // jest.retryTimes(3) called here
  // fn({ attempt: 1 }) - attempt is always 1 for describe setup
  // tests inside will retry, but describe setup doesn't re-run
});
```

for **vitest**:
```ts
// can pass { retry: N } to the describe block
// tests inside inherit retry option
```

### what this means for `useThen` with retry

`useThen` creates a test that captures a result. dependent tests access that result via proxy.

**scenario 1: `useThen` test fails**

```ts
when('event', () => {
  const result = useThen('operation succeeds', async () => {
    return await riskyOperation(); // might fail
  });

  then('result has expected value', () => {
    expect(result.value).toBe(42);
  });
});
```

execution with `retry: 3`:
```
useThen "operation succeeds"  → FAIL (attempt 1)
useThen "operation succeeds"  → FAIL (attempt 2, re-runs riskyOperation())
useThen "operation succeeds"  → PASS (attempt 3, toolbox = result)
then "result has expected value" → runs (uses result from attempt 3)
```

✅ **this works correctly** — `useThen` re-runs `fn()` on each retry until success.

**scenario 2: dependent test fails**

```ts
when('event', () => {
  const result = useThen('operation succeeds', async () => {
    return await riskyOperation(); // passes first time
  });

  then('result has expected value', () => {
    expect(result.value).toBe(42); // fails due to flaky assertion
  });
});
```

execution with `retry: 3`:
```
useThen "operation succeeds"       → PASS (toolbox = result)
then "result has expected value"   → FAIL (attempt 1, uses cached result)
then "result has expected value"   → FAIL (attempt 2, uses SAME cached result)
then "result has expected value"   → PASS (attempt 3, uses SAME cached result)
```

⚠️ **`useThen` does NOT re-run** — dependent tests use the cached result from the first successful run.

**scenario 3: multiple `useThen` in sequence**

```ts
when('event', () => {
  const first = useThen('first op', async () => createResource());
  const second = useThen('second op', async () => updateResource(first.id));

  then('both succeeded', () => {
    expect(second.status).toBe('updated');
  });
});
```

execution with `retry: 3`:
```
useThen "first op"    → PASS
useThen "second op"   → FAIL (attempt 1)
useThen "second op"   → PASS (attempt 2, re-runs updateResource with first.id)
then "both succeeded" → runs
```

✅ **each `useThen` retries independently** — if "second op" fails, only "second op" retries. "first op" result is cached.

**scenario 4: what does NOT happen (but ideally would)**

```
❌ useThen A passes, then B fails → A does NOT re-run
❌ useThen A passes, then B passes, then C fails → neither A nor B re-run
❌ passed tests never re-run on retry
```

### the ideal behavior (not supported by jest/vitest)

ideally, `criteria: 'SOME'` on a `when` block would retry **the entire block**:

```
IDEAL (not how it works):
  when block attempt 1:
    useThen A → PASS
    then B    → FAIL
  when block attempt 2 (full retry):
    useThen A → re-runs (fresh state)
    then B    → re-runs (with fresh A result)
    then B    → PASS
```

this would require **suite-level retry** — re-run the entire describe block with:
- beforeAll/afterAll hooks
- all useThen operations
- all dependent then blocks

**neither jest nor vitest support this**. see [jestjs/jest#10520](https://github.com/jestjs/jest/issues/10520).

### workaround: use `criteria: 'EVERY'` for true block retry

```ts
when.repeatably({ attempts: 3, criteria: 'EVERY' })('event', ({ getAttempt }) => {
  // creates 3 SEPARATE when blocks
  // each block runs independently with fresh state

  const result = useThen('operation', async () => riskyOperation());

  then('result is valid', () => {
    expect(result.value).toBe(42);
    console.log('attempt', getAttempt()); // logs 1, 2, or 3 per block
  });
});
```

execution:
```
when "event, attempt 1":
  useThen "operation" → PASS
  then "result is valid" → FAIL
when "event, attempt 2":
  useThen "operation" → PASS (fresh run)
  then "result is valid" → FAIL
when "event, attempt 3":
  useThen "operation" → PASS (fresh run)
  then "result is valid" → PASS
```

✅ **each attempt is a fresh block** — `useThen` re-runs for each attempt.

⚠️ **but all 3 attempts run** — not "stop on first success" like `SOME`.

### what this means for `useBeforeAll` inside `given`/`when`

```ts
given.repeatably({ attempts: 3, criteria: 'SOME' })('scene', () => {
  // this setup runs ONCE, not retried
  const resource = useBeforeAll(async () => {
    return await createExpensiveResource(); // runs ONCE
  });

  when('event', () => {
    then('effect', () => {
      // THIS is what gets retried
      expect(resource.value).toBe(expected);
    });
  });
});
```

**critical**: if `useBeforeAll` creates a resource that becomes invalid after a failed test, **retries will use the stale resource**. the setup does not re-run.

### api: `getAttempt()` function for describe-level repeatably

for `given.repeatably` and `when.repeatably`, the context provides a `getAttempt()` **function** (not a value) to access the current retry number:

```ts
// ✅ CORRECT - use getAttempt() function
given.repeatably({ attempts: 5, criteria: 'SOME' })('scene', ({ getAttempt }) => {
  then('attempt tracks retry number', () => {
    console.log(getAttempt()); // logs: 1, 2, 3, ... (actual retry number)
    expect(getAttempt()).toBeGreaterThan(0);
  });
});
```

**why `getAttempt()` is a function for describe-level but `attempt` is a value for test-level**:

| pattern | context shape | reason |
|---------|---------------|--------|
| `then.repeatably` | `{ attempt, getAttempt }` | callback runs on each retry, value is safe to destructure |
| `given.repeatably` | `{ getAttempt }` | callback runs once at registration, must defer via function call |
| `when.repeatably` | `{ getAttempt }` | callback runs once at registration, must defer via function call |

the function-based api prevents accidental misuse:
- for `then.repeatably`, the test callback runs fresh on each retry, so `({ attempt })` receives the current value
- for `given.repeatably` and `when.repeatably`, the describe callback runs **once** at test registration time
- if we exposed `attempt` as a value, destructure would capture `0` forever (a silent bug)
- by exposing only `getAttempt()`, users must call the function inside the test body where it returns the correct value

**how it works internally**:

1. a `beforeEach` hook runs before each test/retry and increments a counter keyed by test name
2. `getAttempt()` reads `expect.getState().currentTestName` and returns that test's counter
3. when you call `getAttempt()` inside a test body, you get the actual attempt number

### recommended approach

1. **for `SOME` on `given`/`when`**:
   - use `({ getAttempt })` and call `getAttempt()` inside test bodies
   - the retry affects `then` blocks inside, and `getAttempt()` reflects the actual retry number
   - vitest: uses `{ retry: N }` on describe for inheritance
   - jest: uses `jest.retryTimes(N)` inside describe

2. **for `EVERY` on `given`/`when`**:
   - use `({ getAttempt })` — each attempt creates a separate describe block
   - `getAttempt()` returns a fixed value per block (1, 2, 3, etc.)

3. **for `then.repeatably`**:
   - can use either `({ attempt })` or `({ getAttempt })` — both work
   - `attempt` is provided for convenience since the test callback runs on each retry

4. **if true describe retry is needed**:
   - use `criteria: 'EVERY'` which creates N separate describe blocks
   - each block gets its own `beforeAll` execution
   - or restructure tests so retry happens at the `then` level

5. **if setup must re-run on retry**:
   - use `useBeforeEach` instead of `useBeforeAll`
   - `beforeEach` runs before each retry attempt

## .future: potential solutions for suite-level retry

### jest

**current state**: no native suite-level retry. open feature request [#10520](https://github.com/jestjs/jest/issues/10520) proposes `entireDescribe: true` option.

**option 1: jest-retry package**
- [jest-retry](https://github.com/bZichett/jest-retry) retries entire **test files** (not describe blocks)
- works externally: runs jest, detects failures, re-runs failed files
- good for flaky E2E tests, but file-level granularity only

**option 2: custom jest-circus event handler**
- jest-circus allows binding to test events via `handleTestEvent`
- could potentially track failures and implement custom retry logic
- would require significant custom code

**option 3: external orchestration**
- [wealthfront approach](https://eng.wealthfront.com/2022/04/21/retrying-e2e-test-suites-with-jest/): wrapper command that runs jest, parses failures, re-runs failed suites
- merges junit output from multiple runs
- works but adds complexity outside jest

**option 4: custom environment with dynamic skip (serial within describe)**

jest-circus allows custom environments to intercept test events. while you can't re-execute tests, you can **skip tests that remain** when one fails — this replicates half of Playwright's `describe.serial` behavior.

```ts
// CustomSerialEnvironment.ts
const NodeEnvironment = require('jest-environment-node');

class CustomSerialEnvironment extends NodeEnvironment {
  failedInDescribe = new Set();

  async handleTestEvent(event) {
    if (event.name === 'test_fn_failure') {
      // mark this describe as failed
      const describeName = event.test.parent?.name;
      if (describeName) this.failedInDescribe.add(describeName);
    }

    if (event.name === 'test_start') {
      // skip if a prior test in this describe failed
      const describeName = event.test.parent?.name;
      if (describeName && this.failedInDescribe.has(describeName)) {
        // unsupported but functional pattern
        event.test.mode = 'skip';
      }
    }
  }
}
```

- source: [dynamically skip tests within jest](https://blog.scottlogic.com/2023/09/19/dynamically-skipping-tests-within-jest.html)
- related issue: [jestjs/jest#8387](https://github.com/jestjs/jest/issues/8387)
- package: [@sbnc/jest-skip](https://www.npmjs.com/package/@sbnc/jest-skip)

**limitations of dynamic skip approach**:
- only skips tests that follow — does not retry the suite
- `event.test.mode = 'skip'` is unsupported (may break in future jest versions)
- requires custom test environment configuration

**option 5: combine jest-retry-all-hooks + dynamic skip**

for suite-level retry with serial semantics:

1. use `jest-retry-all-hooks` to make `beforeAll` re-run on retries
2. use custom environment to skip tests that follow a failure
3. use `jest.retryTimes()` to retry the failed test

```ts
// this gets closest to Playwright's describe.serial behavior
describe('serial suite', () => {
  jest.retryTimes(3);

  beforeAll(() => {
    // re-runs on each retry thanks to jest-retry-all-hooks
    setupResources();
  });

  test('step 1', () => { /* if fails, retries; if still fails, skip step 2 */ });
  test('step 2', () => { /* skipped if step 1 exhausted retries */ });
});
```

**gap that remains**: tests that passed before another test failed don't re-run. only the failed test retries. this is fundamentally different from Playwright's "all-or-none" suite retry.

### vitest

**current state**: no native suite-level retry. retry only affects individual tests.

**option 1: --retry.isolated (proposed)**
- [issue #7834](https://github.com/vitest-dev/vitest/issues/7834) proposes isolated retry
- would spawn fresh worker for each retry attempt
- still test-level, not suite-level

**option 2: custom vitest plugin**
- vitest's plugin architecture could potentially support custom retry logic
- no existing plugin for suite-level retry

### playwright/test as a standalone test runner

`@playwright/test` IS a legitimate standalone test runner that CAN run pure Node.js tests without a browser.

```ts
// runs in Node.js, no browser launched
import { test, expect } from '@playwright/test';

test.describe.serial('suite', () => {
  test.describe.configure({ retries: 2 });

  test('step 1', async () => { /* pure Node.js code */ });
  test('step 2', async () => { /* pure Node.js code */ });
});
```

behavior we want:
- tests run sequentially
- if any test fails, all subsequent tests are skipped
- **on retry, ALL tests in the group re-run from the start**

#### pros of playwright/test

| feature | playwright | jest | vitest |
|---------|------------|------|--------|
| suite-level retry (all-or-none) | ✅ `describe.serial` | ❌ | ❌ |
| typescript out of box | ✅ | ❌ (needs ts-jest) | ✅ |
| no globals | ✅ | ❌ | ✅ |
| fixtures (DI for tests) | ✅ advanced | ❌ | ❌ |
| one tool for E2E + unit | ✅ | ❌ | ❌ |

#### cons of playwright/test for unit tests

| limitation | impact | workaround |
|------------|--------|------------|
| **no module mock** | can't mock imports | use dependency injection |
| no built-in spies | can't spy on functions | use `sinon` or `jest-mock` |
| no fake timers | can't control time | use `sinon` |
| no code coverage | can't measure coverage | use `nyc` + `source-map-support` |
| watch mode experimental | slower dev loop | — |
| less ecosystem familiarity | learning curve | — |

> "module mock limitation is the biggest downside" — [patricktree.me](https://patricktree.me/blog/using-playwright-to-run-unit-tests)

#### performance

- no specific benchmarks found for playwright vs jest/vitest on pure Node.js tests
- playwright architecture is designed for browser orchestration, may have overhead
- vitest is [10-20x faster than jest](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/) on large codebases
- playwright likely slower than vitest for pure Node.js tests (unconfirmed)

#### verdict

**playwright/test is viable** for pure Node.js tests if:
- you need `describe.serial` with suite-level retry (the feature we want)
- you already use playwright for E2E tests (one tool)
- you use dependency injection (no module mock needed)

**not recommended** if:
- you rely heavily on module mock (`jest.mock()`)
- performance is critical (vitest is faster)
- you want mature watch mode

### potential test-fns implementation

**approach: single-test wrapper for `SOME` criteria**

instead of creating multiple `then` blocks, `when.repeatably({ criteria: 'SOME' })` could create ONE test that executes all inner logic:

```ts
when.repeatably({ attempts: 3, criteria: 'SOME' })('event', () => {
  // instead of registering multiple then blocks,
  // wrap everything in a single retryable test

  then('all assertions', async () => {
    const result = await riskyOperation();
    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
    expect(result.c).toBe(3);
  });
});
```

pros:
- retry retries everything (setup + all assertions)
- works with existing jest/vitest retry mechanisms

cons:
- loses individual test reporting (all assertions in one test)
- changes the mental model significantly

**approach: dynamic registration via test file re-execution**

```ts
// pseudocode - would require custom runner
when.repeatably({ attempts: 3, criteria: 'SOME', mode: 'suite' })('event', () => {
  // on failure, re-run the entire test file with this when block
  // track attempt via environment variable or file
});
```

this would require:
- custom jest runner or vitest plugin
- external state to track attempts
- file-level re-execution

## .references

### jest
- [jest.retryTimes documentation](https://jestjs.io/docs/jest-object)
- [jest suite-level retry feature request #10520](https://github.com/jestjs/jest/issues/10520)
- [jest retry entire suite #11309](https://github.com/jestjs/jest/issues/11309)
- [jest skip rest of tests in describe on failure #8387](https://github.com/jestjs/jest/issues/8387)
- [jest-retry-all-hooks package](https://github.com/wix-incubator/jest-retry-all-hooks)
- [jest-retry package (file-level)](https://github.com/bZichett/jest-retry)
- [@sbnc/jest-skip package](https://www.npmjs.com/package/@sbnc/jest-skip)
- [jest 30 blog post](https://jestjs.io/blog/2025/06/04/jest-30)
- [wealthfront: retry e2e suites with jest](https://eng.wealthfront.com/2022/04/21/retrying-e2e-test-suites-with-jest/)
- [dynamically skip tests within jest](https://blog.scottlogic.com/2023/09/19/dynamically-skipping-tests-within-jest.html)

### vitest
- [vitest test api reference](https://vitest.dev/api/)
- [vitest retry config](https://vitest.dev/config/retry)
- [vitest describe options syntax #5121](https://github.com/vitest-dev/vitest/issues/5121)
- [vitest isolated retry proposal #7834](https://github.com/vitest-dev/vitest/issues/7834)

### playwright (reference)
- [playwright test retries and serial mode](https://playwright.dev/docs/test-retries)
