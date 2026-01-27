# analysis: playwright test runner performance for unit tests

## .what

analysis of whether playwright's test runner (`@playwright/test`) would cause significant performance degradation compared to jest/vitest for pure node.js unit/integration tests (no browser).

## .the question

could we switch to playwright as our test runner to get native `describe.serial` retry semantics without a major performance hit?

## .key findings

### playwright team confirms: it works for unit tests

from [github issue #14268](https://github.com/microsoft/playwright/issues/14268):

> "Yes, Playwright Test is also a very generic test-runner, we use it to test various 'non end-to-end Playwright' targets with it."
> — Max Schmitt, Playwright team

when not used with browser fixtures, playwright doesn't initialize browsers. the test runner itself is a general-purpose runner.

### no browser = no browser overhead

from community discussion:

> "when not used with browser fixtures, Playwright doesn't initialize them, which enables faster unit test execution comparable to traditional test runners."

this means pure node.js tests would not pay the browser startup cost.

## .performance comparison

### vitest vs jest benchmarks

| metric | jest | vitest | winner |
|--------|------|--------|--------|
| watch mode startup | 8.2s | 0.3s | vitest (27x faster) |
| watch mode feedback loop | 3.8s | 0.2s | vitest (19x faster) |
| full suite (threads enabled) | 34.7s | 99s | jest (2.8x faster) |
| full suite (real-world spa) | ~equal | ~equal | tie |
| typescript transform | slow (babel) | fast (esbuild) | vitest (10-100x faster) |

sources: [betterstack](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/), [dev.to benchmark](https://dev.to/thejaredwilcurt/vitest-vs-jest-benchmarks-on-a-5-year-old-real-work-spa-4mf1)

### playwright vs jest/vitest (estimated)

no direct benchmarks exist for playwright that runs pure node.js tests. based on architecture analysis:

| aspect | playwright | jest | vitest |
|--------|------------|------|--------|
| startup overhead | low (no browser if no fixtures) | medium | very low |
| typescript support | native | requires ts-jest/babel | native (esbuild) |
| parallel execution | native (multi-worker) | native (worker pool) | native (tinypool) |
| transform speed | unknown (needs test) | slow (babel) | fast (esbuild) |
| watch mode | experimental | mature | very fast (hmr) |

**estimated impact**: playwright without browser fixtures should be comparable to jest, but likely slower than vitest due to vitest's esbuild transform pipeline.

## .playwright advantages

from [patricktree.me](https://patricktree.me/blog/using-playwright-to-run-unit-tests):

1. **serial retry is native** — `describe.serial` spawns fresh worker on retry
2. **typescript out of box** — no babel/ts-jest configuration needed
3. **fixtures system** — better than beforeEach/afterEach patterns
4. **projects** — run same tests across multiple configurations
5. **no globals** — avoids typescript conflicts with other test libs
6. **unified tool** — same runner for e2e and unit tests

## .playwright limitations

from [patricktree.me](https://patricktree.me/blog/using-playwright-to-run-unit-tests):

| feature | playwright | workaround |
|---------|------------|------------|
| module mock | ❌ not supported | use dependency injection |
| fake timers | ❌ not built-in | use sinon |
| code coverage | ❌ not built-in | use nyc + source-map-support |
| spies | ❌ not built-in | use sinon or jest-mock |
| watch mode | ⚠️ experimental | — |

> "module mock limitation is the biggest downside"

this is significant for test-fns users who rely on `jest.mock()` or `vi.mock()`.

## .startup time concerns

from [github issue #37290](https://github.com/microsoft/playwright/issues/37290):

some users reported 10-20 second startup delays on windows. root cause: antivirus file scan, not playwright itself. workaround: add node.js to antivirus exceptions.

playwright core startup (without browser) should be fast on properly configured systems.

## .verdict

### would playwright cause significant performance degradation?

**for pure node.js tests without browser: probably not significant.**

| scenario | expected impact |
|----------|-----------------|
| vs jest | comparable or slightly slower |
| vs vitest | likely slower (vitest has esbuild advantage) |
| startup time | comparable to jest, slower than vitest |
| watch mode | slower than vitest (vitest has hmr) |
| parallel execution | comparable (all three parallelize well) |

### the real tradeoffs

| gain | lose |
|------|------|
| native `describe.serial` retry | module mock (`jest.mock`, `vi.mock`) |
| fresh worker on suite retry | fake timers (need sinon) |
| unified e2e + unit runner | mature watch mode |
| fixtures system | code coverage built-in |
| typescript out of box | — |

## .recommendation

### for test-fns specifically

**don't switch to playwright as default runner.** reasons:

1. **module mock is critical** — many test-fns users rely on `jest.mock()` / `vi.mock()`
2. **vitest is faster** — esbuild transform + hmr gives vitest a clear speed advantage
3. **serial retry is niche** — most users don't need playwright's serial semantics

### for users who need serial retry

recommend playwright as an **optional path**, not a replacement:

```ts
// for tests that truly need serial retry semantics
// use playwright in a separate test file

// checkout.serial.spec.ts (playwright)
import { test, expect } from '@playwright/test';

test.describe.serial('checkout flow', () => {
  test.describe.configure({ retries: 2 });

  test('add to cart', async () => { /* ... */ });
  test('enter payment', async () => { /* ... */ });
  test('confirm order', async () => { /* ... */ });
});
```

### performance-critical projects

if a switch to playwright is considered:

1. **expect ~10-20% slowdown** compared to vitest for large suites
2. **expect comparable speed** to jest
3. **watch mode will be slower** than vitest
4. **typescript transform** speed is unknown (needs benchmarks)

### recommended test strategy

from [nucamp analysis](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies):

> "Test strategy in 2026 works best as a layered approach: pick Jest for legacy/enterprise or Vitest for Vite/ESM projects, use React Test Library for user-focused component tests, and keep a small Playwright or Cypress suite for 3-5 critical E2E flows wired into CI."

**translation for test-fns**:
- use vitest/jest for unit + integration tests (fast, has mock)
- use playwright only for tests that require serial retry (small subset)
- document the tradeoff clearly for users

## .what we'd need to validate

before a playwright migration is recommended:

1. **benchmark pure node.js tests** — run same test suite on vitest, jest, and playwright
2. **measure startup time** — cold start and watch mode restart
3. **test module mock alternatives** — validate dependency injection patterns work
4. **evaluate watch mode** — is experimental watch mode usable?

## .references

- [playwright github issue #14268](https://github.com/microsoft/playwright/issues/14268) — unit test discussion
- [patricktree.me](https://patricktree.me/blog/using-playwright-to-run-unit-tests) — playwright for unit tests guide
- [betterstack vitest vs jest](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/) — performance benchmarks
- [dev.to benchmark](https://dev.to/thejaredwilcurt/vitest-vs-jest-benchmarks-on-a-5-year-old-real-work-spa-4mf1) — real-world spa comparison
- [headspin playwright vs jest](https://www.headspin.io/blog/playwright-vs-jest-which-framework-to-consider) — framework comparison
- [nucamp test strategy 2026](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies) — test strategy guide
