import { UnexpectedCodePathError } from 'helpful-errors';
import { v4 as uuid } from 'uuid';

import { RUN_SLOT_NONE, TEMP_DIR_PATTERN } from './isTempDir';

/**
 * .what = computes a unique temp directory name with timestamp prefix and slug
 * .why = timestamp prefix enables age-based cleanup without stat calls
 *        slug helps debuggers identify which test created the directory
 *        run stamp lets a run reclaim exactly the dirs it made, and no peer's
 *
 * .note = 🔴 the run slot is ALWAYS emitted — a run id, or `_` when no run minted
 *         this. every name therefore has ONE arity, which is what lets the shared
 *         grammar pin the slot and read the run out of a match group rather than a
 *         positional probe. an optional slot would let a slug occupy the run's
 *         position and read back AS a run, which this function would then have to
 *         reject the consumer's own slug to prevent. one arity makes the collision
 *         unreachable, so a slug may be any text at all — `_` included
 *
 * .note = the slot sits INSIDE the free-text segment the age gate's parse takes as
 *         `.+`, so that parse holds by construction. this function asserts the
 *         round trip on its own output, before any dir is made
 *
 * @example
 * computeTempDirName({ slug: 'my-test', run: null })
 * // => '2026-01-19T12-34-56.789Z._.my-test.a1b2c3d4'
 *
 * @example
 * computeTempDirName({ slug: 'my-test', run: 'r7f3a91c2' })
 * // => '2026-01-19T12-34-56.789Z.r7f3a91c2.my-test.a1b2c3d4'
 */
export const computeTempDirName = (input: {
  slug: string;
  /**
   * the run that mints this name, or null when no run is enhooked
   *
   * .note = REQUIRED, and `null` is how a caller says "unstamped". an OPTIONAL run
   *         makes a forgotten stamp type-legal, so a new call site can omit it and
   *         leave its dirs unreclaimable under a run whose count reads zero.
   *         required forces every site to state which it means
   */
  run: string | null;
}): string => {
  // generate filesystem-safe iso timestamp (replace colons with dashes)
  const timestamp = new Date().toISOString().replace(/:/g, '-');

  // generate short uuid suffix (8 hex chars)
  const suffix = uuid().replace(/-/g, '').slice(0, 8);

  // the run slot, always emitted — the id, or `_` which reads back as null
  const runSlot = input.run ?? RUN_SLOT_NONE;
  const dirName = `${timestamp}.${runSlot}.${input.slug}.${suffix}`;

  // assert the name we just minted parses back, before any dir is made
  assertTempDirNameParses({ dirName, run: input.run });

  return dirName;
};

/**
 * .what = asserts a freshly minted temp dir name parses back through every reader
 * .why = a name the readers cannot parse turns the age gate OFF silently — every
 *        reader preserves what it cannot read, so the leak looks like a green run.
 *        this catches that at the mint, before a single dir exists
 */
const assertTempDirNameParses = (input: {
  dirName: string;
  run: string | null;
}): void => {
  // the age gate reads the timestamp; an unparseable name is preserved forever
  if (!asTempDirTimestamp({ dirName: input.dirName }))
    UnexpectedCodePathError.throw(
      'minted a temp dir name whose timestamp does not parse back',
      { dirName: input.dirName, hint: 'the mint and the parse have diverged' },
    );

  // .note = there is NO second check that `isTempDir` agrees, and its absence is
  //         the design. both readers share TEMP_DIR_PATTERN, so a name whose
  //         timestamp parses cannot be a name isTempDir rejects — such a check
  //         could never fail, and an unreachable check is worse than none: it
  //         answers the question a reviewer would otherwise ask. should isTempDir
  //         ever grow a condition beyond the grammar, that change owes this
  //         assert back

  // the reclaim reads the run stamp; a stamp it cannot read reaps no dir
  const runParsed = asTempDirRun({ dirName: input.dirName });
  if (runParsed === input.run) return;

  // .note = 🔴 there is NO branch here for "the slug was shaped like a run stamp",
  //         and its absence is the point of the mandatory run slot. an optional
  //         slot would force the reader to find the run by position and confirm it
  //         by shape, so a slug at that position that merely LOOKED like an id
  //         would read as one — and this function would have to reject the
  //         consumer's own slug to keep the reclaim correct. with the slot always
  //         emitted, the slug can never occupy the run's position, so the
  //         collision is unreachable rather than caught
  //         (`rule.prefer.prevent-over-correct`, rung 1 over rung 3)

  UnexpectedCodePathError.throw(
    'minted a temp dir name whose run stamp does not parse back',
    {
      dirName: input.dirName,
      runStamped: input.run,
      runParsed,
      hint: 'a run id must match r[a-f0-9]{8}',
    },
  );
};

/**
 * .what = reads the timestamp out of a temp directory name
 * .why = enables age calculation for prune decisions
 *
 * .note = `as*`, never `parse*` — a cast from one shape to another is a transformer,
 *         and `as` is this repo's ONE sanctioned cast prefix. it groups with
 *         `asTempDirRun` under one autocomplete stem besides
 */
export const asTempDirTimestamp = (input: { dirName: string }): Date | null => {
  // extract timestamp portion — through the ONE shared grammar, never a copy of it
  const match = input.dirName.match(TEMP_DIR_PATTERN);
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

/**
 * .what = reads the run stamp out of a temp directory name
 * .why = the reclaim matches on it, so a run reaps its own dirs and no peer's
 *
 * @returns the run id, or null when no run minted the dir
 *
 * .note = 🔴 it reads the run out of the shared grammar's SECOND GROUP, never by
 *         `split('.')` and an index. a positional form must shape-test what it
 *         finds to decide whether it is a stamp or a slug, which makes a run-shaped
 *         slug indistinguishable from a run. one match yields both the timestamp
 *         and the run, so the two facts cannot disagree
 *
 * @example
 * asTempDirRun({ dirName: '2026-01-19T12-34-56.789Z.r7f3a91c2.my-test.a1b2c3d4' });
 * // => 'r7f3a91c2'
 *
 * @example
 * // the run slot holds `_`, so no run minted it
 * asTempDirRun({ dirName: '2026-01-19T12-34-56.789Z._.my-test.a1b2c3d4' });
 * // => null
 *
 * @example
 * // a legacy name, minted before the slot existed — no run either way
 * asTempDirRun({ dirName: '2026-01-19T12-34-56.789Z.my-test.a1b2c3d4' });
 * // => null
 *
 * @example
 * // a SLUG shaped like a run id is no longer read as one — it cannot occupy the
 * // run's position, because the run's position is always filled
 * asTempDirRun({ dirName: '2026-01-19T12-34-56.789Z._.r7f3a91c2.a1b2c3d4' });
 * // => null
 */
export const asTempDirRun = (input: { dirName: string }): string | null => {
  const match = input.dirName.match(TEMP_DIR_PATTERN);

  // group 2 is absent on a legacy name, and `_` on a name that names no run;
  // both mean the same fact, so both read back as null
  const runSlot = match?.[2];
  if (!runSlot) return null;
  if (runSlot === RUN_SLOT_NONE) return null;

  return runSlot;
};
