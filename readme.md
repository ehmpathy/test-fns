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
