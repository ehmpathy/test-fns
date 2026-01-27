import { given, then, when } from './givenWhenThen';

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
      then.todo('it should be possible to todo a test too', () => {
        throw new Error('should have been ignored');
      });
    });
    when('the plant has enough water', () => {
      const plant: Plant = {
        id: 7,
        hydration: 'WET',
      };
      then(
        'it should return false',
        { because: 'because it has enough water' },
        () => {
          expect(doesPlantNeedWater(plant)).toEqual(false);
        },
      );
    });
  });
  given.runIf(false)('runIf=false', () => {
    then('should be skipped', () => {
      throw new Error('should not have been run');
    });
  });
  given.skipIf(false)('skipIf=false', () => {
    when.skipIf(true)('skipIf=true', () => {
      then('should be skipped', () => {
        throw new Error('should not have been run');
      });
    });
    when.skipIf(false)('skipIf=false', () => {
      then.skipIf(true)('this should be skipped', () => {
        throw new Error('should not have been run');
      });
      then.skipIf(false)('this should run', () => {
        expect(true).toEqual(true);
      });
      then.runIf(false)('this should be skipped', () => {
        throw new Error('should not have been run');
      });
      then.runIf(true)('this should run', () => {
        expect(true).toEqual(true);
      });
    });
  });
});
