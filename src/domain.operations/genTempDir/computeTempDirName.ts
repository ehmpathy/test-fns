import { v4 as uuid } from 'uuid';

/**
 * .what = computes a unique temp directory name with timestamp prefix
 * .why = timestamp prefix enables age-based cleanup without stat calls
 *
 * @example
 * computeTempDirName()
 * // => '2026-01-19T12-34-56.789Z.a1b2c3d4'
 */
export const computeTempDirName = (): string => {
  // generate filesystem-safe iso timestamp (replace colons with dashes)
  const timestamp = new Date().toISOString().replace(/:/g, '-');

  // generate short uuid suffix (8 hex chars)
  const suffix = uuid().replace(/-/g, '').slice(0, 8);

  return `${timestamp}.${suffix}`;
};

/**
 * .what = parses timestamp from a temp directory name
 * .why = enables age calculation for prune decisions
 */
export const parseTempDirTimestamp = (input: {
  dirName: string;
}): Date | null => {
  // extract timestamp portion (before the last dot + 8-char suffix)
  const match = input.dirName.match(/^(.+)\.[a-f0-9]{8}$/i);
  if (!match?.[1]) return null;

  // convert filesystem-safe format back to iso (dashes to colons in time portion)
  const timestampPart = match[1];
  const isoTimestamp = timestampPart.replace(
    /(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})/,
    '$1:$2:$3',
  );

  const date = new Date(isoTimestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};
