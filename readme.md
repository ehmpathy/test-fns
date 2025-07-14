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
