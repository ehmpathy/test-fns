/**
 * .what = registry and stack for repeatably context lookup
 * .why = enables explicit context lookup by describe path instead of implicit global
 */

/**
 * .what = tracks current describe path as stack of names
 * .why = enables explicit context lookup by path
 */
export const describeStack: string[] = [];

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
   * .what = whether any prior attempt has passed
   * .why = used to skip subsequent attempts
   */
  anyAttemptPassed: boolean;

  /**
   * .what = whether the current attempt has failed
   * .why = used to determine if this attempt should mark success
   */
  thisAttemptFailed: boolean;
}

/**
 * .what = registry for repeatably state keyed by describe path
 * .why = explicit scope — state is looked up by path, not implicit global
 */
export const registryDescribeRepeatable = new Map<string, RepeatableState>();

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
