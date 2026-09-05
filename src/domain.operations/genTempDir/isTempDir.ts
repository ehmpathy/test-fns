import * as path from 'node:path';
import { RUN_STAMP_GRAMMAR } from './getOneRunId';

/**
 * what the run slot holds when no run minted the dir
 *
 * .why = the slot is ALWAYS emitted, so every temp dir name has the same arity.
 *        an optional slot forces the reader to probe by position AND test by
 *        shape, which makes a slug shaped like a run id read back as one — a real
 *        collision the mint would have to reject with a bespoke error. a mandatory
 *        slot makes that collision unreachable rather than merely caught
 *        (`rule.prefer.prevent-over-correct`, rung 1 over rung 3)
 *
 * .why `_` = it cannot collide with `genRunId` (`r` + 8 hex) by construction, so
 *        no guard is owed; it costs two characters, which matters because the
 *        name is bounded by `PATH_MAX`; and it is already this repo's word for an
 *        unfilled slot (`case=_`, `._.review.`), so it adds no term
 *
 * .note = this is an ENCODING of `null`, never a run id. `asTempDirRun` reads it
 *         back as `null`, so the domain keeps one sense for one term and every
 *         downstream reclaim is untouched by the change
 */
export const RUN_SLOT_NONE = '_';

/**
 * the ONE grammar of a temp dir name, shared by every reader of one
 *
 * format: {isoTimestamp}.{run}.{slug}.{8-char-hex-uuid}
 * group 1: the timestamp, which the age gate reads
 * group 2: the run slot — a run id, or `_` when no run minted it
 *
 * .note = 🔴 the run slot is PINNED here rather than left to a `.+` catch-all, and
 *         that is the whole point of the shape. left out of the grammar, the run
 *         must be found by `split('.')` and index — a positional probe that cannot
 *         tell a run stamp from a slug that merely looks like one. pinned, both
 *         facts fall out of ONE match, and a slug may be any text at all
 *
 * .note = 🔴 the slot is optional TO READ and mandatory TO MINT, and the asymmetry
 *         is deliberate. `computeTempDirName` always emits it, so no new name can
 *         omit it — but a dir minted before the slot existed carries three segments,
 *         and a grammar that rejected those would make the age gate unable to read
 *         its own prior population. an unreadable name is PRESERVED, so a strict
 *         grammar would strand every pre-upgrade dir on disk forever — the precise
 *         outcome this behavior exists to prevent.
 *
 *         the legacy form is unambiguous to read, and provably so: the prior mint
 *         REFUSED to create a three-segment name whose slug was shaped like a run
 *         stamp (it threw `a temp dir slug may not be shaped like a run stamp`).
 *         so no legacy name can fool the optional group, and the collision that
 *         motivated this change cannot exist in the population it must still read.
 *
 *         the optional group is therefore transitional. it may be dropped once the
 *         age gate's max age has elapsed past every legacy dir — at which point the
 *         `(?: … )?` becomes dead grammar
 *
 * .note = 🔴 EXPORTED, and that is the point. this grammar decides three things at
 *         once: what the age gate reclaims, what the public `isTempDir` admits, and
 *         what a consumer's own clamp counts. held as two character-identical
 *         copies — here and in `asTempDirTimestamp` — with only prose to link them,
 *         an edit to one would silently split the three apart. a shared constant
 *         makes that divergence UNREACHABLE rather than merely detected
 *         (`rule.prefer.prevent-over-correct`, rung 1 over rung 3)
 *
 * .note = it lives HERE rather than in computeTempDirName because that module
 *         already imports this one; the reverse would close a cycle. `getOneRunId`
 *         imports neither, so the fragment it lends us closes no cycle either
 */
export const TEMP_DIR_PATTERN: RegExp = new RegExp(
  `^(\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\.\\d{3}Z)\\.(?:(${RUN_STAMP_GRAMMAR}|${RUN_SLOT_NONE})\\.)?.+\\.[a-f0-9]{8}$`,
  'i',
);

/**
 * .what = checks if a path is a temp directory created by genTempDir
 * .why = enables validation and identification of temp directories
 *
 * @example
 * // a dir an UNHOOKED run made — the run slot holds `_`
 * isTempDir({ path: '/tmp/test-fns/my-repo/.temp/2026-01-19T12-34-56.789Z._.my-test.a1b2c3d4' }); // true
 *
 * @example
 * // a dir a HOOKED run made — same arity, the run slot holds the id
 * isTempDir({ path: '/repo/.temp/genTempDir.symlink/2026-01-19T12-34-56.789Z.r7f3a91c2.my-test.a1b2c3d4' }); // true
 *
 * @example
 * // a name minted BEFORE the run slot existed — three segments, still admitted,
 * // so the age gate can still reclaim the population it made under the old shape
 * isTempDir({ path: '2026-01-19T12-34-56.789Z.my-test.a1b2c3d4' }); // true
 *
 * @example
 * // a bare NAME is admitted too, since a name is a relative path — which is what
 * // makes `readdirSync(root).filter((name) => isTempDir({ path: name }))` correct
 * isTempDir({ path: '2026-01-19T12-34-56.789Z.r7f3a91c2.my-test.a1b2c3d4' }); // true
 * isTempDir({ path: '/tmp/random' }); // false
 * isTempDir({ path: 'readme.md' }); // false — the root's own infra files never match
 */
export const isTempDir = (input: { path: string }): boolean => {
  const dirName = path.basename(input.path);
  return TEMP_DIR_PATTERN.test(dirName);
};
