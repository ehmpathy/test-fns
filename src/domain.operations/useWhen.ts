/**
 * .what = helper to create useWhen pattern
 * .why = executes fn synchronously and returns result (no describe wrapper)
 * .note = does not create a nested when block due to vitest describe timing issues
 */
const createUseWhen = <T>(input: {
  desc: string;
  fn: () => T;
  skip?: boolean;
}): T => {
  // skip mode returns undefined - the result won't be used in skipped tests
  if (input.skip) return undefined as unknown as T;

  // execute synchronously and return
  return input.fn();
};

/**
 * .what = interface for useWhen with modifiers
 * .why = enables useWhen.only, useWhen.skip, etc.
 */
interface UseWhen {
  <T>(desc: string, fn: () => T): T;

  only: <T>(desc: string, fn: () => T) => T;

  skip: <T>(desc: string, fn: () => T) => T;

  skipIf: (condition: boolean) => <T>(desc: string, fn: () => T) => T;

  runIf: (condition: boolean) => <T>(desc: string, fn: () => T) => T;
}

/**
 * .what = execute a fn synchronously and capture its return value for sibling blocks
 * .why = enables sharing operation results across sequential blocks without let declarations
 * .note = unlike useThen, does not create a test block - executes immediately during collection
 */
export const useWhen: UseWhen = <T>(desc: string, fn: () => T): T =>
  createUseWhen({ desc, fn });

// modifiers
useWhen.only = <T>(desc: string, fn: () => T): T => createUseWhen({ desc, fn }); // only has no special meaning for synchronous execution

useWhen.skip = <T>(desc: string, fn: () => T): T =>
  createUseWhen({ desc, fn, skip: true });

useWhen.skipIf =
  (condition: boolean) =>
  <T>(desc: string, fn: () => T): T =>
    createUseWhen({ desc, fn, skip: condition });

useWhen.runIf =
  (condition: boolean) =>
  <T>(desc: string, fn: () => T): T =>
    createUseWhen({ desc, fn, skip: !condition });
