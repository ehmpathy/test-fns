import { given, when, then } from './givenWhenThen';

type Plant = { id: number; hydration: 'DRY' | 'WET' };
const doesPlantNeedWater = (plant: Plant) => plant.hydration === 'DRY';

describe('doesPlantNeedWater', () => {
  given('a plant', () => {
    when('the plant doesnt have enough water', () => {
      const plant: Plant = {
        id: 7,
        hydration: 'DRY',
      };
      then('it should return true', () => {
        expect(doesPlantNeedWater(plant)).toEqual(true);
      });
      then.skip('it should be possible to skip a test too', () => {
        throw new Error('should have been skipped');
      });
    });
  });
});
