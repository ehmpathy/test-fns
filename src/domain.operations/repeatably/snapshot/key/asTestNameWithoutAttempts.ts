import type { RepeatableScope } from '../../../registryDescribeRepeatable';

/**
 * .what = removes every repeatable attempt ordinal from a full test name
 * .why = a snapshot key is the full test name plus a count. with the ordinal in it,
 *        each attempt checks a key of its own — so a retry compares against a key that
 *        was never written. without it, every attempt checks one baseline
 *
 * .note = an exact text swap of each scope's registered name, never a pattern. a
 *         consumer's own describe may read `, attempt 2` and must stay intact
 *
 * @example
 * asTestNameWithoutAttempts({
 *   name: 'given: a scene when: the ask, attempt 2 then: it passes',
 *   scopes: [{ nameAttempt: 'when: the ask, attempt 2', nameBase: 'when: the ask' }],
 * }) // => 'given: a scene when: the ask then: it passes'
 */
export const asTestNameWithoutAttempts = (input: {
  name: string;
  scopes: RepeatableScope[];
}): string =>
  input.scopes.reduce(
    (name, scope) => name.split(scope.nameAttempt).join(scope.nameBase),
    input.name,
  );
