/**
 * .what = registry and stack for repeatably context lookup
 * .why = enables explicit context lookup by describe path instead of implicit global
 */

/**
 * .what = tracks current describe path as stack of names
 * .why = enables explicit context lookup by path
 */
const describeStack: string[] = [];

/**
 * .what = get current describe path as lookup key
 * .why = used by then/useBeforeAll to find their repeatably context
 */
export const getDescribePath = (): string => describeStack.join(' > ');

/**
 * .what = state shape for repeatably context
 * .why = tracks success and failure across attempts
 */
export interface RepeatableState {
  /**
   * .what = the criteria for this repeatably block
   * .why = determines whether skip-on-success applies (SOME) or not (EVERY)
   */
  criteria: 'EVERY' | 'SOME';

  /**
   * .what = whether any prior attempt has passed
   * .why = used to skip subsequent attempts (only when criteria is SOME)
   */
  anyAttemptPassed: boolean;

  /**
   * .what = whether the current attempt has failed
   * .why = used to determine if this attempt should mark success
   */
  thisAttemptFailed: boolean;

  /**
   * .what = which attempt number is active now
   * .why = used to determine if we should throw on failure (only on final attempt)
   */
  thisAttemptIndex: number;

  /**
   * .what = total number of attempts configured
   * .why = used to determine if current attempt is final
   */
  allAttemptsQuant: number;

  /**
   * .what = error encountered in any failed attempt
   * .why = preserve error to throw on final attempt if all fail
   */
  anyError: Error | null;
}

/**
 * .what = one repeatable block an attempt runs inside, by its two names
 * .why = a snapshot key must not carry the attempt ordinal, so every attempt checks
 *        against one baseline. the scope names the exact text to strip from the key
 *
 * @example
 * { nameAttempt: 'when: the ask, attempt 2', nameBase: 'when: the ask' }
 */
export interface RepeatableScope {
  /**
   * .what = the registered name, with the attempt ordinal
   * .why = the exact span of text a snapshot key carries today
   */
  nameAttempt: string;

  /**
   * .what = the name without the attempt ordinal
   * .why = the span of text the key must carry instead
   */
  nameBase: string;
}

/**
 * .what = the repeatable scopes that enclose the block under registration
 * .why = nested repeatables (a when.repeatably inside a given.repeatably) each add an
 *        ordinal to the key, so every one of them must be stripped
 */
let currentRepeatableScopes: RepeatableScope[] = [];

/**
 * .what = get the repeatable scopes that enclose the block under registration
 * .why = then() captures them at registration, for use when its test runs
 */
export const getCurrentRepeatableScopes = (): RepeatableScope[] =>
  currentRepeatableScopes;

/**
 * .what = set the repeatable scopes that enclose the block under registration
 * .why = called by the repeatably describes and the nested describe wrappers
 */
export const setCurrentRepeatableScopes = (scopes: RepeatableScope[]): void => {
  currentRepeatableScopes = scopes;
};

/**
 * .what = registry for repeatably state keyed by describe path
 * .why = explicit scope — state is looked up by path, not implicit global
 */
export const registryDescribeRepeatable = new Map<string, RepeatableState>();

/**
 * .what = current repeatably context for nested callbacks
 * .why = vitest defers nested describe callbacks, which breaks the describeStack hierarchy.
 *        this allows nested when/given to capture context at registration time and
 *        re-propagate it when their deferred callbacks execute.
 */
let currentRepeatableContext: RepeatableState | null = null;

/**
 * .what = get current repeatably context
 * .why = used by then() to find context when describeStack path doesn't match
 */
export const getCurrentRepeatableContext = (): RepeatableState | null =>
  currentRepeatableContext;

/**
 * .what = set current repeatably context
 * .why = called by genDescribeRepeatable and nested describe wrappers
 */
export const setCurrentRepeatableContext = (
  ctx: RepeatableState | null,
): void => {
  currentRepeatableContext = ctx;
};

/**
 * .what = find repeatably context via path hierarchy traversal
 * .why = nested blocks (when inside given.repeatably) need to find parent context
 *
 * @example
 * // registry has: "given: desc, attempt 1"
 * // path is: "given: desc, attempt 1 > when: test runs"
 * // returns: state registered at "given: desc, attempt 1"
 */
export const findRepeatableContext = (
  path: string,
): RepeatableState | undefined => {
  // try exact match first
  const exact = registryDescribeRepeatable.get(path);
  if (exact) return exact;

  // traverse up the path hierarchy to find parent context
  const parts = path.split(' > ');
  while (parts.length > 0) {
    parts.pop();
    const parentPath = parts.join(' > ');
    const parent = registryDescribeRepeatable.get(parentPath);
    if (parent) return parent;
  }

  return undefined;
};

/**
 * .what = wraps describe callback with stack management and context propagation
 * .why = vitest defers describe callbacks; this ensures describeStack + repeatably context
 *        are correctly tracked at execution time, not registration time
 */
export const wrapDescribeCallback = (input: {
  name: string;
  fn: () => void;
}): (() => void) => {
  // capture repeatably context + scopes at registration time (survives vitest's deferred callback)
  const capturedCtx = getCurrentRepeatableContext();
  const capturedScopes = getCurrentRepeatableScopes();
  return () => {
    describeStack.push(input.name);
    // re-propagate captured context + scopes for nested describe callbacks
    const prevCtx = getCurrentRepeatableContext();
    const prevScopes = getCurrentRepeatableScopes();
    if (capturedCtx) setCurrentRepeatableContext(capturedCtx);
    setCurrentRepeatableScopes(capturedScopes);
    try {
      input.fn();
    } finally {
      setCurrentRepeatableContext(prevCtx);
      setCurrentRepeatableScopes(prevScopes);
      describeStack.pop();
    }
  };
};
