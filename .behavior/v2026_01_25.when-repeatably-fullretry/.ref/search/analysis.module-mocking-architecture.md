# analysis: module mock architecture

## .what

analysis of what it would take to clone vitest's `vi.mock()` capability — particularly for use with playwright to achieve both serial retry AND module mock.

## .the problem

esm static imports resolve BEFORE any code runs:

```ts
import { sendEmail } from './emailService';  // already resolved

vi.mock('./emailService');  // too late — import already happened
```

to mock modules, you must intercept **before** import resolution.

## .how vitest/jest solve it

### the pipeline

```
source file
    ↓
[transform plugin] — detects vi.mock(), hoists to top of file
    ↓
[module registry] — tracks real vs mock modules
    ↓
[import interceptor] — checks registry, returns mock if found
    ↓
execution
```

### babel hoist (jest)

```ts
// what you write
import { dep } from './dependency';
jest.mock('./dependency');

// what babel transforms it to
jest.mock('./dependency');  // hoisted above import
import { dep } from './dependency';  // now intercepted
```

### vite transform (vitest)

vite's plugin system intercepts module requests and checks against the mock registry before it serves the real module. `vi.mock()` calls are detected and hoisted at transform time.

## .three approaches to build module mock

### approach 1: build-time transform

write a babel/vite/esbuild plugin that:
1. detects mock declarations (`mock('./path')`)
2. hoists them above imports
3. rewrites imports to check mock registry first

```ts
// plugin pseudocode
export const mockTransformPlugin = {
  transform(code, id) {
    const mockCalls = findMockCalls(code);
    const imports = findImports(code);

    // hoist mocks above imports
    const hoisted = mockCalls.map(m => `__registerMock__('${m.path}', ${m.factory})`);
    const rewritten = imports.map(i => rewriteToCheckRegistry(i));

    return [...hoisted, ...rewritten, restOfCode].join('\n');
  }
};
```

| pros | cons |
|------|------|
| works with any runner | must transform all files (test + source) |
| no runtime flags needed | complex to handle all import variants |
| battle-tested approach (jest/vitest) | build pipeline integration required |

### approach 2: node.js loader hooks

use `--experimental-loader` to intercept imports at runtime:

```ts
// mock-loader.mjs
const mocks = new Map();

export function resolve(specifier, context, nextResolve) {
  if (mocks.has(specifier)) {
    return { url: `mock://${specifier}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  if (url.startsWith('mock://')) {
    const mockPath = url.slice(7);
    return {
      format: 'module',
      source: mocks.get(mockPath),
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}

export function registerMock(path, factory) {
  mocks.set(path, factory);
}
```

run with:
```sh
node --experimental-loader ./mock-loader.mjs test.js
```

| pros | cons |
|------|------|
| no build step | experimental api — may change |
| works at runtime | requires cli flag |
| simpler than transform | some edge cases with node_modules |

### approach 3: vm module customization

create a custom vm context with mock-aware module resolution:

```ts
import { createContext, Module } from 'vm';

const context = createContext({});
const mockRegistry = new Map();

const linker = async (specifier, referencerModule) => {
  if (mockRegistry.has(specifier)) {
    return mockRegistry.get(specifier);
  }
  // load real module
  const source = await fs.readFile(resolve(specifier));
  return new Module(source, { context });
};

const testModule = new Module(testCode, { context });
await testModule.link(linker);
await testModule.evaluate();
```

| pros | cons |
|------|------|
| full control | high complexity |
| isolated contexts | performance overhead |
| no experimental flags | must manage entire module graph |

## .effort estimate

| phase | work | time |
|-------|------|------|
| understand esm/loader internals | node module resolution, import.meta, loaders | 1-2 weeks |
| build transform or loader | hoist detection, import rewrite, registry | 2-4 weeks |
| edge cases | circular deps, dynamic imports, re-exports, cjs interop | 2-4 weeks |
| integrate with playwright | config, api, errors, reporter | 1-2 weeks |
| stabilize | bugs, node versions, compat | 2-4 weeks |

**total: 2-4 months** for production quality

## .available alternatives

### esmock

loader-based mock for esm:

```ts
import esmock from 'esmock';

const { sendInvoice } = await esmock('./sendInvoice.js', {
  './emailService.js': {
    sendEmail: async () => ({ success: true }),
  },
});
```

run with:
```sh
node --experimental-loader esmock test.js
```

| aspect | status |
|--------|--------|
| playwright compatible | ✅ yes |
| api ergonomics | ⚠️ different from vi.mock (async, per-import) |
| stability | ⚠️ depends on experimental loader api |
| nested mocks | ✅ supported |

### testdouble + quibble

```ts
import * as td from 'testdouble';

td.replace('./emailService', {
  sendEmail: td.func(),
});

const { sendInvoice } = await import('./sendInvoice.js');
```

| aspect | status |
|--------|--------|
| playwright compatible | ✅ yes |
| api ergonomics | ⚠️ requires dynamic import after replace |
| stability | ✅ mature |
| esm support | ⚠️ via quibble loader |

### proxyquire (cjs only)

```ts
const proxyquire = require('proxyquire');

const sendInvoice = proxyquire('./sendInvoice', {
  './emailService': { sendEmail: () => ({ success: true }) },
});
```

| aspect | status |
|--------|--------|
| playwright compatible | ✅ yes (cjs only) |
| esm support | ❌ no |
| stability | ✅ mature, battle-tested |

## .comparison: available tools vs custom build

| capability | esmock | testdouble | custom build |
|------------|--------|------------|--------------|
| esm support | ✅ | ⚠️ via loader | ✅ |
| api like vi.mock | ❌ async only | ❌ different api | ✅ can match |
| no cli flags | ❌ needs loader | ❌ needs loader | ✅ if transform-based |
| maintenance burden | none | none | high |
| edge case support | good | good | must build |

## .the dependency injection alternative

instead of mock modules, structure code for injection:

```ts
// production code — accepts dependencies
export const sendInvoice = async (
  input: { invoice: Invoice },
  context: { emailService: EmailService },
) => {
  await context.emailService.send(input.invoice);
};

// test — inject fake
test('sends invoice', async () => {
  const emailServiceFake = { send: async () => ({ success: true }) };
  const result = await sendInvoice({ invoice }, { emailService: emailServiceFake });
  expect(result.sent).toBe(true);
});
```

| pros | cons |
|------|------|
| works with ANY test runner | requires code structure change |
| no magic, no loaders | more verbose production code |
| explicit dependencies | can't mock node_modules easily |
| trivially testable | retrofit effort for current code |

## .recommendation

### for test-fns users who need both serial retry AND mock

| option | effort | tradeoffs |
|--------|--------|-----------|
| use esmock with playwright | low | experimental loader flag, different api |
| use vitest for unit, playwright for serial | low | two test runners |
| restructure for dependency injection | medium | code changes, but future-proof |
| build custom mock system | high (2-4 months) | maintenance burden, reinvent wheel |

### decision matrix

| if your codebase... | then... |
|---------------------|---------|
| already uses DI | use playwright, no mock needed |
| has few mocks | use esmock with playwright |
| heavily relies on vi.mock/jest.mock | keep vitest/jest for those tests, playwright for serial flows |
| is greenfield | design for DI from the start |

### not recommended

build a custom `vi.mock()` clone unless:
- you have 2-4 months of dedicated effort
- available tools don't meet specific requirements
- you're prepared to maintain it long-term

## .verdict

**use available tools or dependency injection rather than build custom mock infrastructure.**

the module mock problem is solved — esmock, testdouble, and quibble all work with playwright. the api differs from `vi.mock()` but the capability exists.

for new code, dependency injection is the cleanest path — it works with any runner, requires no magic, and makes dependencies explicit.

## .references

- [esmock](https://github.com/iambumblehead/esmock) — loader-based esm mock
- [testdouble](https://github.com/testdouble/testdouble.js) — test double library with loader support
- [quibble](https://github.com/testdouble/quibble) — esm-aware module replacement
- [node.js loaders](https://nodejs.org/api/esm.html#loaders) — experimental loader hooks api
- [jest hoist](https://www.coolcomputerclub.com/posts/jest-hoist-await/) — how jest.mock hoist works
- [vite ssr](https://vitejs.dev/guide/ssr.html) — vite's module transform for ssr/test
- related brief: `reference.test-runner-architecture.md`
- related brief: `analysis.playwright-test-runner-performance.md`
