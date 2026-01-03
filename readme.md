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

    when('checked for watering needs', () => {
      then('it should return true', () => {
        expect(doesPlantNeedWater(plant)).toEqual(true);
      });
    });
  });
});
```

### vitest

vitest requires special handling because ESM's thenable protocol prevents direct `then` imports.

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

    when('checked for watering needs', () => {
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

    bdd.when('checked for watering needs', () => {
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
      when: checked for watering needs
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

run a test multiple times to evaluate repeatability, with environment-aware criteria to prevent CI flakes while enforcing consistency locally

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

**when to use each:**
- `useBeforeAll`: use when setup is expensive (database connections, api calls) and tests don't modify the resource
- `useBeforeEach`: use when tests modify the resource and need isolation between runs
