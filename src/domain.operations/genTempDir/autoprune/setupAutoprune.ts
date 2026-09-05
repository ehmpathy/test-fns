// .note = RELATIVE, never the @src alias. this module sits on the globalSetup
//         path, which a runner loads OUTSIDE its moduleNameMapper
import { GATE_SWEPT_ENV_KEY, genRunId, RUN_ID_ENV_KEY } from '../getOneRunId';
import { getOneTempDirRoot } from '../getOneTempDirRoot';
import {
  getOneMaxAgeMs,
  pruneStale,
  reportStaleResidue,
  reportUnreadableNames,
} from '../pruneStale';
import { genRunMarkerOpen, setRunMarker } from '../runMarker';
import { reportRunArrears } from './reportRunArrears';

/**
 * .what = mints this run's id and marker, reports prior arrears, sweeps aged entries
 * .why = the id must be minted BEFORE the runner forks its workers, because a
 *        worker inherits only a COPY of the env that existed at fork. a module-level
 *        registry cannot serve — the module registry resets per test file
 *
 * .note = the marker is written AHEAD of the tests, so a process killed mid-suite
 *         leaves the truthful `open` record rather than no record at all
 */
export const setupAutoprune = async (input: {
  /**
   * whether this runner config also wires the autoprune teardown
   *
   * .why = the adapter is handed the runner's own config, so it can SEE whether a
   *        teardown exists. that turns a half-wired config from a guess into a
   *        cause with evidence — the only kind the arrears report may name outright
   *
   * .note = REQUIRED, never defaulted. this value IS the evidence, so a default
   *         would manufacture the fact it exists to record — and toward `true`,
   *         which is the value that SILENCES the half-wired diagnosis
   */
  teardownWired: boolean;
}): Promise<void> => {
  const { pathPhysical } = getOneTempDirRoot();
  const maxAgeMs = getOneMaxAgeMs();

  // 1 — mint a FRESH id onto the main env, before any fork
  // .note = it never reuses an INHERITED id, and that is a loss guard rather than
  //         a preference. a child process spawned from within a run inherits our
  //         env — so a consumer whose test drives a nested runner would have the
  //         CHILD's teardown reap the PARENT's live fixture dirs, mid-run. reuse
  //         buys an idempotency a once-per-invocation global hook does not need,
  //         and pays for it in the one failure mode this design keeps off the
  //         table everywhere else. a fresh id makes the nested reap unreachable
  const run = genRunId();
  process.env[RUN_ID_ENV_KEY] = run;

  // 2 — write the marker BEFORE the work it describes
  setRunMarker({
    tmpDir: pathPhysical,
    marker: genRunMarkerOpen({ run, teardownWired: input.teardownWired }),
  });

  // 3 — the ARREARS check: name the runs whose teardown never fired. it reports,
  //     and reaps not one dir; the age gate below owns the residue
  // .note = the clock is read ONCE for the whole setup and handed down — so the age
  //         a marker is judged by, the `reportedAt` it is stamped with, and the
  //         sweep stamp of step 5 are all the same instant
  const now = new Date();
  reportRunArrears({ tmpDir: pathPhysical, run, maxAgeMs, now });

  // 4 — the AGE GATE, here rather than only on genTempDir, so a run that allocates
  //     no dir still sweeps
  //
  // .note = 🔴 this is a THIRD independent `readdirSync` of the same directory, and
  //         it is not free. step 3 makes two passes of its own (`getAllRunMarkers`
  //         for the marker files, `countDirsByRun` for the dirs) and hands neither
  //         down.
  //
  //         the three are left as three, deliberately: each reads a different slice
  //         through a different parse, and a merge is a real refactor across three
  //         modules — out of this behavior's bound. it is carried to the wisher as
  //         one item, beside the scan-cost question generally
  const audit = await pruneStale({ tmpDir: pathPhysical, maxAgeMs });
  reportStaleResidue({ audit });

  // 5 — record that the gate SWEPT, so a worker's `genTempDir` skips its own pass
  //
  // .why = the fact a worker needs is "a sweep happened", and until now it had to
  //        infer that from "a run id exists" — a proxy that holds only while these
  //        two steps stay in one function. the stamp is written AFTER the sweep it
  //        describes, so a setup pre-empted mid-sweep leaves no claim that it ran
  process.env[GATE_SWEPT_ENV_KEY] = now.toISOString();

  // a name the age gate cannot parse is PRESERVED — correct, since we may not have
  // minted it — but never in SILENCE (case=14, E4). the render lives beside the
  // gate that produces the audit, never inline here: it is one of a family of three
  // and the other two were already renderers, for the reason `reportStaleResidue`
  // records — a message a human reads is a contract, and a contract wants a seam
  reportUnreadableNames({ audit, tmpDir: pathPhysical });
};
