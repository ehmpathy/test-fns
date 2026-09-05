// .note = RELATIVE, never the @src alias. this module sits on the globalSetup
//         path, which jest loads OUTSIDE its moduleNameMapper

import * as fs from 'node:fs';
import { asTempDirRun } from '../computeTempDirName';
import { getAllRunMarkers, type RunMarker } from '../runMarker';
import { isProcessGone } from './isProcessGone';

/**
 * .what = one run whose teardown never settled, and whose process is gone
 * .why = a teardown is structurally blind to its OWN absence. this is the one
 *        fact it could never report about itself, so a later run reports it
 */
export interface RunArrears {
  /** the marker of the run that never settled */
  marker: RunMarker;

  /**
   * how we know the run is over
   *
   * - process-gone = its pid no longer answers; certain
   * - aged-out     = the liveness question could not be asked, so age decided it
   */
  evidence: 'process-gone' | 'aged-out';

  /**
   * how many temp dirs that run left on disk, counted at this pass
   *
   * .why = 🔴 the SCALE is the fact a human acts on, and the report had only the
   *        RUN count. "1 prior test run never reclaimed its temp dirs" reads the
   *        same whether that run left 3 dirs or 12,000 — and an invisible accrual
   *        of scale is the exact defect this whole behavior exists to end. the
   *        12,369 dirs that motivated it accrued one silent run at a time
   *
   * .note = counted per pass rather than stored in the marker, and deliberately.
   *         a marker is written by a process that may be pre-empted mid-run, so a
   *         count IT recorded would be the count at its last write, never the count
   *         now. the age gate may also have taken some since. this reads the disk
   */
  countDirs: number;
}

/**
 * .what = the account of one arrears pass
 * .why = 🔴 an audit, never the arrears ALONE. a bare arrears list drops the markers
 *        this pass could not read — one line below `getAllRunMarkers`, whose own note
 *        says a marker we cannot parse is "yielded as null, never dropped — a silently
 *        skipped marker is a casualty no one is ever told about". the producer takes
 *        deliberate trouble to preserve them; its one consumer must not discard them
 *
 * .note = it mirrors PruneStaleAudit's shape on purpose. the age gate ALREADY reports
 *         the DIR names it cannot parse (`namesUnreadable`); for this reader to drop
 *         the MARKER names it cannot parse would leave two readers of one directory
 *         with opposite policies on unreadable input
 */
export interface RunArrearsAudit {
  /** the runs whose teardown never settled, and whose process is gone */
  arrears: RunArrears[];

  /**
   * the marker files it could not read or parse, and so could not judge
   *
   * .why = an unreadable marker is a run whose fate is UNKNOWABLE. it is the one
   *        population that both reclaims skip — the dir sweep filters files, and this
   *        check cannot parse it — so silence here makes a permanent leak invisible
   */
  namesUnreadable: string[];
}

/**
 * .what = finds the runs whose teardown never fired, and which no run has yet named
 * .why = three terms, and each removes a distinct false positive:
 *
 *        1. state ∈ {open, partial} — a run that settled cleanly REMOVED its marker,
 *           so it is invisible here by construction rather than by a filter; a `held`
 *           run chose to keep its dirs, and case=6 owns that message, so this check
 *           says no word about it
 *        2. the process is GONE — a live peer minutes into a long suite must never be
 *           slandered. no age window can separate a live peer from a dead run, because
 *           the two sit minutes apart while detection is owed in seconds
 *        3. reportedAt is null — the first two terms hold for as LONG AS THE RESIDUE
 *           DOES, so without this every later run would name the same casualty forever.
 *           a condition that never lapses is not a bound
 *
 * .note = it REPORTS and never reaps. that restraint is exactly what entitles it to
 *         ask a liveness question at all
 */
export const computeRunArrears = (input: {
  tmpDir: string;
  /** the run that runs this check; its own marker is never its own arrears */
  run: string | null;
  maxAgeMs: number;
  /**
   * the moment this check is made
   *
   * .note = REQUIRED, never defaulted. the caller reads the clock ONCE and hands
   *         the same instant to every step of the report, so the age a marker is
   *         judged by and the `reportedAt` it is stamped with cannot disagree.
   *         a `?? new Date()` here would read the clock a SECOND time — which makes
   *         the seam that exists to control time the very cause that splits it
   */
  now: Date;
}): RunArrearsAudit => {
  const now = input.now;
  const entries = getAllRunMarkers({ tmpDir: input.tmpDir });

  // a marker we could not judge is PRESERVED and REPORTED, never dropped in silence
  //
  // .note = 🔴 filtered on the FAULT, never on `marker === null`. the two part
  //         company on exactly the benign case: a marker that VANISHED between the
  //         readdir and the read yields a null marker with NO fault, and it must not
  //         be reported — no entry remains for a human to act on, and a line that
  //         says otherwise sends them to hunt a file that is already gone
  //
  // .note = each name is prefixed with its cause, so `EACCES: run.x.marker.json` and
  //         `unparseable: run.y.marker.json` read as the different problems they are.
  //         a bare name told every reader the same story whatever went wrong
  const namesUnreadable = entries
    .filter((entry) => entry.fault !== null)
    .map((entry) => `${entry.fault}: ${entry.name}`);

  // the dirs on disk right now, tallied by the run that stamped them
  //
  // .note = ONE readdir for every arrears entry, never one per entry. the pass
  //         already runs on the setup path of every invocation, and the wish
  //         records a ripgrep over this same tree that blew a 20s timeout on
  //         directory count alone — so a scan per casualty is the shape to avoid
  //
  // .note = it matches through `asTempDirRun`, the same PARSE the run-scoped
  //         reclaim uses, never a loose text test. a slug that merely CONTAINS a
  //         run id would be miscounted by the loose form, and this number is about
  //         to be handed to a human as a fact
  const countDirsByRun = ((): Map<string, number> => {
    const counts = new Map<string, number>();
    if (!fs.existsSync(input.tmpDir)) return counts;
    for (const entry of fs.readdirSync(input.tmpDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const run = asTempDirRun({ dirName: entry.name });
      if (run === null) continue;
      counts.set(run, (counts.get(run) ?? 0) + 1);
    }
    return counts;
  })();

  const arrears = entries
    .map((entry) => entry.marker)
    .filter((marker): marker is RunMarker => !!marker)
    .filter((marker) => marker.run !== input.run)
    .filter((marker) => marker.state === 'open' || marker.state === 'partial')
    .filter((marker) => marker.reportedAt === null)
    .map((marker): RunArrears | null => {
      const countDirs = countDirsByRun.get(marker.run) ?? 0;

      // term 2 — the process itself is the discriminator, never a clock
      const gone = isProcessGone({ pid: marker.pid });
      if (gone === true) return { marker, evidence: 'process-gone', countDirs };
      if (gone === false) return null;

      // the question could not be answered; fall back to the age window
      const ageMs = now.getTime() - Date.parse(marker.startedAt);
      if (Number.isNaN(ageMs) || ageMs <= input.maxAgeMs) return null;
      return { marker, evidence: 'aged-out', countDirs };
    })
    .filter((entry): entry is RunArrears => !!entry);

  return { arrears, namesUnreadable };
};
