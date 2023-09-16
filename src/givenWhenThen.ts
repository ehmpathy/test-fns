interface Describe {
  (desc: string, fn: () => void): void;

  /** Only runs the tests inside this `describe` for the current file */
  only: (desc: string, fn: () => void) => void;

  /** Skips running the tests inside this `describe` for the current file */
  skip: (desc: string, fn: () => void) => void;
}
interface Test {
  (desc: string, fn: () => Promise<void> | void): void;

  /** Only runs this test for the current file */
  only: (desc: string, fn: () => Promise<void> | void) => void;

  /** Skips running this test */
  skip: (desc: string, fn: () => Promise<void> | void) => void;
}

export const given: Describe = (
  desc: string,
  fn: () => Promise<void> | void,
): void => describe(`given: ${desc}`, fn);
given.only = (desc: string, fn: () => void): void =>
  describe.only(`given: ${desc}`, fn);
given.skip = (desc: string, fn: () => void): void =>
  describe.skip(`given: ${desc}`, fn);

export const when: Describe = (
  desc: string,
  fn: () => Promise<void> | void,
): void => describe(`when: ${desc}`, fn);
when.only = (desc: string, fn: () => void): void =>
  describe.only(`when: ${desc}`, fn);
when.skip = (desc: string, fn: () => void): void =>
  describe.skip(`when: ${desc}`, fn);

export const then: Test = (
  desc: string,
  fn: () => Promise<void> | void,
): void => test(`then: ${desc}`, fn as any);
then.only = (desc: string, fn: () => Promise<void> | void): void =>
  test.only(`then: ${desc}`, fn as any);
then.skip = (desc: string, fn: () => Promise<void> | void): void =>
  test.skip(`then: ${desc}`, fn as any);
