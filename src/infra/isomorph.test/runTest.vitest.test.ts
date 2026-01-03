import { describe, expect } from 'vitest';

import { runTest, runTestOnly, runTestSkip, runTestTodo } from './runTest';

describe('runTest', () => {
  given('vitest context', () => {
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
