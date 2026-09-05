import type { Residue } from './Residue';

/**
 * .what = the record a run leaves so a LATER run can tell what became of it
 * .why = a teardown is structurally blind to its own absence — it cannot report
 *        that it never ran. a marker written ahead of each stage turns that
 *        absence into a positive record the next run's setup can read
 *
 * .note = the DECLARATION lives here and its readers/writers live in
 *         `domain.operations/genTempDir/runMarker.ts`. this repo puts a type-led
 *         module in `domain.objects/` (PascalCase — SlowtestBlock, SlowtestConfig,
 *         SlowtestReport) and names an operations file after the OPERATION it holds
 *         (7 of 7 in genTempDir/). a file that held both had no precedent either way
 */
export interface RunMarker {
  /** the run id this marker belongs to */
  run: string;

  /** the pid of the process that minted it — the liveness discriminator */
  pid: number;

  /** when the run began, iso */
  startedAt: string;

  /**
   * how far the run got
   *
   * - open    = the run began; its teardown has not started
   * - partial = the teardown BEGAN. written AHEAD of the reclaim, so it says no word
   *             about whether residue was met — read `residue` for that:
   *               residue empty     → it began and did not finish
   *               residue non-empty → it finished and could not remove those paths
   * - held    = the teardown ran and deliberately kept the dirs (TEST_FNS_KEEP)
   *
   * .note = each state is written AHEAD of the work it describes. a pre-empted
   *         process gets no second write, so a state written after the fact
   *         would never land
   *
   * .note = 🔴 that AHEAD rule is why `partial` cannot mean "met residue", and it is
   *         easy to break in one direction for two separate reasons:
   *
   *           1. write `partial` AFTER the reclaim returns → a process killed
   *              mid-rmSync leaves `open`
   *           2. write it after the BROKEN-CHAIN GUARD, which throws by design →
   *              a run whose mint chain broke also leaves `open`
   *
   *         either way the next run tells its human "its teardown never ran", so
   *         they audit a config that was never at fault while the cause sits in a
   *         file mode or a runner upgrade. the rule is about the PROCESS END, not
   *         about the reclaim — so the stamp goes ahead of EVERY way the teardown
   *         can end, a deliberate throw included. the state a mechanism writes
   *         about itself is true only where it is written while it can still write
   *
   * .note = there is no `closed` state, and its absence is the design rather than
   *         an omission. a clean reclaim settles the marker by REMOVAL, because the
   *         wish's count is of ENTRIES rather than of dirs — a terminal state
   *         written to disk would leave one file per clean run, forever, on the
   *         common path. so the settled machine is:
   *
   *           open ──┬─→ partial  (residue; the NEXT run reports it)
   *                  ├─→ held     (TEST_FNS_KEEP; the age gate reclaims it)
   *                  └─→ ⌀        (removed; the clean settle)
   *
   *         an absent marker and a `closed` one are indistinguishable to every
   *         reader we have — the arrears check reads only markers that EXIST — so
   *         the state would have cost a file and bought no diagnosis
   */
  state: 'open' | 'partial' | 'held';

  /**
   * when a later run first reported this marker as arrears, iso; null until then
   *
   * .why = the arrears predicate (unsettled AND process gone) holds for as long
   *        as the residue does, so without this stamp EVERY later run would name
   *        the same casualty. one residue, one report
   */
  reportedAt: string | null;

  /** the residue a `partial` teardown could not remove; empty otherwise */
  residue: Residue[];

  /**
   * whether a teardown was wired when this run began
   *
   * .why = it turns "no dir was reclaimed" from a class of cause into a SPECIFIC
   *        one. the setup is handed the runner's own config, so it can see whether
   *        a teardown exists — and a half-wired config is a cause with evidence,
   *        which is the only kind the arrears report is allowed to name outright
   *
   * .note = it is REQUIRED of every caller, never defaulted. this field IS the
   *         evidence, so a default would fabricate the very fact it exists to
   *         establish — and it would fabricate it toward `true`, which routes a
   *         genuinely half-wired run into the vague class-of-cause branch and
   *         hides the one cause we could have named outright
   */
  teardownWired: boolean;
}
