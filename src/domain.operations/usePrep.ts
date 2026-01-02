import { UnexpectedCodePathError } from 'helpful-errors';

import { globals } from '@src/infra/isomorph.test/getTestGlobals';

/**
 * .what = declare a resource to be prepared before tests
 * .why = simplifies devexp via `const thing = usePrep(...)` syntax
 * .mode =
 *   - 'beforeAll': prepare once for all tests
 *   - 'beforeEach': prepare fresh for each test run
 */
export const usePrep = <T extends Record<string, any>>(
  setup: () => Promise<T>,
  options: {
    mode: 'beforeAll' | 'beforeEach';
  } = { mode: 'beforeAll' },
): T => {
  // metaphor: "drawer" = proxy target, "toolbox" = real resolved resource
  const drawer: Partial<T> = {}; // exposed object users access
  let toolbox: T | undefined; // holds the resolved result of setup()

  // declare proxy handler up front so we can mutate it
  const proxyHandler: ProxyHandler<any> = {
    get(_, prop) {
      if (toolbox === undefined)
        throw new UnexpectedCodePathError(
          'usePrep: tried to access value before setup completed',
        );
      return (toolbox as any)[prop];
    },
    ownKeys() {
      return Reflect.ownKeys(drawer);
    },
    getOwnPropertyDescriptor(_, prop) {
      return Object.getOwnPropertyDescriptor(drawer, prop);
    },
    apply() {
      throw new Error('usePrep: value is not callable');
    },
  };

  const register =
    options.mode === 'beforeEach' ? globals().beforeEach : globals().beforeAll;

  register(async () => {
    toolbox = await setup();

    // assign properties from toolbox to drawer so Object.keys(), for..in, etc work
    Object.assign(drawer, toolbox);

    // remove get trap once setup is complete — access becomes direct
    delete proxyHandler.get;
  });

  // return a proxy that looks and feels like toolbox
  return new Proxy(drawer, proxyHandler) as T;
};

export const useBeforeAll = <T extends Record<string, any>>(
  setup: Parameters<typeof usePrep<T>>[0],
): ReturnType<typeof usePrep<T>> => usePrep<T>(setup, { mode: 'beforeAll' });
export const useBeforeEach = <T extends Record<string, any>>(
  setup: Parameters<typeof usePrep<T>>[0],
): ReturnType<typeof usePrep<T>> => usePrep<T>(setup, { mode: 'beforeEach' });
