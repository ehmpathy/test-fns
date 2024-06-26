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
  given('a probabilistic test', () => {
    when('criteria = EVERY', () => {
      then.repeatably({ attempts: 3, criteria: 'EVERY' })(
        'it should succeed every time',
        () => {
          expect(true).toEqual(true);
        },
      );
      then.repeatably({ attempts: 3, criteria: 'EVERY' })(
        'it should have access to the attempt counter',
        ({ attempt }) => {
          expect(attempt).toBeGreaterThan(0);
        },
      );
    });

    when('criteria = SOME', () => {
      then.repeatably({ attempts: 5, criteria: 'SOME' })(
        'it should have access to the attempt counter',
        async ({ attempt }) => {
          expect(attempt).toBeGreaterThan(3);
        },
      );
    });
  });
});
