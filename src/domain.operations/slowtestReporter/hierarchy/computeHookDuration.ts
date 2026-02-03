/**
 * .what = derive hook time from block duration minus child durations
 * .why = neither jest nor vitest expose individual hook durations
 *
 * note
 * - hook duration includes beforeAll, afterAll, beforeEach, afterEach time
 * - returns 0 when result would be negative (time variance can cause slight negatives)
 */
export const computeHookDuration = (input: {
  blockDuration: number;
  childDurations: number[];
}): number => {
  const childSum = input.childDurations.reduce((acc, dur) => acc + dur, 0);
  const hookDuration = input.blockDuration - childSum;

  // clamp to 0 if negative (variance can cause slight negatives)
  return Math.max(0, hookDuration);
};
