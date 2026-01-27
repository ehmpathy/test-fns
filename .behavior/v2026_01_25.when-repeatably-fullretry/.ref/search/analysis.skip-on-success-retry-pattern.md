# analysis: skip-on-success retry pattern

## .what

analysis of whether test-fns can implement "skip subsequent attempts if first succeeds" for `criteria: 'SOME'` semantics on `given.repeatably` and `when.repeatably`.

## .the goal

when `criteria: 'SOME'` is used on a describe block:
- run attempt 1
- if all tests pass → skip attempts 2, 3, ...
- if any test fails → run attempt 2
- repeat until one attempt fully succeeds or attempts exhausted

this differs from test-level retry where each test retries independently.

## .findings

### vitest: dynamic skip is supported

#### approach 1: `context.skip()` in beforeEach

vitest 3.1+ supports conditional skip via test context:

```ts
let attemptSucceeded = false;

describe('my suite, attempt 1', () => {
  afterAll(() => {
    if (/* all tests passed */) attemptSucceeded = true;
  });

  test('step 1', () => { ... });
  test('step 2', () => { ... });
});

describe('my suite, attempt 2', () => {
  beforeEach((context) => {
    if (attemptSucceeded) context.skip();
  });

  test('step 1', () => { ... });
  test('step 2', () => { ... });
});
```

vitest maintainer recommends this pattern:
> "you can skip inside `beforeEach` via `t.skip()` since this is a test option (so it can be skipped)."
> — sheremet-va, vitest maintainer

#### approach 2: custom runner with `onBeforeRunTask`

```ts
// custom-runner.ts
import { VitestTestRunner, type RunnerTask } from 'vitest/suite';

const successfulAttempts = new Set<string>();

export default class SkipOnSuccessRunner extends VitestTestRunner {
  override async onBeforeRunTask(test: RunnerTask) {
    const attemptKey = extractAttemptKey(test.name);
    if (successfulAttempts.has(attemptKey)) {
      test.mode = 'skip';
    }
    super.onBeforeRunTask(test);
  }

  override async onAfterRunSuite(suite) {
    if (suite.result?.state === 'pass') {
      const attemptKey = extractAttemptKey(suite.name);
      successfulAttempts.add(attemptKey);
    }
    super.onAfterRunSuite(suite);
  }
}
```

configure via `vitest.config.ts`:
```ts
export default defineConfig({
  test: {
    runner: './custom-runner.ts',
  },
});
```

### jest: dynamic skip via custom environment

jest-circus allows dynamic skip via `handleTestEvent`:

```ts
// CustomEnvironment.ts
const NodeEnvironment = require('jest-environment-node');

class SkipOnSuccessEnvironment extends NodeEnvironment {
  private successfulAttempts = new Set();

  async handleTestEvent(event) {
    if (event.name === 'test_start') {
      const attemptKey = extractAttemptKey(event.test.name);
      if (this.successfulAttempts.has(attemptKey)) {
        event.test.mode = 'skip';
      }
    }

    if (event.name === 'run_describe_finish') {
      const allPassed = event.describeBlock.children.every(
        child => child.status === 'passed' || child.mode === 'skip'
      );
      if (allPassed) {
        const attemptKey = extractAttemptKey(event.describeBlock.name);
        this.successfulAttempts.add(attemptKey);
      }
    }
  }
}

module.exports = SkipOnSuccessEnvironment;
```

configure via `jest.config.js`:
```js
module.exports = {
  testEnvironment: './CustomEnvironment.ts',
};
```

**caution**: jest documentation notes:
> "to mutate event or state data is currently unsupported and may cause unexpected behavior"

the `@sbnc/jest-skip` package uses this pattern and works, but it's not officially supported.

### module-level state

both vitest and jest share module-level variables within a test file:

```ts
// state persists between describe blocks in the same file
let attemptSucceeded = false;

describe('attempt 1', () => {
  afterAll(() => { attemptSucceeded = true; });
  test('...', () => {});
});

describe('attempt 2', () => {
  beforeAll(() => {
    if (attemptSucceeded) {
      // can use this to skip
    }
  });
  test('...', () => {});
});
```

this enables success state track without plugins.

## .implementation for test-fns

### option 1: wrapper-level skip (no plugin required)

test-fns can implement skip-on-success without framework plugins:

```ts
export const given = {
  repeatably: (config: RepeatableConfig) => (desc: string, fn: () => void) => {
    const { attempts, criteria } = config;

    if (criteria === 'SOME') {
      // shared state across attempts
      let attemptSucceeded = false;

      for (let i = 1; i <= attempts; i++) {
        describe(`${desc}, attempt ${i}`, () => {
          beforeAll(() => {
            // vitest: can't skip in beforeAll, but can track
            // jest: can set mode in custom env
          });

          beforeEach((context) => {
            // vitest 3.1+: skip via context
            if (attemptSucceeded && 'skip' in context) {
              context.skip();
            }
          });

          afterAll(() => {
            // check if all tests in this attempt passed
            // if so, set attemptSucceeded = true
          });

          fn();
        });
      }
    }
  },
};
```

### option 2: custom vitest runner (full control)

for deeper integration, ship a custom runner with test-fns:

```ts
// test-fns-runner.ts
export default class TestFnsRunner extends VitestTestRunner {
  private attemptResults = new Map<string, 'queued' | 'passed' | 'failed'>();

  override async onBeforeRunTask(test: RunnerTask) {
    const meta = extractTestFnsMeta(test);
    if (meta?.isSomeAttempt && this.shouldSkip(meta)) {
      test.mode = 'skip';
    }
    super.onBeforeRunTask(test);
  }

  private shouldSkip(meta: TestFnsMeta): boolean {
    // skip if a prior attempt of this suite already passed
    const priorAttemptKey = `${meta.suiteId}:${meta.attemptNumber - 1}`;
    return this.attemptResults.get(priorAttemptKey) === 'passed';
  }
}
```

users would configure:
```ts
// vitest.config.ts
export default defineConfig({
  test: {
    runner: 'test-fns/runner',
  },
});
```

## .limitations

### what this pattern CAN do

| capability | vitest | jest |
|------------|--------|------|
| skip entire attempt if prior succeeded | ✅ | ✅ |
| track success via module-level state | ✅ | ✅ |
| skip via `beforeEach` + `context.skip()` | ✅ (3.1+) | ❌ |
| skip via custom runner/environment | ✅ | ⚠️ unsupported |

### what this pattern CANNOT do

| limitation | reason |
|------------|--------|
| re-run `beforeAll` on retry | `beforeAll` runs once per describe, period |
| reset `useThen` cache on retry | cache is in closure, no external reset |
| spawn fresh worker on retry | pool management outside runner scope |
| reset module-level closure state | would require re-import of test file |

### the fundamental constraint remains

```
┌─────────────────────────────────────────────────────┐
│  skip-on-success enables:                           │
│    ✅ skip subsequent attempts if prior passed      │
│                                                     │
│  skip-on-success does NOT enable:                   │
│    ❌ re-run passed tests within failed attempt     │
│    ❌ re-run beforeAll/useThen on retry             │
│    ❌ fresh state for each attempt                  │
└─────────────────────────────────────────────────────┘
```

this is still NOT playwright's `describe.serial` behavior. playwright spawns fresh workers; vitest/jest reuse module state.

## .practical value

despite limitations, skip-on-success provides value:

| without skip-on-success | with skip-on-success |
|-------------------------|----------------------|
| all 3 attempts run | only run until success |
| wastes resources on success | efficient — stops early |
| 3x test execution time | 1x if first attempt passes |

for `criteria: 'SOME'` on describe blocks where the goal is "at least one attempt must pass", this is sufficient.

## .recommendation

### for test-fns implementation

1. **implement wrapper-level skip** (no plugin required):
   - use module-level `attemptSucceeded` flag
   - vitest: skip via `beforeEach` + `context.skip()`
   - jest: document limitation or provide custom environment

2. **optional: ship custom vitest runner**:
   - deeper integration, cleaner skip behavior
   - users must configure in `vitest.config.ts`

3. **document clearly**:
   - skip-on-success ≠ playwright's serial retry
   - `useThen`/`useBeforeAll` do NOT re-run on subsequent attempts
   - for true fresh-state retry, use `criteria: 'EVERY'`

### timeline estimate

| phase | effort |
|-------|--------|
| wrapper-level skip (vitest) | 1-2 days |
| wrapper-level skip (jest) | 1-2 days |
| custom vitest runner | 2-3 days |
| documentation | 1 day |

**total: 3-6 days** for production quality skip-on-success

## .verdict

**yes, skip-on-success is doable** via both test-fns wrappers and framework plugins.

it provides meaningful value for `criteria: 'SOME'`:
- stops execution after first successful attempt
- reduces test runtime when first attempt passes
- no framework plugins required for basic implementation

it does NOT provide playwright parity:
- no fresh worker state per attempt
- no re-run of passed tests within failed attempt
- `beforeAll`/`useThen` still run once only

for users who need "stop on first success" without full serial retry semantics, this is the practical solution.

## .references

- [vitest test context skip](https://vitest.dev/api/#context-skip)
- [vitest custom runner api](https://vitest.dev/advanced/runner.html)
- [vitest dynamic skip discussion](https://github.com/vitest-dev/vitest/discussions/6809)
- [jest handleTestEvent](https://jestjs.io/docs/configuration#testenvironment-string)
- [dynamically skip tests in jest](https://blog.scottlogic.com/2023/09/19/dynamically-skipping-tests-within-jest.html)
- [@sbnc/jest-skip package](https://www.npmjs.com/package/@sbnc/jest-skip)
- related brief: `limitation.describe-block-retry-semantics.md`
- related brief: `limitation.vitest-serial-retry-gap.md`
