import { given, then, when } from '@src/domain.operations/givenWhenThen';

import { detectTestRunner, getTestRunner } from './detectTestRunner';

describe('detectTestRunner', () => {
  given('jest context', () => {
    when('detectTestRunner is called', () => {
      then('it should return jest', () => {
        expect(detectTestRunner()).toBe('jest');
      });
    });

    when('getTestRunner is called', () => {
      then('it should return jest', () => {
        expect(getTestRunner()).toBe('jest');
      });
    });
  });
});
