import { describe, expect } from 'vitest';

import { detectTestRunner, getTestRunner } from './detectTestRunner';

describe('detectTestRunner', () => {
  given('vitest context', () => {
    when('detectTestRunner is called', () => {
      then('it should return vitest', () => {
        expect(detectTestRunner()).toBe('vitest');
      });
    });

    when('getTestRunner is called', () => {
      then('it should return vitest', () => {
        expect(getTestRunner()).toBe('vitest');
      });
    });
  });
});
