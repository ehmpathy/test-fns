import { UnexpectedCodePathError } from 'helpful-errors';

import { bdd } from './givenWhenThen';

// use bdd.then to avoid vitest thenable detection issues with direct then export
const { then } = bdd;

/**
 * .what = type for a then-like function
 * .why = enables passing then, then.only, then.skip, or the result of then.skipIf/runIf
 */
type ThenLikeFn = (desc: string, fn: () => Promise<void> | void) => void;

/**
 * .what = helper to create the proxy pattern for useThen
 * .why = reused by main function and all modifiers
 */
const createUseThenProxy = <T extends Record<string, any>>(input: {
  desc: string;
  fn: () => Promise<T> | T;
  thenFn: ThenLikeFn;
}): T => {
  // metaphor: "drawer" = proxy target, "toolbox" = real resolved resource
  const drawer: Partial<T> = {};
  let toolbox: T | undefined;

  // declare proxy handler up front so we can mutate it
  const proxyHandler: ProxyHandler<any> = {
    get(_, prop) {
      if (toolbox === undefined)
        throw new UnexpectedCodePathError(
          'useThen: tried to access value before test ran',
        );
      return (toolbox as any)[prop];
    },
    ownKeys() {
      return Reflect.ownKeys(drawer);
    },
    getOwnPropertyDescriptor(_, prop) {
      return Object.getOwnPropertyDescriptor(drawer, prop);
    },
  };

  // register the test via the provided then function (or modifier)
  input.thenFn(input.desc, async () => {
    toolbox = await input.fn();

    // assign properties for Object.keys() support
    Object.assign(drawer, toolbox);

    // remove get trap once test completes
    delete proxyHandler.get;
  });

  // return proxy
  return new Proxy(drawer, proxyHandler) as T;
};

/**
 * .what = interface for useThen with modifiers
 * .why = enables useThen.only, useThen.skip, etc.
 */
interface UseThen {
  <T extends Record<string, any>>(desc: string, fn: () => Promise<T> | T): T;

  only: <T extends Record<string, any>>(
    desc: string,
    fn: () => Promise<T> | T,
  ) => T;

  skip: <T extends Record<string, any>>(
    desc: string,
    fn: () => Promise<T> | T,
  ) => T;

  skipIf: (
    condition: boolean,
  ) => <T extends Record<string, any>>(
    desc: string,
    fn: () => Promise<T> | T,
  ) => T;

  runIf: (
    condition: boolean,
  ) => <T extends Record<string, any>>(
    desc: string,
    fn: () => Promise<T> | T,
  ) => T;
}

/**
 * .what = register a test and capture its return value for subsequent assertions
 * .why = eliminates `let` declarations for sharing operation results between then blocks
 */
export const useThen: UseThen = <T extends Record<string, any>>(
  desc: string,
  fn: () => Promise<T> | T,
): T => createUseThenProxy({ desc, fn, thenFn: then });

// modifiers
useThen.only = <T extends Record<string, any>>(
  desc: string,
  fn: () => Promise<T> | T,
): T => createUseThenProxy({ desc, fn, thenFn: then.only });

useThen.skip = <T extends Record<string, any>>(
  desc: string,
  fn: () => Promise<T> | T,
): T => createUseThenProxy({ desc, fn, thenFn: then.skip });

useThen.skipIf =
  (condition: boolean) =>
  <T extends Record<string, any>>(desc: string, fn: () => Promise<T> | T): T =>
    createUseThenProxy({ desc, fn, thenFn: then.skipIf(condition) });

useThen.runIf =
  (condition: boolean) =>
  <T extends Record<string, any>>(desc: string, fn: () => Promise<T> | T): T =>
    createUseThenProxy({ desc, fn, thenFn: then.runIf(condition) });
