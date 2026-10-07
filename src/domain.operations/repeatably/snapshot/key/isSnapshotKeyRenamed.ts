import type { RepeatableScope } from '../../../registryDescribeRepeatable';

/**
 * .what = checks whether a test's snapshot is absent only because its key was renamed
 * .why = keys inside a repeatable block no longer carry `, attempt N`. a baseline
 *        written before that change holds only the old keys, so the check fails on
 *        an absent key. the consumer needs to hear "renamed — resnap once", not a
 *        bare "snapshot absent"
 *
 * .note = only the ordinal right after a repeatable scope's own name is removed. a
 *         consumer's own title may read `, attempt 3` and must stay intact
 *
 * @returns true when no key starts with the stripped name, and some key would, once
 *          the attempt ordinals of the repeatable scopes are removed
 */
export const isSnapshotKeyRenamed = (input: {
  snapshotData: object;
  nameStripped: string;
  scopes: RepeatableScope[];
}): boolean => {
  const keys = Object.keys(input.snapshotData);
  const prefix = `${input.nameStripped} `;

  // a key under the new name means the baseline is current
  if (keys.some((key) => key.startsWith(prefix))) return false;

  // a key under the old, attempt-ful name means the baseline predates the rename
  return keys.some((key) =>
    asKeyWithoutScopeOrdinals({ key, scopes: input.scopes }).startsWith(prefix),
  );
};

/**
 * .what = removes `, attempt N` wherever it follows a repeatable scope's base name
 * .why = an old key may hold any attempt's ordinal (most often attempt 1), so the
 *        swap matches each scope's base name plus any ordinal, never a bare pattern
 */
const asKeyWithoutScopeOrdinals = (input: {
  key: string;
  scopes: RepeatableScope[];
}): string =>
  input.scopes.reduce(
    (key, scope) =>
      key.replace(
        new RegExp(`${asRegexLiteral(scope.nameBase)}, attempt \\d+`, 'g'),
        scope.nameBase,
      ),
    input.key,
  );

/**
 * .what = escapes a text so a RegExp matches it literally
 * .why = a scope name is consumer text and may hold regex metacharacters
 */
const asRegexLiteral = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
