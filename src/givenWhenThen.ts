import { UnexpectedCodePathError } from '@ehmpathy/error-fns';

export const getNumberRange = (input: {
  start: number;
  end: number;
}): number[] => {
  // Calculate the length of the range
  const length = input.end - input.start + 1;
  // Create an array with the specified range
  return Array.from({ length }, (_, i) => input.start + i);
};

type TestContextShape = Record<string, any> | void;
type TestInputWithReason<TContext extends Record<string, any> | void> = [
  string,
  { because: string },
  (context: TContext) => Promise<void> | void,
];
type TestInputWithoutReason<TContext extends Record<string, any> | void> =
  | [string, (context: TContext) => Promise<void> | void]
  | [string];
type TestInput<TContext extends TestContextShape> =
  | TestInputWithReason<TContext>
  | TestInputWithoutReason<TContext>;
const castToJestTestInput = ({
  input,
  prefix,
}: {
  input: TestInput<void>;
  prefix: string;
}): [string, (() => Promise<unknown>) | ((cb: any) => void) | undefined] => {
  const method = input.length === 3 ? input[2] : input[1]; // its always last
  const methodWithBetterErrorLog = method;
  if (input.length === 3) return [`${prefix}: ${input[0]}`, method]; // we allow users to specify the reason for code readability, but we dont expose this in the test report to decrease noise. folks can look in the code if they want to know "why"
  return [`${prefix}: ${input[0]}`, method]; // otherwise, its the normal input
};

interface Describe {
  (desc: string, fn: () => void): void;

  /** Only runs the tests inside this `describe` for the current file */
  only: (desc: string, fn: () => void) => void;

  /** Skips running the tests inside this `describe` for the current file */
  skip: (desc: string, fn: () => void) => void;

  /** Skips running the tests inside this `describe` for the current file if the condition is satisfied */
  skipIf: (condition: boolean) => (desc: string, fn: () => void) => void;

  /** Runs the tests inside this `describe` for the current file only if the condition is satisfied */
  runIf: (condition: boolean) => (desc: string, fn: () => void) => void;
}
interface Test {
  (...input: TestInput<void>): void;

  /** Only runs this test for the current file */
  only: (...input: TestInput<void>) => void;

  /** Skips running this test */
  skip: (...input: TestInput<void>) => void;

  /** Marks the test as one that still needs to be written */
  todo: (...input: TestInput<void>) => void;

  /** Skips running the test, if the condition is satisfied */
  skipIf: (condition: boolean) => (...input: TestInput<void>) => void;

  /** Runs the test if the condition is satisfied */
  runIf: (condition: boolean) => (...input: TestInput<void>) => void;

  /** Runs the test repeatedly to evaluate repeatability */
  repeatably: (configuration: {
    /**
     * how many attempts to run the test, repeatedly
     */
    attempts: number;

    /**
     * the criteria for the whole test suite
     *
     * note
     * - EVERY = every test must pass for the suite to pass
     * - SOME = some test must pass for the suite to pass
     */
    criteria: 'EVERY' | 'SOME';
  }) => (...input: TestInput<{ attempt: number }>) => void;
}

export const given: Describe = (
  desc: string,
  fn: () => Promise<void> | void,
): void => describe(`given: ${desc}`, fn);
given.only = (desc: string, fn: () => void): void =>
  describe.only(`given: ${desc}`, fn);
given.skip = (desc: string, fn: () => void): void =>
  describe.skip(`given: ${desc}`, fn);
given.skipIf =
  (condition: boolean) =>
  (desc: string, fn: () => void): void =>
    condition ? given.skip(desc, fn) : given(desc, fn);
given.runIf = (condition: boolean) => given.skipIf(!condition);

export const when: Describe = (
  desc: string,
  fn: () => Promise<void> | void,
): void => describe(`when: ${desc}`, fn);
when.only = (desc: string, fn: () => void): void =>
  describe.only(`when: ${desc}`, fn);
when.skip = (desc: string, fn: () => void): void =>
  describe.skip(`when: ${desc}`, fn);
when.skipIf =
  (condition: boolean) =>
  (desc: string, fn: () => void): void =>
    condition ? when.skip(desc, fn) : when(desc, fn);
when.runIf = (condition: boolean) => when.skipIf(!condition);

export const then: Test = (...input: TestInput<void>): void =>
  test(...castToJestTestInput({ input, prefix: 'then' }));
then.only = (...input: TestInput<void>): void =>
  test.only(...castToJestTestInput({ input, prefix: 'then' }));
then.skip = (...input: TestInput<void>): void =>
  test.skip(...castToJestTestInput({ input, prefix: 'then' }));
then.todo = (...input: TestInput<void>): void =>
  test.todo(...castToJestTestInput({ input: [input[0]], prefix: 'then' })); // note that we only pass the first input, since jest's .todo function throws an error if you pass an implementation fn
then.skipIf =
  (condition: boolean) =>
  (...input: TestInput<void>): void =>
    condition ? then.skip(...input) : then(...input);
then.runIf = (condition: boolean) => then.skipIf(!condition);
then.repeatably =
  (configuration) =>
  (...input: TestInput<{ attempt: number }>): void => {
    // validate the input length
    if (input.length !== 2 && input.length !== 3)
      throw new UnexpectedCodePathError('unsupported input length', {
        input,
      });

    // support the "SOME" criteria
    if (configuration.criteria === 'SOME') {
      // use the native "retryTimes"
      jest.retryTimes(configuration.attempts, { logErrorsBeforeRetry: true });

      // track the number of attempts
      let attempt = 0;
      beforeEach(() => attempt++);

      // and run the test
      if (input.length === 2) then(input[0], () => input[1]({ attempt }));
      if (input.length === 3)
        then(input[0], input[1], () => input[2]({ attempt }));
      return;
    }

    // support the "EVERY" criteria
    if (configuration.criteria === 'EVERY') {
      for (const attempt of getNumberRange({
        start: 1,
        end: configuration.attempts,
      })) {
        if (input.length === 2)
          then(input[0] + `, attempt ${attempt}`, () => input[1]({ attempt }));
        if (input.length === 3)
          then(input[0] + `, attempt ${attempt}`, input[1], () =>
            input[2]({ attempt }),
          );
      }
      return;
    }

    // throw if neither
    throw new UnexpectedCodePathError(
      'configuration.criteria was neither EVERY nor SOME',
      { configuration },
    );
  };
