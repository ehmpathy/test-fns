# design: repeatably criteria semantics

## .what

defines the behavior of `criteria: 'EVERY'` vs `criteria: 'SOME'` for `given.repeatably` and `when.repeatably`.

## .the model

both `EVERY` and `SOME` instantiate N separate describe blocks. the difference is when execution stops.

```
EVERY: run all N attempts, report all results
SOME:  run until first success, skip rest
```

## .execution flow

### criteria: 'EVERY'

```ts
when.repeatably({ attempts: 3, criteria: 'EVERY' })('event', () => {
  const result = useThen('operation', async () => doTask());
  then('assertion', () => expect(result.value).toBe(42));
});
```

creates:
```
when "event, attempt 1":
  useThen "operation"  → runs fresh
  then "assertion"     → runs
when "event, attempt 2":
  useThen "operation"  → runs fresh
  then "assertion"     → runs
when "event, attempt 3":
  useThen "operation"  → runs fresh
  then "assertion"     → runs
```

**all 3 attempts run regardless of pass/fail.**

### criteria: 'SOME'

```ts
when.repeatably({ attempts: 3, criteria: 'SOME' })('event', () => {
  const result = useThen('operation', async () => doTask());
  then('assertion', () => expect(result.value).toBe(42));
});
```

creates:
```
when "event, attempt 1":
  useThen "operation"  → runs fresh
  then "assertion"     → FAIL
when "event, attempt 2":
  useThen "operation"  → runs fresh
  then "assertion"     → PASS ✓
when "event, attempt 3":
  useThen "operation"  → SKIPPED (prior attempt succeeded)
  then "assertion"     → SKIPPED
```

**stops after first successful attempt.**

## .key insight

both criteria use the same instantiation pattern:
- N separate describe blocks
- each block gets fresh `useThen`/`useBeforeAll` execution
- each block is isolated from others

the only difference:
- `EVERY`: always runs all N blocks
- `SOME`: skips rest after first success

## .implementation

### shared pattern

```ts
const repeatably = (config: { attempts: number; criteria: 'EVERY' | 'SOME' }) =>
  (desc: string, fn: DescribeFn) => {
    // track success for SOME criteria
    let attemptSucceeded = false;

    for (let i = 1; i <= config.attempts; i++) {
      describe(`${desc}, attempt ${i}`, () => {
        // skip if prior attempt succeeded (SOME only)
        beforeEach((context) => {
          if (config.criteria === 'SOME' && attemptSucceeded) {
            context.skip();
          }
        });

        // mark success after all tests pass
        afterAll(() => {
          // if all tests in this describe passed, mark success
          attemptSucceeded = true;
        });

        fn({ getAttempt: () => i });
      });
    }
  };
```

### vitest: skip via context.skip()

```ts
beforeEach((context) => {
  if (attemptSucceeded) context.skip();
});
```

### jest: skip via custom environment

```ts
// CustomEnvironment.ts
handleTestEvent(event) {
  if (event.name === 'test_start' && attemptSucceeded) {
    event.test.mode = 'skip';
  }
}
```

## .comparison

| aspect | EVERY | SOME |
|--------|-------|------|
| instantiates N blocks | ✅ | ✅ |
| each block has fresh state | ✅ | ✅ |
| `useThen` re-runs per block | ✅ | ✅ |
| `useBeforeAll` re-runs per block | ✅ | ✅ |
| runs all N blocks | ✅ always | ❌ stops on success |
| skips after success | ❌ never | ✅ yes |
| use case | "verify works N times" | "retry until works" |

## .what this achieves

### fresh state per attempt

because each attempt is a separate describe block:
- `useBeforeAll` runs fresh for each attempt
- `useThen` runs fresh for each attempt
- module-level closures are fresh per block setup

this solves the limitation where test-level retry reuses stale `useThen` cache.

### stop-on-success efficiency

for `SOME`, we don't waste resources on attempts 2 and 3 if attempt 1 succeeds.

### clear test output

```
✓ when "event, attempt 1" (3 tests)
○ when "event, attempt 2" (skipped - prior attempt succeeded)
○ when "event, attempt 3" (skipped - prior attempt succeeded)
```

## .what this does NOT achieve

| limitation | reason |
|------------|--------|
| playwright's serial retry | playwright re-runs passed tests within failed attempt |
| mid-attempt fresh state | if test 2 of 3 fails, tests 1 and 3 don't re-run in same attempt |

for most use cases, this is sufficient. playwright's behavior is only needed for tightly coupled serial flows.

## .summary

```
┌─────────────────────────────────────────────────────┐
│  EVERY: N blocks, all run                           │
│  SOME:  N blocks, stop after first success          │
│                                                     │
│  both patterns:                                     │
│    ✅ fresh useThen per attempt                     │
│    ✅ fresh useBeforeAll per attempt                │
│    ✅ isolated state per attempt                    │
└─────────────────────────────────────────────────────┘
```

## .references

- related brief: `analysis.skip-on-success-retry-pattern.md`
- related brief: `limitation.describe-block-retry-semantics.md`
- related brief: `analysis.useThen-retry-semantics.md`
