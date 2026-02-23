/**
 * .what = detects if an error is an EEXIST error from symlink creation
 * .why = extracted guard for testability and reuse in race condition guards
 *
 * .note = native fs errors may not pass `instanceof Error` in some Node.js
 *         contexts (e.g., cross-realm, vm, or jest transform quirks), so we
 *         check `.code` property first before instanceof
 */
export const isSymlinkEexistError = (error: unknown): boolean => {
  // reject nullish values
  if (error === null || error === undefined) return false;

  // check error code first (works even if instanceof Error fails)
  const asErrno = error as NodeJS.ErrnoException;
  if (asErrno.code === 'EEXIST') return true;

  // fallback: check message if it's an Error-like object
  if (typeof asErrno.message === 'string' && asErrno.message.includes('EEXIST'))
    return true;

  return false;
};
