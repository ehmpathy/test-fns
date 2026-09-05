import { BadRequestError } from 'helpful-errors';
import { v4 as uuid } from 'uuid';

/**
 * the env key that carries a run id from the runner's global setup to its workers
 *
 * .why = probe evidence says a worker inherits a copy of the main env at fork,
 *        so the id must be minted BEFORE the fork and ride the env down. a
 *        module-level registry cannot serve — the module registry resets per
 *        test file, so an in-memory record is forgotten between files
 */
export const RUN_ID_ENV_KEY = 'TEST_FNS_RUN';

/**
 * the shape a run id takes, as an UNANCHORED grammar fragment: `r` + 8 hex
 *
 * .why = the dir-name grammar must embed this shape at its run slot, and a regex
 *        cannot embed an anchored pattern. so the fragment is the source of truth
 *        and `RUN_STAMP_PATTERN` derives from it — rather than the two holding
 *        character-identical copies of one shape, which is the exact split
 *        TEMP_DIR_PATTERN was consolidated to make unreachable
 *
 * .note = the alternative was to strip the anchors off `RUN_STAMP_PATTERN.source`
 *         at the embed site, which is decode-friction over a value we own
 *         (`rule.forbid.inline-decode-friction`)
 */
export const RUN_STAMP_GRAMMAR = 'r[a-f0-9]{8}';

/**
 * the shape a run id takes: `r` + 8 hex, anchored
 *
 * .why = it lives HERE, beside the mint that produces it, because the two facts
 *        must agree and a reader must not have to find the second one. a grammar
 *        one module away from its mint lets a change to the id's length break the
 *        parse from a file that never mentions it
 *
 * .note = `TEMP_DIR_PATTERN` sits in isTempDir on the same argument — a grammar
 *         belongs beside what it grades
 */
export const RUN_STAMP_PATTERN: RegExp = new RegExp(
  `^${RUN_STAMP_GRAMMAR}$`,
  'i',
);

/**
 * the env key that carries "this run's global setup already swept the age gate"
 * from the runner's main process down to its workers
 *
 * .why = it records the ACT, never a proxy for it. a run id would read as "the
 *        gate already ran" only because one function happens to do both — two
 *        facts that merely coincide, and a proxy free to drift from the fact it
 *        stands for is a latent defect
 *
 * .note = it rides the env for the same reason the run id does: a worker inherits
 *         a copy of the main env at fork, and a module registry resets per file
 */
export const GATE_SWEPT_ENV_KEY = 'TEST_FNS_GATE_SWEPT';

/**
 * .what = reads whether this run's global setup already swept the age gate
 * .why = lets `pruneStaleOnce` decide its own skip, so its caller needs no branch
 *        (`rule.require.fewer-paths-via-idempotency`)
 *
 * @returns the instant of the sweep, or null when no sweep is on record
 *
 * .note = it returns the STAMP rather than a boolean, so a later change can expire
 *         it — a watch-mode session alive for days sweeps once today, and the
 *         instant is the only fact that would let that be reconsidered
 */
export const getOneGateSweptAt = (): string | null =>
  process.env[GATE_SWEPT_ENV_KEY] ?? null;

/**
 * .what = mints a fresh run id
 * .why = a run reclaims exactly the dirs its own id stamps, so the id must be
 *        unique per runner invocation and cheap to compare
 *
 * .note = the 8-hex expression here matches computeTempDirName's uniqueness
 *         suffix by COINCIDENCE, never by contract — that suffix answers "is this
 *         dir distinct", this answers "whose run is this". they are free to differ,
 *         so a shared generator would couple two facts that are meant to be
 *         independent (rule.prefer.wet-over-dry)
 *
 * @example
 * genRunId(); // => 'r7f3a91c2'
 */
export const genRunId = (): string =>
  `r${uuid().replace(/-/g, '').slice(0, 8)}`;

/**
 * .what = reads the run id this process belongs to, if it belongs to one
 * .why = genTempDir stamps its dirs with it, so the run's own teardown can
 *        reclaim exactly those and no peer's
 *
 * @returns the run id, or null when no runner minted one (an unhooked consumer)
 *
 * .note = 🔴 the value is VALIDATED here, at the boundary it enters through, and
 *         that placement is the whole point. `process.env` is foreign input — a
 *         stale `export TEST_FNS_RUN=` in a shell, a ci system that sets it, or a
 *         human who read the readme and took it for a knob. unchecked, a bad value
 *         rides two modules down to `computeTempDirName`, whose assert throws
 *         `minted a temp dir name whose run stamp does not parse back` — a message
 *         that blames OUR mint for THEIR env, and sends them to audit a library
 *         internal over a variable they set. validated where it enters, the error
 *         names the variable, the value, and the fix
 *         (`rule.require.failfast`, `rule.require.errors-name-the-fix`)
 */
export const getOneRunId = (): string | null => {
  const value = process.env[RUN_ID_ENV_KEY];
  if (!value) return null;

  if (!RUN_STAMP_PATTERN.test(value))
    BadRequestError.throw(
      `test-fns: ${RUN_ID_ENV_KEY} is set, but is not a run id`,
      {
        [RUN_ID_ENV_KEY]: value,
        expected: String(RUN_STAMP_PATTERN),
        hint:
          `unset ${RUN_ID_ENV_KEY} — the autoprune setup mints it for you at the ` +
          'start of each run, so a value set by hand or left over from an earlier ' +
          'shell will stamp temp dirs that no reclaim can read.',
      },
    );

  return value;
};
