# future: vitest plugin for suite-level retry

## .what

a vitest plugin that implements "all-or-none" retry semantics for describe blocks — when any test fails, the entire suite re-runs from scratch (with `beforeAll`, all `useThen` operations, and all tests).

## .goal

match playwright's `describe.serial` behavior:
- tests run sequentially within the suite
- if any test fails, ALL subsequent tests are skipped
- on retry, the ENTIRE suite re-runs from the start
- `beforeAll`/`afterAll` re-run on each retry attempt

## .vitest runner api

vitest exposes a Runner API that allows custom test execution logic:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    runner: './my-custom-runner.ts',
  },
});
```

### key hooks

| hook | when it runs | what it receives |
|------|--------------|------------------|
| `onBeforeRunSuite` | before a describe block starts | suite object |
| `onAfterRunSuite` | after a describe block completes | suite object with results |
| `runSuite` | to execute a suite (override default) | suite, options |
| `onBeforeRunTask` | before each test | test object |
| `onAfterRunTask` | after each test | test object with result |

### suite object shape

```ts
interface Suite {
  id: string;
  name: string;
  mode: 'run' | 'skip' | 'only' | 'todo';
  tasks: (Test | Suite)[];  // nested tests and suites
  meta: Record<string, unknown>;  // custom metadata
  result?: {
    state: 'pass' | 'fail' | 'skip';
    duration: number;
    errors?: Error[];
  };
}
```

## .proposed api

### user-side api

```ts
import { describe } from 'vitest';

// option 1: extend describe with .serial
describe.serial('my suite', { retry: 3 }, () => {
  beforeAll(() => { /* re-runs on each retry */ });

  test('step 1', () => { ... });
  test('step 2', () => { ... });  // if this fails, retry from beforeAll
  test('step 3', () => { ... });
});

// option 2: use test-fns wrapper
import { given } from 'test-fns';

given.repeatably({ attempts: 3, criteria: 'SOME', mode: 'serial' })(
  'my scenario',
  () => {
    // entire block retries on failure
  }
);
```

### plugin implementation

```ts
// vitest-suite-retry-plugin.ts
import { createTaskCollector, VitestRunner } from 'vitest/suite';

interface SerialSuiteOptions {
  retry?: number;
}

export class SuiteRetryRunner extends VitestRunner {
  private serialSuites = new Map<string, SerialSuiteOptions>();

  // mark a suite as serial-retry
  markSerial(suiteId: string, options: SerialSuiteOptions) {
    this.serialSuites.set(suiteId, options);
  }

  async runSuite(suite: Suite): Promise<void> {
    const options = this.serialSuites.get(suite.id);

    // if not a serial suite, use default behavior
    if (!options) {
      return super.runSuite(suite);
    }

    const maxRetries = options.retry ?? 1;
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < maxRetries) {
      attempt++;

      // reset all test states for fresh run
      this.resetSuiteState(suite);

      try {
        // run beforeAll hooks
        await this.runBeforeAllHooks(suite);

        // run tests sequentially
        for (const task of suite.tasks) {
          if (task.type === 'test') {
            await this.runTest(task);

            // if test failed, stop and retry entire suite
            if (task.result?.state === 'fail') {
              lastError = task.result.errors?.[0];
              throw new SuiteRetryError('test failed, will retry suite');
            }
          } else if (task.type === 'suite') {
            // nested suite - recurse
            await this.runSuite(task);
          }
        }

        // all tests passed
        await this.runAfterAllHooks(suite);
        return;

      } catch (error) {
        if (error instanceof SuiteRetryError) {
          // run afterAll even on retry (cleanup)
          await this.runAfterAllHooks(suite);

          if (attempt < maxRetries) {
            console.log(`suite "${suite.name}" failed, retry ${attempt}/${maxRetries}`);
            continue;
          }
        }
        throw error;
      }
    }

    // all retries exhausted
    if (lastError) throw lastError;
  }

  private resetSuiteState(suite: Suite) {
    // clear all test results for fresh run
    for (const task of suite.tasks) {
      delete task.result;
      if (task.type === 'suite') {
        this.resetSuiteState(task);
      }
    }
  }

  private async runBeforeAllHooks(suite: Suite) {
    // vitest stores hooks in suite.hooks
    for (const hook of suite.hooks?.beforeAll ?? []) {
      await hook.fn();
    }
  }

  private async runAfterAllHooks(suite: Suite) {
    for (const hook of suite.hooks?.afterAll ?? []) {
      await hook.fn();
    }
  }
}

class SuiteRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuiteRetryError';
  }
}
```

## .challenges

### 1. hook state isolation

`beforeAll` may create resources that `afterAll` expects to clean up. on retry:
- must run `afterAll` before retry (cleanup previous attempt)
- must run `beforeAll` fresh (setup new attempt)
- any closure state from previous attempt must be reset

```ts
// problem: closure captures stale state
let connection: DbConnection;
beforeAll(async () => {
  connection = await createConnection();  // attempt 1
});

test('uses connection', () => {
  // on retry, connection still points to attempt 1's connection
  // but beforeAll re-ran and created a NEW connection
});
```

**solution**: use `useBeforeAll` pattern that resets the proxy on each attempt

### 2. useThen integration

`useThen` creates a test that caches its result. on suite retry:
- the cached result must be cleared
- the `useThen` test must re-run
- dependent tests must use the new result

```ts
// plugin must detect useThen tests and clear their cache
private resetSuiteState(suite: Suite) {
  for (const task of suite.tasks) {
    delete task.result;

    // clear useThen cache if present
    if (task.meta?.useThenProxy) {
      task.meta.useThenProxy.__reset();
    }
  }
}
```

### 3. test isolation vs serial execution

vitest runs tests in parallel by default. serial suites must:
- force sequential execution within the suite
- not affect parallel execution of other suites
- handle nested serial suites correctly

### 4. reporter integration

vitest reporters expect standard test lifecycle events. the plugin must:
- emit correct events for each retry attempt
- show which attempt succeeded/failed
- aggregate retry attempts in final output

## .implementation path

### phase 1: proof of concept
1. create custom runner that overrides `runSuite`
2. implement basic retry loop for marked suites
3. validate with simple test cases

### phase 2: integration
1. integrate with `useBeforeAll`/`useThen` cache reset
2. handle nested suites
3. add reporter events for retry attempts

### phase 3: api polish
1. create `describe.serial` wrapper
2. integrate with test-fns `given.repeatably`
3. document usage and limitations

## .alternative: test file re-execution

instead of custom runner, re-execute the entire test file:

```ts
// simpler but coarser-grained
const runWithRetry = async (testFile: string, maxRetries: number) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await vitest.runFiles([testFile]);
    if (result.success) return result;
  }
  throw new Error('all retries exhausted');
};
```

pros:
- simpler implementation
- guaranteed fresh state

cons:
- retries entire file, not just the failed suite
- slower (full file parse + setup)
- less granular control

## .verdict: can we build this?

**partially yes, but with significant gaps.**

### what we CAN do with a custom runner

| capability | feasibility |
|------------|-------------|
| sequential execution within suite | ✅ yes |
| skip subsequent tests on failure | ✅ yes |
| retry loop around suite execution | ✅ yes |
| clear test result state | ✅ yes |
| emit retry attempt events | ✅ yes |

### what we CANNOT do (vitest core limitations)

| capability | feasibility | why |
|------------|-------------|-----|
| re-run `beforeAll` hooks | ❌ no | hooks managed internally, not exposed to runner |
| reset module-level state | ❌ no | would require re-import of test file |
| spawn fresh worker on retry | ❌ no | pool management outside runner scope |
| clear closure variables | ❌ no | no access to closure scope |
| re-run passed tests with fresh state | ⚠️ partial | can reset result, but state persists |

### the fundamental blocker

```
┌─────────────────────────────────────────────────────┐
│  vitest architecture assumption:                    │
│  "one worker = one module instance = one run"       │
│                                                     │
│  playwright architecture:                           │
│  "fresh worker per retry = fresh module state"      │
│                                                     │
│  to achieve playwright parity, vitest would need:   │
│  - issue #7834: --retry-isolated (spawn fresh       │
│    worker on retry)                                 │
│  - or: module re-import mechanism                   │
│  - or: beforeAll re-execution hook                  │
└─────────────────────────────────────────────────────┘
```

### practical impact

a custom runner can achieve **skip-on-failure** behavior:

```
test A → PASS
test B → FAIL
test C → SKIPPED (due to B failure)
```

but cannot achieve **re-run-all-on-retry** behavior:

```
attempt 1:
  test A → PASS (result cached, state persists)
  test B → FAIL

attempt 2 (what we want but can't do):
  beforeAll → re-run (NOT POSSIBLE)
  test A → re-run with fresh state (NOT POSSIBLE - state persists)
  test B → re-run
```

## .recommendation

### for test-fns

1. **document the limitation** clearly in `limitation.describe-block-retry-semantics.md`

2. **implement skip-on-failure** via custom runner as partial solution:
   - sequential execution
   - skip subsequent tests when one fails
   - useful even without full retry

3. **recommend workarounds** for users who need full serial retry:
   - `criteria: 'EVERY'` creates N separate suites, each runs fresh
   - single-test wrapper pattern (all logic in one retryable test)
   - playwright for critical serial flows

4. **monitor vitest #7834** for `--retry-isolated` support

### timeline estimate

| phase | effort | outcome |
|-------|--------|---------|
| skip-on-failure runner | 1-2 days | partial solution |
| useThen cache reset | 1 day | improved isolation |
| full serial retry | blocked | requires vitest core changes |

## .references

- [vitest runner api](https://vitest.dev/advanced/runner.html)
- [vitest task types](https://vitest.dev/advanced/api.html#tasks)
- [vitest custom pool api](https://vitest.dev/advanced/pool.html)
- [vitest #7834 - retry in clean environment](https://github.com/vitest-dev/vitest/issues/7834)
- [playwright serial mode](https://playwright.dev/docs/test-retries#serial-mode)
- related brief: `limitation.describe-block-retry-semantics.md`
- related brief: `limitation.vitest-serial-retry-gap.md`
- related brief: `analysis.useThen-retry-semantics.md`
