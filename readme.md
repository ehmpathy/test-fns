# test-fns

![ci_on_commit](https://github.com/ehmpathy/test-fns/workflows/ci_on_commit/badge.svg)
![deploy_on_tag](https://github.com/ehmpathy/test-fns/workflows/deploy_on_tag/badge.svg)

write usecase driven tests systematically for simpler, safer, and more readable code

# purpose

establishes a pattern to write tests for simpler, safer, and more readable code.

by tests defined in terms of usecases (`given`, `when`, `then`) your tests are
- simpler to write
- easier to read
- safer to trust

# install

```sh
npm install --save-dev test-fns
```

# pattern

`given/when/then` is based on [behavior driven design (BDD)](https://en.wikipedia.org/wiki/Behavior-driven_development). it structures tests around:
- **given** a `scene` (the initial state or context)
- **when** an `event` occurs (the action or trigger)
- **then** an `effect` is observed (the expected outcome)

```ts
given('scene', () =>
  when('event', () =>
    then('effect', () => {
      // assertion
    })
  )
);
```

# use

### jest

```ts
import { given, when, then } from 'test-fns';

describe('doesPlantNeedWater', () => {
  given('a dry plant', () => {
    const plant = { id: 7, hydration: 'DRY' };

    when('water needs are checked', () => {
      then('it should return true', () => {
        expect(doesPlantNeedWater(plant)).toEqual(true);
      });
    });
  });
});
```

### vitest

vitest requires a workaround because ESM's thenable protocol prevents direct `then` imports.

**option 1: globals via setup file (recommended)**

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['test-fns/vitest.setup'],
  },
});

// your test file - no imports needed
describe('doesPlantNeedWater', () => {
  given('a dry plant', () => {
    const plant = { id: 7, hydration: 'DRY' };

    when('water needs are checked', () => {
      then('it should return true', () => {
        expect(doesPlantNeedWater(plant)).toEqual(true);
      });
    });
  });
});
```

**option 2: bdd namespace**

```ts
import { bdd } from 'test-fns';

describe('doesPlantNeedWater', () => {
  bdd.given('a dry plant', () => {
    const plant = { id: 7, hydration: 'DRY' };

    bdd.when('water needs are checked', () => {
      bdd.then('it should return true', () => {
        expect(doesPlantNeedWater(plant)).toEqual(true);
      });
    });
  });
});
```

### output

both produce:

```sh
 PASS  src/plant.test.ts
  doesPlantNeedWater
    given: a dry plant
      when: water needs are checked
        ✓ then: it should return true (1 ms)
```

# features

### .runIf(condition) && .skipIf(condition)

skip the suite if the condition is not met

```ts
describe('your test', () => {
  given.runIf(onLocalMachine)('some test that should only run locally', () => {
    then.skipIf(onProduction)('some test that should not run against production', () => {
      expect(onProduction).toBeFalse()
    })
  })
})
```

### .repeatably(config)

run a block multiple times to evaluate repeatability. available on `given`, `when`, and `then`.

**`then.repeatably`** — run a test multiple times with environment-aware criteria

```ts
then.repeatably({
  attempts: 3,
  criteria: process.env.CI ? 'SOME' : 'EVERY',
})('it should produce consistent results', ({ attempt }) => {
  const result = generateOutput();
  expect(result).toMatchSnapshot();
});
```

- `attempts`: how many times to run the test
- `criteria`:
  - `'EVERY'`: all attempts must pass (strict, for local development)
  - `'SOME'`: at least one attempt must pass (tolerant, for CI)

**`when.repeatably`** — run the when block multiple times

```ts
given('a probabilistic llm system', () => {
  when.repeatably({
    attempts: 3,
    criteria: 'SOME', // pass if any attempt succeeds
  })('the llm generates a response', ({ attempt }) => {
    then('it should produce valid json', () => {
      const result = generateResponse();
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });
});
```

**`given.repeatably`** — run the given block multiple times

```ts
given.repeatably({
  attempts: 3,
  criteria: 'EVERY', // all attempts must pass (default)
})('different initial states', ({ attempt }) => {
  const state = setupState(attempt);

  when('the system processes the state', () => {
    then('it should handle all variations', () => {
      expect(process(state)).toBeDefined();
    });
  });
});
```

all `repeatably` variants:
- provide an `{ attempt }` parameter (starts at 1) to the callback
- support `criteria: 'EVERY' | 'SOME'` (defaults to `'EVERY'`)
  - `'EVERY'`: all attempts must pass
  - `'SOME'`: at least one attempt must pass (useful for probabilistic tests)

**full block retry with `criteria: 'SOME'`**

when `given.repeatably` or `when.repeatably` uses `criteria: 'SOME'`, the entire block is retried when any `then` block fails:

```ts
when.repeatably({
  attempts: 3,
  criteria: 'SOME',
})('llm generates valid output', ({ attempt }) => {
  // if thenB fails, BOTH thenA and thenB will run again on the next attempt
  then('thenA: output is not empty', () => {
    expect(result.output.length).toBeGreaterThan(0);
  });

  then('thenB: output is valid json', () => {
    expect(() => JSON.parse(result.output)).not.toThrow();
  });
});
```

this enables reliable tests for probabilistic systems where multiple assertions must pass together. if attempt 1 fails on `thenB`, attempt 2 will re-run both `thenA` and `thenB` from scratch.

**skip-on-success behavior**

once any attempt passes (all `then` blocks succeed), subsequent attempts are skipped entirely:
- all `then` blocks are skipped
- `useBeforeAll` and `useAfterAll` callbacks are skipped
- expensive setup operations do not execute

**recommended pattern for ci/cd**

for reliable ci/cd with probabilistic tests (like llm-powered systems), use environment-aware criteria:

```ts
const criteria = process.env.CI ? 'SOME' : 'EVERY';

when.repeatably({ attempts: 3, criteria })('llm generates response', ({ attempt }) => {
  then('response is valid', () => {
    // strict at devtime (EVERY): all 3 attempts must pass
    // tolerant at cicdtime (SOME): at least 1 attempt must pass
    expect(response).toMatchSnapshot();
  });
});
```

this pattern provides:
- **strict validation at devtime** — `'EVERY'` ensures consistent behavior across all attempts
- **reliable ci/cd pipelines** — `'SOME'` tolerates occasional probabilistic failures while still able to catch systematic issues

## hooks

similar to the sync-render constraints that drove react to leverage hooks, we leverage hooks in tests due to those same constraints. test frameworks collect test definitions synchronously, then execute them later. hooks let immutable references to data be declared before the data is rendered via execution — which enables `const` declarations instead of `let` mutations.

### useBeforeAll

prepare test resources once for all tests in a suite, to optimize setup time for expensive operations

```ts
describe('spaceship refuel system', () => {
  given('a spaceship that needs to refuel', () => {
    const spaceship = useBeforeAll(async () => {
      // runs once before all tests in this suite
      const ship = await prepareExampleSpaceship();
      await ship.dock();
      return ship;
    });

    when('[t0] no changes yet', () => {
      then('it should be docked', async () => {
        expect(spaceship.isDocked).toEqual(true);
      });

      then('it should need fuel', async () => {
        expect(spaceship.fuelLevel).toBeLessThan(spaceship.fuelCapacity);
      });
    });

    when('[t1] it connects to the fuel station', () => {
      const result = useBeforeAll(async () => await spaceship.connectToFuelStation());

      then('it should be connected', async () => {
        expect(result.connected).toEqual(true);
      });

      then('it should calculate required fuel', async () => {
        expect(result.fuelNeeded).toBeGreaterThan(0);
      });
    });
  });
});
```

### useBeforeEach

prepare fresh test resources before each test to ensure test isolation

```ts
describe('spaceship combat system', () => {
  given('a spaceship in battle', () => {
    // runs before each test to ensure a fresh spaceship
    const spaceship = useBeforeEach(async () => {
      const ship = await prepareExampleSpaceship();
      await ship.resetShields();
      return ship;
    });

    when('[t0] no changes yet', () => {
      then('it should have full shields', async () => {
        expect(spaceship.shields).toEqual(100);
      });

      then('it should be ready for combat', async () => {
        expect(spaceship.status).toEqual('READY');
      });
    });

    when('[t1] it takes damage', () => {
      const result = useBeforeEach(async () => await spaceship.takeDamage(25));

      then('it should reduce shield strength', async () => {
        expect(spaceship.shields).toEqual(75);
      });

      then('it should return damage report', async () => {
        expect(result.damageReceived).toEqual(25);
      });
    });
  });
});
```

**when to use each:**
- `useBeforeAll`: use when setup is expensive (database connections, api calls) and tests don't modify the resource
- `useBeforeEach`: use when tests modify the resource and need isolation between runs

### useThen

capture the result of an operation in a `then` block and share it with sibling `then` blocks, without `let` declarations

```ts
describe('invoice system', () => {
  given('a customer with an overdue invoice', () => {
    when('[t1] the invoice is processed', () => {
      const result = useThen('process succeeds', async () => {
        return await processInvoice({ customerId: '123' });
      });

      then('it should mark the invoice as sent', () => {
        expect(result.status).toEqual('sent');
      });

      then('it should calculate the correct total', () => {
        expect(result.total).toEqual(150.00);
      });

      then('it should include the late fee', () => {
        expect(result.lateFee).toEqual(25.00);
      });
    });
  });
});
```

`useThen` creates a test (`then` block) and returns a proxy to the result. the proxy defers access until the test runs, which makes the result available to sibling `then` blocks.

### useWhen

capture the result of an operation at the `given` level and share it with sibling `when` blocks — ideal for idempotency verification

```ts
describe('user registration', () => {
  given('a new user email', () => {
    when('[t0] before any changes', () => {
      then('user does not exist', async () => {
        const user = await findUser({ email: 'test@example.com' });
        expect(user).toBeNull();
      });
    });

    const responseFirst = useWhen('[t1] registration is called', () => {
      const response = useThen('registration succeeds', async () => {
        return await registerUser({ email: 'test@example.com' });
      });

      then('user is created', () => {
        expect(response.status).toEqual('created');
      });

      return response;
    });

    when('[t2] registration is repeated', () => {
      const responseSecond = useThen('registration still succeeds', async () => {
        return await registerUser({ email: 'test@example.com' });
      });

      then('response is idempotent', () => {
        expect(responseSecond.id).toEqual(responseFirst.id);
        expect(responseSecond.status).toEqual(responseFirst.status);
      });
    });
  });
});
```

`useWhen` executes during test collection and returns a value accessible to sibling `when` blocks. use it with `useThen` inside to capture async operation results for cross-block comparisons like idempotency verification.

### how to choose the right hook

| hook            | when to use                                      | execution timing       |
| --------------- | ------------------------------------------------ | ---------------------- |
| `useBeforeAll`  | expensive setup shared across tests              | once before all tests  |
| `useBeforeEach` | setup that needs isolation                       | before each test       |
| `useThen`       | capture async operation result in a test         | during test execution  |
| `useWhen`       | wrap a when block and share result with siblings | during test collection |

**key differences:**
- `useBeforeAll`/`useBeforeEach` - for test fixtures and setup
- `useThen` - for operations that ARE the test (creates a `then` block)
- `useWhen` - wraps a when block at given level, returns result for sibling when blocks (idempotency verification)

### immutability benefits

these hooks enable immutable test code:

```ts
// ❌ mutable - requires let
let result;
beforeAll(async () => {
  result = await fetchData();
});
it('uses result', () => {
  expect(result.value).toBe(1);
});

// ✅ immutable - const only
const result = useBeforeAll(async () => await fetchData());
then('uses result', () => {
  expect(result.value).toBe(1);
});
```

benefits of immutability:
- **safer**: no accidental reassignment or mutation
- **clearer**: data flow is explicit
- **simpler**: no need to track when variables are assigned

## utilities

### genTempDir

generates a temporary test directory within the repo's `.temp` folder, with automatic cleanup of stale directories.

**features:**
- portable across os systems (no os-specific temp dir dependencies)
- timestamp-prefixed names enable age-based cleanup
- slug in directory name helps identify which test created it
- auto-prunes directories older than 7 days
- optional fixture clone for pre-populated test scenarios

**basic usage:**

```ts
import { genTempDir } from 'test-fns';

describe('file processor', () => {
  given('a test directory', () => {
    const testDir = genTempDir({ slug: 'file-processor' });

    when('files are written', () => {
      then('they exist in the test directory', async () => {
        await fs.writeFile(path.join(testDir, 'example.txt'), 'content');
        expect(await fs.stat(path.join(testDir, 'example.txt'))).toBeDefined();
      });
    });
  });
});
```

**with fixture clone:**

```ts
import { genTempDir } from 'test-fns';

describe('config parser', () => {
  given('a directory with config files', () => {
    const testDir = genTempDir({
      slug: 'config-parser',
      clone: './src/__fixtures__/configs',
    });

    when('config is loaded', () => {
      then('it parses correctly', async () => {
        const config = await loadConfig(testDir);
        expect(config.configOption).toEqual('value');
      });
    });
  });
});
```

**with symlinks to repo root:**

```ts
import { genTempDir } from 'test-fns';

describe('package installer', () => {
  given('a temp directory with symlinks to repo artifacts', () => {
    const testDir = genTempDir({
      slug: 'installer-test',
      symlink: [
        { at: 'node_modules', to: 'node_modules' },
        { at: 'config/tsconfig.json', to: 'tsconfig.json' },
      ],
    });

    when('the installer runs', () => {
      then('it can access linked dependencies', async () => {
        const nodeModules = path.join(testDir, 'node_modules');
        expect(await fs.stat(nodeModules)).toBeDefined();
      });
    });
  });
});
```

symlink options:
- `at` = relative path within the temp dir (where symlink is created)
- `to` = relative path within the repo root (what symlink points to)

notes:
- symlinks are created after clone (if both specified)
- parent directories are created automatically for nested `at` paths
- throws `BadRequestError` if target does not exist
- throws `BadRequestError` if symlink path collides with cloned content

**directory format:**

```
.temp/2026-01-19T12-34-56.789Z.my-test.a1b2c3d4/
      └── {timestamp}.{slug}.{8-char-uuid}
```

the slug helps debuggers identify which test created a directory when they debug.

**cleanup behavior:**

directories in `.temp` are automatically pruned when:
- they are older than 7 days (based on timestamp prefix)
- `genTempDir()` is called (prune runs in background)

the `.temp` directory includes a `readme.md` that explains the ttl policy.

### isTempDir

checks if a path is a test directory created by genTempDir.

```ts
import { isTempDir } from 'test-fns';

isTempDir({ path: '/repo/.temp/2026-01-19T12-34-56.789Z.my-test.a1b2c3d4' }); // true
isTempDir({ path: '/tmp/random' }); // false
```
