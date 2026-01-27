# reference: test runner architecture

## .what

a breakdown of what makes vitest faster than jest, the fundamental responsibilities of test runners, and what would be required to build a custom test runner.

## .why vitest is faster than jest

### the core insight: esbuild vs babel

jest transforms code via babel (javascript) → slow
vitest transforms code via esbuild (go native binary) → 10-100x faster

| component | jest | vitest |
|-----------|------|--------|
| code transform | babel (js) | esbuild (go binary) |
| module resolution | custom (jest-haste-map) | vite's native esm |
| typescript | ts-jest or babel | esbuild (native) |
| jsx | babel | esbuild (native) |
| bundler | webpack-like | native esm (no bundle in dev) |

### native esm vs synthetic esm

**jest**: wraps all code in commonjs, intercepts `require()` calls, maintains its own module cache. this allows powerful mock via `jest.mock()` hoist, but adds overhead.

**vitest**: uses native esm directly. vite serves files as-is via esm, transforms on-demand. no synthetic module system overhead.

```
jest flow:
  source.ts → babel transform → commonjs wrapper → jest module cache → execute

vitest flow:
  source.ts → esbuild transform → native esm import → execute
```

### hot module reload (hmr) in watch mode

**jest**: on file change, re-runs affected test files from scratch. must re-parse, re-transform, re-execute.

**vitest**: leverages vite's hmr. only changed modules are re-transformed. test state can be preserved. watch mode is 10-20x faster.

### worker strategy

both use worker threads/processes, but:

**jest**: spawns worker processes, each with full jest runtime overhead. workers must re-initialize jest-runtime, jest-environment, module registry.

**vitest**: workers share vite's transform cache. module transforms are cached and reused across workers.

## .real-world benchmarks

| scenario | jest | vitest | improvement |
|----------|------|--------|-------------|
| react component library | 18.7s | 1.8s | 10x |
| watch mode (single file change) | ~2-5s | ~100-500ms | 10-20x |
| typescript transform | baseline | 10-100x faster | esbuild |

**important caveat**: results vary by codebase. some benchmarks show jest faster for certain workloads. the gap narrows when jest is well-optimized and vitest hits edge cases.

## .fundamental test runner responsibilities

### 1. test discovery

find test files that match patterns (e.g., `*.test.ts`, `*.spec.js`).

| package (jest) | responsibility |
|----------------|----------------|
| `jest-haste-map` | scan filesystem, build dependency graph, cache results |
| `SearchSource` | find test files based on patterns and config |

**complexity**: must handle globs, ignore patterns, monorepo structures, and incremental updates (only scan changed files).

### 2. test sequence & schedule

decide order and parallelization strategy.

| package (jest) | responsibility |
|----------------|----------------|
| `TestSequencer` | order tests (failed first, slow first for cpu utilization) |
| `TestScheduler` | decide parallel vs serial, spawn workers |
| `jest-worker` | manage worker pool, distribute tests |

**complexity**: must balance parallelism with resource constraints, handle test dependencies (serial suites), optimize for total wall-clock time.

### 3. code transform

convert source code (ts, jsx, esm) to executable javascript.

| package (jest) | responsibility |
|----------------|----------------|
| `@babel/core` | transform ts/jsx/esm to commonjs |
| `ts-jest` | typescript-specific transforms |
| transform cache | avoid re-transform of unchanged files |

**complexity**: must handle all syntax variants, source maps for error traces, cache for performance.

### 4. module isolation & sandbox

each test file runs in isolated environment.

| package (jest) | responsibility |
|----------------|----------------|
| `jest-runtime` | create isolated module registry per test |
| `jest-environment` | provide global context (node, jsdom, etc.) |
| `node:vm` | base vm sandbox for isolation |

**complexity**: must reset globals between tests, prevent test pollution, handle async cleanup.

### 5. module mock

intercept and replace module imports.

| package (jest) | responsibility |
|----------------|----------------|
| `babel-plugin-jest-hoist` | hoist `jest.mock()` above imports |
| module registry | cache and swap mock implementations |

**how jest.mock works**:
1. babel plugin hoists `jest.mock('module')` to top of file
2. before any imports execute, mock is registered
3. when `import 'module'` runs, jest intercepts and returns mock
4. module registry tracks real vs mocked modules

**complexity**: esm makes this harder — static imports evaluate before any code runs. jest's approach requires babel transform. vitest uses different strategies (vi.mock with hoist, or factory functions).

### 6. test execution

actually run the test functions.

| package (jest) | responsibility |
|----------------|----------------|
| `jest-circus` | modern test runner, flux architecture |
| `jest-jasmine2` | legacy runner |
| lifecycle hooks | beforeAll, beforeEach, afterEach, afterAll |

**complexity**: must handle async tests, timeouts, retries, error capture, lifecycle hook order.

### 7. assertion & matchers

verify expected vs actual values.

| package (jest) | responsibility |
|----------------|----------------|
| `expect` | assertion api |
| matchers | toBe, toEqual, toMatchSnapshot, etc. |

**complexity**: deep equality, custom matchers, async matchers, helpful diff output.

### 8. snapshot capture

capture and compare output snapshots.

| package (jest) | responsibility |
|----------------|----------------|
| `jest-snapshot` | serialize values, compare to stored snapshots |
| pretty-format | consistent serialization |

**complexity**: deterministic serialization, inline vs file snapshots, update workflow.

### 9. result report

display results to user.

| package (jest) | responsibility |
|----------------|----------------|
| reporters | default, verbose, json, junit, etc. |
| `jest-message-util` | format stack traces with source maps |

**complexity**: real-time output stream, summary aggregation, ci integration, custom reporter api.

### 10. coverage

measure code coverage.

| package (jest) | responsibility |
|----------------|----------------|
| `istanbul` / `v8` | instrument code, collect coverage data |
| coverage reporters | html, lcov, text output |

**complexity**: source map integration, branch coverage, threshold enforcement.

## .architecture comparison

### jest architecture (50+ packages)

```
jest-cli
  ├── jest-config          (normalize configuration)
  ├── jest-haste-map       (file system scan, dependency graph)
  ├── SearchSource         (find test files)
  ├── TestSequencer        (order tests)
  ├── TestScheduler        (parallel vs serial)
  │   └── jest-worker      (worker pool)
  │       └── jest-runner  (per-worker test execution)
  │           ├── jest-runtime     (module isolation)
  │           ├── jest-environment (globals: node/jsdom)
  │           └── jest-circus      (test runner: describe/it/hooks)
  ├── expect               (assertions)
  ├── jest-snapshot        (snapshot capture)
  └── reporters            (output format)
```

### vitest architecture (built on vite)

```
vitest
  ├── vite                 (dev server, transforms, hmr)
  │   └── esbuild          (fast ts/jsx transform)
  ├── tinybench            (benchmark runner)
  ├── tinypool             (worker pool)
  ├── tinyspy              (spy/mock utilities)
  ├── @vitest/runner       (test execution)
  ├── @vitest/snapshot     (snapshot capture)
  ├── @vitest/expect       (chai-based assertions)
  └── @vitest/coverage-*   (coverage providers)
```

**key difference**: vitest delegates heavy work to vite. transform cache, hmr, module resolution all come "for free" from vite's architecture.

## .vitest runner api

vitest exposes a [runner api](https://vitest.dev/advanced/runner) for custom test execution:

```ts
import { VitestTestRunner } from 'vitest/runners'

class CustomRunner extends VitestTestRunner {
  onBeforeCollect(paths: string[]) { }
  onCollected(files: File[]) { }
  onBeforeRunFiles(files: File[]) { }
  onAfterRunFiles(files: File[]) { }

  // override to customize suite/test execution
  runSuite(suite: Suite) { }
  runTask(test: TaskPopulated) { }
}
```

configure via `vitest.config.ts`:
```ts
export default defineConfig({
  test: {
    runner: './my-custom-runner.ts',
  },
});
```

## .what it would take to build a custom test runner

### table stakes (must have)

| capability | complexity | prior art |
|------------|------------|-----------|
| test discovery | low | glob patterns, file system scan |
| test execution | medium | run functions, catch errors, measure time |
| assertions | low | chai, node:assert, custom matchers |
| lifecycle hooks | medium | beforeAll/Each, afterAll/Each order |
| async handle | medium | promises, timeouts, done callbacks |
| parallel execution | high | worker threads, process isolation |
| error format | medium | stack traces, source maps, diffs |
| result report | low-medium | console output, json, junit |

### differentiators (hard problems)

| capability | complexity | why it's hard |
|------------|------------|---------------|
| **module mock** | very high | requires intercept of esm imports before they execute; jest uses babel hoist; native esm makes this fundamentally difficult |
| **test isolation** | high | must reset global state, module caches, timers between tests without full process restart |
| **fast transforms** | high | ts/jsx transform speed is bottleneck; esbuild solved this with go binary |
| **watch mode** | high | incremental re-runs, affected test detection, hmr integration |
| **snapshot capture** | medium | deterministic serialization, update workflow, inline snapshots |
| **coverage** | medium | v8 or istanbul instrumentation, source map integration |

### the esm mock problem

native esm makes module mock fundamentally harder:

```ts
// with commonjs (jest)
jest.mock('./dependency');  // hoisted by babel
import { dep } from './dependency';  // gets mock

// with native esm
// static imports evaluate BEFORE any code runs
// jest.mock() can't execute before import
import { dep } from './dependency';  // already resolved
```

**solutions**:
1. **babel transform** (jest): rewrite imports to use mock registry
2. **loader hooks** (node:test, esmock): use `--experimental-loader` to intercept
3. **factory pattern** (vitest vi.mock): dynamic import with factory function
4. **dependency injection**: don't mock modules, inject dependencies

### minimum viable custom runner

to build a basic test runner:

```ts
// 1. discover tests
const testFiles = glob('**/*.test.ts');

// 2. for each file, collect tests
const tests = [];
global.describe = (name, fn) => { /* collect suite */ };
global.it = (name, fn) => { tests.push({ name, fn }); };
await import(testFile);

// 3. run tests with isolation
for (const test of tests) {
  try {
    await test.fn();
    console.log(`✓ ${test.name}`);
  } catch (error) {
    console.log(`✗ ${test.name}`);
    console.log(error);
  }
}

// 4. report results
console.log(`${passed}/${total} tests passed`);
```

**what this lacks**: parallel execution, proper isolation, mock, snapshots, coverage, watch mode, good error format, lifecycle hooks, timeouts, retries.

### build vs extend decision

| approach | pros | cons |
|----------|------|------|
| **extend vitest runner** | get transforms, isolation, mock for free; just customize execution | tied to vitest's architecture |
| **extend jest-circus** | mature, battle-tested; customize execution layer | tied to jest's slow transform pipeline |
| **build on node:test** | native, no dependencies; stable api | limited mock, no snapshots, basic report |
| **build from scratch** | full control | massive effort; years of edge cases |

**recommendation**: extend vitest runner api for custom suite-level retry semantics rather than build from scratch. vitest already solved the hard problems (transforms, isolation, mock).

## .references

### architecture
- [build a javascript test framework](https://cpojer.net/posts/building-a-javascript-testing-framework) — jest creator's guide
- [jest architecture](https://jestjs.io/docs/architecture) — official docs
- [jest architecture deep dive](https://www.techwithkunal.com/blog/jest-architecture)
- [vitest runner api](https://vitest.dev/advanced/runner)

### performance
- [vitest vs jest benchmarks](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/)
- [why vitest is faster discussion](https://github.com/vitest-dev/vitest/discussions/1635)
- [vite's core magic: esbuild and native esm](https://leapcell.io/blog/vite-s-core-magic-how-esbuild-and-native-esm-reinvent-frontend-development)

### mock
- [jest.mock hoist](https://www.coolcomputerclub.com/posts/jest-hoist-await/)
- [esm mock challenges](https://github.com/nodejs/help/issues/4298)
- [esmock package](https://www.npmjs.com/package/esmock)

### node.js native
- [node.js test runner docs](https://nodejs.org/api/test.html)
- [node.js mock in tests](https://nodejs.org/en/learn/test-runner/mocking)
