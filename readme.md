# test-fns

![ci_on_commit](https://github.com/ehmpathy/test-fns/workflows/ci_on_commit/badge.svg)
![deploy_on_tag](https://github.com/ehmpathy/test-fns/workflows/deploy_on_tag/badge.svg)

write usecase driven tests systematically for simpler, safer, and more readable code

# purpose

establishes a pattern of writing tests for simpler, safer, and more readable code.

by defining tests in terms of usecases (`given`, `when`, `then`) your tests are
- simpler to write
- easier to read
- safer to trust

# install

```sh
npm install --save test-fns
```

# use

```ts
type Plant = { id: number, hydration: 'DRY' | 'WET' };
const doesPlantNeedWater = (plant: Plant) => plant.hydration === 'DRY';

describe('doesPlantNeedWater', () => {
  given('a plant', () => {
    when('the plant doesnt have enough water', () => {
      const plant: Plant = {
        id: 7,
        hydration: 'DRY',
      };
      then('it should return true', () => {
        expect(doesPlantNeedWater(plant)).toEqual(true)
      })
    })
  })
})
```

produces

```sh
 PASS  src/givenWhenThen.test.ts
  doesPlantNeedWater
    given: a plant
      when: the plant doesnt have enough water
        ✓ then: it should return true (1 ms)
```

# features


### .runIf(condition) && .skipIf(condition)

skip running the suite if the condition is not met

```ts
describe('your test', () => {
  given.runIf(onLocalMachine)('some test that should only run locally', () => {
    then.skipIf(onProduction)('some test that should not run against production', () => {
      expect(onProduction).toBeFalse()
    })
  })
})
```

### usePrep

prepare test scenarios within a .given/.when block asynchronously, without any `let`s or `beforeAll`s

`usePrep` accepts a `mode` option to control when setup runs:
- `mode: 'beforeAll'` - runs setup once for all tests (default)
- `mode: 'beforeEach'` - runs setup fresh before each test

```ts
given('an overdue invoice', () => {
  const invoice = usePrep(async () => {
    const invoiceOverdue = await ... // your logic
    return invoiceOverdue;
  })

  then('it should invoke a reminder', async () => {
    const result = await nurtureInvoice({ invoice }, context)
    expect(result.sent.reminder).toEqual(true)
  })
})
```

**useBeforeAll and useBeforeEach are convenience wrappers** around `usePrep`:
- `useBeforeAll(setup)` is equivalent to `usePrep(setup, { mode: 'beforeAll' })`
- `useBeforeEach(setup)` is equivalent to `usePrep(setup, { mode: 'beforeEach' })`

Use the named functions for clarity about when setup runs.

### useBeforeAll

prepare test resources once for all tests in a suite, optimizing setup time for expensive operations

```ts
describe('spaceship refueling system', () => {
  given('a spaceship that needs to refuel', () => {
    const spaceship = useBeforeAll(async () => {
      // This runs once before all tests in this suite
      const ship = await prepareExampleSpaceship();
      await ship.dock();
      return ship;
    });

    when('no changes are made', () => {
      then('it should be docked', async () => {
        expect(spaceship.isDocked).toEqual(true);
      });

      then('it should need fuel', async () => {
        expect(spaceship.fuelLevel).toBeLessThan(spaceship.fuelCapacity);
      });
    });

    when('it connects to the fuel station', () => {
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

prepare fresh test resources before each test, ensuring test isolation

```ts
describe('spaceship combat system', () => {
  given('a spaceship in battle', () => {
    // This runs before each test, ensuring a fresh spaceship
    const spaceship = useBeforeEach(async () => {
      const ship = await prepareExampleSpaceship();
      await ship.resetShields();
      return ship;
    });

    when('no changes are made', () => {
      then('it should have full shields', async () => {
        expect(spaceship.shields).toEqual(100);
      });

      then('it should be ready for combat', async () => {
        expect(spaceship.status).toEqual('READY');
      });
    });

    when('it takes damage', () => {
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

**When to use each:**
- `useBeforeAll`: Use when setup is expensive (database connections, API calls) and tests don't modify the resource
- `useBeforeEach`: Use when tests modify the resource and need isolation between runs
- `usePrep`: The base function that powers both - use when you want explicit control over the mode or need to dynamically choose between `beforeAll` and `beforeEach`

**Key differences:**
- All three functions (`usePrep`, `useBeforeAll`, `useBeforeEach`) create a proxy that defers setup until the test framework's lifecycle hooks run
- `useBeforeAll` and `useBeforeEach` are just clearer, more readable shortcuts for `usePrep` with a specific mode
- Choose based on readability: use `useBeforeAll`/`useBeforeEach` for explicit intent, or `usePrep` when mode needs to be configurable
