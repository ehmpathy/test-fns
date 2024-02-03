type TestInputWithReason = [
  string,
  { because: string },
  () => Promise<void> | void,
];
type TestInputWithoutReason = [string, () => Promise<void> | void] | [string];
type TestInput = TestInputWithReason | TestInputWithoutReason;
const castToJestTestInput = ({
  input,
  prefix,
}: {
  input: TestInput;
  prefix: string;
}): [string, (() => Promise<unknown>) | ((cb: any) => void) | undefined] => {
  if (input.length === 3) return [`${prefix}: ${input[0]}`, input[2]]; // we allow users to specify the reason for code readability, but we dont expose this in the test report to decrease noise. folks can look in the code if they want to know "why"
  return [`${prefix}: ${input[0]}`, input[1]]; // otherwise, its the normal input
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
  (...input: TestInput): void;

  /** Only runs this test for the current file */
  only: (...input: TestInput) => void;

  /** Skips running this test */
  skip: (...input: TestInput) => void;

  /** Marks the test as one that still needs to be written */
  todo: (...input: TestInput) => void;

  /** Skips running the test, if the condition is satisfied */
  skipIf: (condition: boolean) => (...input: TestInput) => void;

  /** Runs the test if the condition is satisfied */
  runIf: (condition: boolean) => (...input: TestInput) => void;
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

export const then: Test = (...input: TestInput): void =>
  test(...castToJestTestInput({ input, prefix: 'then' }));
then.only = (...input: TestInput): void =>
  test.only(...castToJestTestInput({ input, prefix: 'then' }));
then.skip = (...input: TestInput): void =>
  test.skip(...castToJestTestInput({ input, prefix: 'then' }));
then.todo = (...input: TestInput): void =>
  test.todo(...castToJestTestInput({ input: [input[0]], prefix: 'then' })); // note that we only pass the first input, since jest's .todo function throws an error if you pass an implementation fn
then.skipIf =
  (condition: boolean) =>
  (...input: TestInput): void =>
    condition ? then.skip(...input) : then(...input);
then.runIf = (condition: boolean) => then.skipIf(!condition);
