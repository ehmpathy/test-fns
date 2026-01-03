import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';

import { getTestGlobals, globals } from './getTestGlobals';

describe('getTestGlobals', () => {
  given('vitest context', () => {
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
  given('vitest context', () => {
    when('globals() is called', () => {
      then('describe should match vitest describe', () => {
        expect(globals().describe).toBe(describe);
      });

      then('test should match vitest test', () => {
        expect(globals().test).toBe(test);
      });

      then('beforeAll should match vitest beforeAll', () => {
        expect(globals().beforeAll).toBe(beforeAll);
      });

      then('beforeEach should match vitest beforeEach', () => {
        expect(globals().beforeEach).toBe(beforeEach);
      });

      then('afterAll should match vitest afterAll', () => {
        expect(globals().afterAll).toBe(afterAll);
      });

      then('afterEach should match vitest afterEach', () => {
        expect(globals().afterEach).toBe(afterEach);
      });
    });
  });
});
