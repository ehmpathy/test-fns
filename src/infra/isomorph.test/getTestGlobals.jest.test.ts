import { given, then, when } from '@src/domain.operations/givenWhenThen';

import { getTestGlobals, globals } from './getTestGlobals';

describe('getTestGlobals', () => {
  given('jest context', () => {
    when('getTestGlobals is called', () => {
      then('it should return describe as a function', () => {
        const g = getTestGlobals();
        expect(typeof g.describe).toBe('function');
      });

      then('it should return test as a function', () => {
        const g = getTestGlobals();
        expect(typeof g.test).toBe('function');
      });

      then('it should return beforeAll as a function', () => {
        const g = getTestGlobals();
        expect(typeof g.beforeAll).toBe('function');
      });

      then('it should return beforeEach as a function', () => {
        const g = getTestGlobals();
        expect(typeof g.beforeEach).toBe('function');
      });

      then('it should return afterAll as a function', () => {
        const g = getTestGlobals();
        expect(typeof g.afterAll).toBe('function');
      });

      then('it should return afterEach as a function', () => {
        const g = getTestGlobals();
        expect(typeof g.afterEach).toBe('function');
      });
    });
  });
});

describe('globals', () => {
  given('jest context', () => {
    when('globals() is called', () => {
      then('describe should match jest describe', () => {
        expect(globals().describe).toBe(describe);
      });

      then('test should match jest test', () => {
        expect(globals().test).toBe(test);
      });
    });
  });
});
