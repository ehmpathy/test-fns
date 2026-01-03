import { given, then, when } from '@src/domain.operations/givenWhenThen';

import { runTest, runTestOnly, runTestSkip, runTestTodo } from './runTest';

describe('runTest', () => {
  given('jest context', () => {
    when('exports are accessed', () => {
      then('runTest should be a function', () => {
        expect(typeof runTest).toBe('function');
      });

      then('runTestOnly should be a function', () => {
        expect(typeof runTestOnly).toBe('function');
      });

      then('runTestSkip should be a function', () => {
        expect(typeof runTestSkip).toBe('function');
      });

      then('runTestTodo should be a function', () => {
        expect(typeof runTestTodo).toBe('function');
      });
    });
  });
});
