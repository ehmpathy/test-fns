# limitation: ESM thenable protocol breaks `then` exports

## .what

JavaScript's thenable protocol makes it **fundamentally impossible** to export a function named `then` from a module and have it accessible via dynamic imports. This is a language-level limitation, not a bug.

## .why

### the thenable protocol

JavaScript's Promise resolution algorithm checks if a value has a `.then` property that is a function. If so, it treats the object as "thenable" and calls `.then(resolve, reject)` expecting it to behave like a Promise.

```js
// Promise resolution procedure (Promises/A+ spec):
// 1. check if value is object or function
if (val && (typeof val === 'object' || typeof val === 'function')) {
  // 2. get the then property
  var then = val.then;
  // 3. if then is callable, treat as thenable
  if (typeof then === 'function') {
    then.call(val, resolve, reject);
  }
}
```

### the ESM dynamic import problem

when you use dynamic `import()`, it returns a Promise that resolves to the module namespace object. if the module exports a function named `then`, the Promise resolution algorithm sees it and calls it as a thenable:

```js
// this triggers thenable behavior
const module = await import('./myModule');
// internally: Promise.resolve(moduleNamespace)
// sees moduleNamespace.then is a function
// calls moduleNamespace.then(resolve, reject)
// our function expects (description, testFn), not (resolve, reject)
// our function doesn't call resolve(), so Promise hangs forever
```

### why vite/vitest transforms ALL imports to dynamic

vite transforms ALL static imports to `await __vite_ssr_import__()` internally for SSR/dev mode. this helper function uses native `await import()` under the hood.

from [dev.to article on vite internals](https://dev.to/jinjiang/understanding-how-vite-deals-with-your-nodemodules-3pdf):
> "All the imports in inlined resources are transformed into an `await __vite_ssr_import__()` function call... it turns the static imports into dynamic ones."

this means even when you write:
```ts
import { then } from 'test-fns'; // static import
```

vite internally converts it to:
```ts
const module = await __vite_ssr_import__('test-fns'); // dynamic import
const { then } = module;
```

the dynamic import triggers thenable detection, and `then` becomes inaccessible.

### why bypass attempts fail

we explored multiple bypass strategies:

1. **depth counter**: track thenable call depth and resolve without `then` on recursion
   - **result**: Promise resolves to object without `then` - user code can't access it

2. **proxy with access counter**: return `undefined` on first access, function on subsequent
   - **result**: vite checks multiple times; counter approach still results in hang or undefined

3. **microtask timing**: set flag after `Promise.resolve().then()` to detect post-init access
   - **result**: timing is unreliable; thenable detection happens at various points

4. **include `then` in safe exports**: resolve with object that includes `then: originalFunction`
   - **result**: Promise sees callable `then`, calls it as thenable, originalFunction doesn't call `resolve()`, Promise hangs forever

5. **getter that returns undefined initially**: use Object.defineProperty with getter
   - **result**: `typeof obj.then` still invokes the getter; if it returns function, thenable detected

the fundamental issue: **any callable `then` property triggers thenable detection**, and if the function doesn't call the provided `resolve` callback, the Promise hangs.

### MDN explicitly warns against this

from [MDN import() documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import):

> "Do not export a function called `then()` from a module. This will cause the module to behave differently when imported dynamically than when imported statically."

> "There remains no way to bypass this behavior with dynamic import() - all Promises are born equal. This makes it impossible to access any legitimate `then()` functions, making them only available when using static imports."

### vite/vitest teams confirmed this is unfixable

from [Vite issue #8673](https://github.com/vitejs/vite/issues/8673):
> "The Vite team doesn't think they are going to be able to fix this issue given the way Vite SSR works."

from [Vitest issue #1767](https://github.com/vitest-dev/vitest/issues/1767) (closed as "not planned"):
> "This is expected behavior. Native Node.js also doesn't finish import... This might've worked before in Jest because it uses require when loading modules."

the key insight: **Jest uses `require()` (synchronous CommonJS)** which doesn't involve Promise resolution. **Vitest uses `import()` (async ESM)** which triggers thenable detection.

### why CJS doesn't help

even if we ship a CJS build and configure vitest to prefer it, vitest's internal module loader still uses `await import()` to load the module. the CJS vs ESM distinction at the package.json level doesn't change how vitest loads the module internally.

### the only known browser workaround doesn't apply

[guessless.dev](https://guessless.dev/blog/stupidly-simple/dynamic-import-then) documents a browser-only workaround via script tag injection with static `import * as exports`. this works because:
1. it creates a `<script type="module">` dynamically
2. inside that script, it uses STATIC import (not dynamic)
3. static imports don't trigger thenable detection
4. it wraps exports in `{ exports }` before resolving

however, this requires DOM (`document.createElement`) and doesn't work in Node.js/vitest.

## .proven via test

see the vitest test files which prove both paths work:
- `givenWhenThen.vitest.bdd.test.ts` — uses `import { bdd }` without setup file
- `givenWhenThen.vitest.globals.test.ts` — uses globals via `vitest.setup.ts`

## .impact

| import style | jest | vitest |
|--------------|------|--------|
| `import { then }` | ✅ works | ❌ `then` is undefined |
| `import { bdd }` then `bdd.then()` | ✅ works | ✅ works |
| globals (`given`, `when`, `then`) | ✅ works | ✅ works (with setup) |

## .solution for test-fns

since we cannot change JavaScript's thenable protocol or Vite's architecture, we provide two workarounds:

### option 1: `bdd` namespace (recommended)

the module namespace has no top-level `then` property, so no thenable detection:

```ts
import { bdd } from 'test-fns';

bdd.given('some context', () => {
  bdd.when('some action', () => {
    bdd.then('expected result', () => {
      expect(result).toBe(expected);
    });
  });
});
```

### option 2: vitest globals

register `given`, `when`, `then` as globals via vitest setup file - no import needed:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
});

// vitest.setup.ts
import { given, when, then } from 'test-fns/setup';
globalThis.given = given;
globalThis.when = when;
globalThis.then = then;
```

then use without imports:
```ts
// no import needed - globals are injected
given('some context', () => {
  when('some action', () => {
    then('expected result', () => {
      expect(result).toBe(expected);
    });
  });
});
```

### jest users: direct import still works

jest uses synchronous `require()`, so direct imports work fine:

```ts
import { given, when, then } from 'test-fns';

given('some context', () => {
  when('some action', () => {
    then('expected result', () => {
      expect(result).toBe(expected);
    });
  });
});
```

## .references

- [MDN: import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
- [Promises/A+ specification](https://promisesaplus.com/)
- [Vite issue #8673](https://github.com/vitejs/vite/issues/8673) - vite team confirms unfixable
- [Vitest issue #1767](https://github.com/vitest-dev/vitest/issues/1767) - vitest team confirms expected behavior
- [Vitest issue #4291](https://github.com/vitest-dev/vitest/issues/4291) - duplicate, redirects to #1767
- [guessless.dev: dynamic import then](https://guessless.dev/blog/stupidly-simple/dynamic-import-then) - browser-only workaround
- [dev.to: how vite deals with node_modules](https://dev.to/jinjiang/understanding-how-vite-deals-with-your-nodemodules-3pdf) - explains vite's SSR transform
- local proof: `src/domain.operations/givenWhenThen.vitest.bdd.test.ts` and `src/domain.operations/givenWhenThen.ts`
