// .note = RELATIVE, never the @src alias. this module sits on the globalSetup +
//         globalTeardown path, which jest loads OUTSIDE its moduleNameMapper

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Residue } from '../../domain.objects/Residue';
import {
  asErrnoCode,
  ERRNOS_ENTRY_ABSENT,
} from '../../infra/isomorph.fs/asErrnoCode';
import { asCountAgreement } from './asCountAgreement';
import { asErrno } from './asErrno';
import { computeStaleDirs, type DirEntry } from './computeStaleDirs';
import { getOneGateSweptAt } from './getOneRunId';
import { isRunMarkerName } from './runMarker';
import { sayReport } from './sayReport';

/**
 * the default age past which a temp entry is reclaimed
 *
 * .why = 24 hours. a wider window buys only a MARGIN AGAINST A GUESS, and this
 *        gate need not guess: the run marker records a pid and a start time, so
 *        ownership has an answer.
 *
 * .note = the gate is the BACKSTOP, not the policy. the policy is the run's own
 *         teardown, which reclaims within the run. this catches what a signal, an
 *         OOM, or an unhooked consumer leaves behind
 */
export const MAX_AGE_MS_DEFAULT: number = 24 * 60 * 60 * 1000;

/**
 * the env key a consumer sets to widen or narrow the gate
 *
 * .why = a suite that genuinely runs long, or a human who inspects a held dir
 *        across a weekend, needs more than a day. the window is a default, not a law
 */
export const MAX_AGE_ENV_KEY = 'TEST_FNS_MAX_AGE_MS';

/**
 * in-memory flag to ensure prune runs at most once per process
 *
 * .why = prevents redundant filesystem scans when genTempDir is called
 *        many times in quick succession (e.g., parallel tests)
 */
let prunedThisProcess = false;

/**
 * .what = the account of one age-gate pass
 * .why = a caller must be able to assert what the gate took and what resisted;
 *        a gate that reports only "done" cannot be told from one that never fired
 */
export interface PruneStaleAudit {
  /** the aged dirs it removed */
  dirsReclaimed: string[];

  /** the aged run markers it removed */
  markersReclaimed: string[];

  /** what it could not remove, each with the reason */
  residue: Residue[];

  /**
   * the dir names it could not parse, and so preserved
   *
   * .why = a mint that produces unparseable names turns this gate OFF, and every
   *        run still looks green. the count is the only signal that would show it
   */
  namesUnreadable: string[];
}

/**
 * .what = reads the configured max-age window
 * .why = the default is 24h; a consumer may widen it for a long suite
 *
 * .note = maxAge, never staleAge. the THRESHOLD is a max age; the dirs PAST it
 *         are stale. one concept, one word (`rule.require.ubiqlang`)
 */
export const getOneMaxAgeMs = (): number => {
  const value = process.env[MAX_AGE_ENV_KEY];
  if (!value) return MAX_AGE_MS_DEFAULT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_AGE_MS_DEFAULT;
  return parsed;
};

/**
 * .what = removes entries older than threshold from tmpDir — dirs AND run markers
 * .why = reclaims disk space from stale test directories, and from the markers of
 *        runs that were pre-empted before their own teardown could settle them
 *
 * .note = TWO passes, and the second is not optional. a marker is a FILE, so the
 *         dir pass skips it by construction — without an explicit marker pass, a
 *         pre-empted run's marker would survive forever and the guard against a
 *         leak would itself leak
 *
 * @returns the audit; it never throws on a single entry it cannot remove
 */
export const pruneStale = async (input: {
  tmpDir: string;
  maxAgeMs?: number;
}): Promise<PruneStaleAudit> => {
  const maxAgeMs = input.maxAgeMs ?? getOneMaxAgeMs();
  const audit: PruneStaleAudit = {
    dirsReclaimed: [],
    markersReclaimed: [],
    residue: [],
    namesUnreadable: [],
  };

  // a root that does not exist holds no entry to reclaim
  if (!fs.existsSync(input.tmpDir)) return audit;

  const entries = fs.readdirSync(input.tmpDir, { withFileTypes: true });
  const now = new Date();

  // pass 1 — the aged fixture dirs, keyed on the timestamp in their name
  const dirs: DirEntry[] = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(input.tmpDir, entry.name),
    }));
  const judged = computeStaleDirs({ dirs, maxAgeMs, now });
  audit.namesUnreadable = judged.unreadable.map((dir) => dir.name);
  for (const dir of judged.stale) {
    if (rmOrRecord({ path: dir.path, audit }))
      audit.dirsReclaimed.push(dir.name);
  }

  // pass 2 — the aged run markers, keyed on their mtime
  // .note = AGE-bounded, never STATE-bounded. an `open` marker is the arrears
  //         check's only evidence, so an eager sweep of open markers would delete
  //         the very input that names a casualty
  const namesMarker = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => isRunMarkerName({ name }));
  for (const name of namesMarker) {
    const pathMarker = path.join(input.tmpDir, name);
    if (!isAged({ path: pathMarker, maxAgeMs, now })) continue;
    if (rmOrRecord({ path: pathMarker, audit }))
      audit.markersReclaimed.push(name);
  }

  return audit;
};

/**
 * .what = removes one entry, recording the reason when it resists
 * .why = the extant gate SWALLOWED every rmSync throw, so a permanently stuck
 *        dir looked exactly like a clean sweep. an unreported failure is the
 *        defect this behavior exists to end (rule.forbid.failhide)
 *
 * @returns true when the entry is gone
 */
const rmOrRecord = (input: {
  path: string;
  audit: PruneStaleAudit;
}): boolean => {
  try {
    fs.rmSync(input.path, { recursive: true, force: true });
    return true;
  } catch (error) {
    input.audit.residue.push({ path: input.path, errno: asErrno({ error }) });
    return false;
  }
};

/**
 * .what = speaks the age gate's residue to the human, or says no word when clean
 * .why = ONE renderer for two triggers — the unhooked one here, the enhooked one in
 *        the setup adapter. the same gate reports the same audit, so a second copy
 *        of these lines would be a second voice free to drift with no signal at
 *        all. a message a human reads is a contract like any other
 *
 * .note = it takes the audit rather than the lines, so a caller cannot report a
 *         residue it did not receive
 */
export const reportStaleResidue = (input: { audit: PruneStaleAudit }): void => {
  if (input.audit.residue.length === 0) return;

  // .note = the count and its pronouns, so the render agrees at one as well as at
  //         many. a count-free header ("every aged entry") is never wrong and never
  //         informative, and a fixed `them` reads broken at a count of one
  const agreed = asCountAgreement({
    count: input.audit.residue.length,
    one: 'aged entry',
    many: 'aged entries',
  });

  sayReport({
    lines: [
      `🧹 test-fns: the temp-dir age gate could not reclaim ${agreed.phrase}.`,
      ...input.audit.residue.map(
        (entry) => `   ├─ ${entry.errno}: ${entry.path}`,
      ),
      `   └─ fix: remove ${agreed.them} by hand, or widen access to ${agreed.them}.`,
    ],
  });
};

/**
 * .what = speaks the names the age gate could not parse, or says no word when none
 * .why = a name the gate cannot read is PRESERVED — correct, since we may not have
 *        minted it — but never in SILENCE. an unreadable name is the one shape that
 *        makes a dir immortal: no run's id claims it, and no age check can read it,
 *        so it is the exact residue class a human must be told about (case=14, E4)
 *
 * .note = it lives HERE, beside `reportStaleResidue`, rather than inline in the
 *         setup adapter that calls it. it is the third member of one message family
 *         — "N entries could not be read, here they are, remove them by hand" — and
 *         a named renderer is what lets a snapshot exercise it directly. an inline
 *         render is a contract no test can reach without it drives the whole
 *         operation around it
 *
 * .note = it takes the AUDIT rather than the lines, so a caller cannot report a set
 *         of names it did not receive
 */
export const reportUnreadableNames = (input: {
  audit: PruneStaleAudit;
  /** the root the names sit in — the address the human is sent to */
  tmpDir: string;
}): void => {
  if (input.audit.namesUnreadable.length === 0) return;

  const agreed = asCountAgreement({
    count: input.audit.namesUnreadable.length,
    one: 'temp-dir name',
    many: 'temp-dir names',
  });

  sayReport({
    lines: [
      `🧹 test-fns: ${agreed.phrase} could not be read, so the age gate preserved ${agreed.them}.`,
      ...input.audit.namesUnreadable.map((name) => `   ├─ ${name}`),
      `   └─ fix: remove ${agreed.them} by hand — no mechanism will ever reclaim ${agreed.them}, at ${input.tmpDir}.`,
    ],
  });
};

/**
 * .what = tells whether a file is older than the window
 * .why = a marker carries no timestamp in its NAME, so its mtime is the age
 */
const isAged = (input: {
  path: string;
  maxAgeMs: number;
  now: Date;
}): boolean => {
  const stat = ((): fs.Stats | null => {
    try {
      return fs.statSync(input.path);
    } catch (error) {
      // 🔴 ALLOWLIST, never a bare catch. exactly one class of error is benign
      // here: the entry vanished between our readdir and this stat, which a PEER's
      // teardown causes routinely — for that one, "not aged" is the right answer,
      // since no entry remains to reclaim.
      //
      // every other code is a real fault. an EACCES on the scope dir means the gate
      // — the UNHOOKED consumer's only reclaim — silently stops work, and a
      // swallowed fault reads exactly like a clean pass (`rule.forbid.failhide`)
      if (!ERRNOS_ENTRY_ABSENT.includes(asErrnoCode({ error }) ?? ''))
        throw error;
      return null;
    }
  })();
  if (!stat) return false;
  return input.now.getTime() - stat.mtimeMs > input.maxAgeMs;
};

/**
 * .what = runs pruneStale at most once per RUN, and reports what resisted
 * .why = prevents redundant filesystem scans across multiple genTempDir calls
 *
 * .note = this is the UNHOOKED consumer's only reclaim, so it must not block the
 *         genTempDir call that triggers it. an enhooked consumer fires the gate
 *         once at their global setup instead, where it CAN be awaited
 *
 * .note = it never swallows. a residue the gate cannot take is reported to stderr
 *         rather than hidden — silence here is what lets dirs accrue unseen
 *
 * .note = the skip is decided HERE, never by the caller. this operation knows its
 *         own sweep state, so every call site is unconditional
 *         (`rule.require.fewer-paths-via-idempotency`: do not branch around an
 *         operation — make the operation safe, then collapse the path)
 */
export const pruneStaleOnce = async (input: {
  tmpDir: string;
  maxAgeMs?: number;
}): Promise<void> => {
  // skip if already pruned this process
  if (prunedThisProcess) return;

  // skip if this RUN's global setup already swept, in the main process before the
  // fork — the sweep state rides the env down, exactly as the run id does
  //
  // .why = this runs per WORKER, so an unconditional sweep would cost one full
  //        directory scan per worker per invocation — redundant work in the very
  //        environment this behavior exists for, where a scan over a swollen /tmp
  //        is the cost this behavior pays down. the stamp says "a sweep HAPPENED",
  //        which is the fact this skip needs; a run id would only imply it
  if (getOneGateSweptAt() !== null) return;

  // set flag before prune (prevent race conditions)
  prunedThisProcess = true;

  // fire without a block, but never without a report
  pruneStale({ tmpDir: input.tmpDir, maxAgeMs: input.maxAgeMs })
    .then((audit) => reportStaleResidue({ audit }))
    .catch((error: unknown) => {
      // 🔴 the `fix:` line names an ACTION, as its four peer messages each do
      // ("remove them by hand", "widen access", "add the autoprune teardown").
      // a consequence ("temp dirs accrue until this is repaired") is not a fix and
      // leaves the reader with no move to make — least of all here, in the message
      // for the WORST failure, the gate itself down. the consequence gets its own
      // line, because the severity is real and the reader must weigh it
      //
      // 🔴 and the `cause:` line renders the RAW error, where its peer messages
      //    render a hand-shaped `ERRNO: <path>`. that asymmetry is deliberate, and
      //    this is the one branch where it is correct: a peer reports a fault on a
      //    dir we CLASSIFIED, so it holds both the errno and the path and can shape
      //    them. this branch is the gate itself down, on ANY fs errno — even ones
      //    we have never met — so the raw string is the only render that cannot
      //    drop the detail an unanticipated fault needs. a hand-shaped form here
      //    would have to guess at a shape it does not know
      sayReport({
        lines: [
          `🧹 test-fns: the temp-dir age gate failed to run over ${input.tmpDir}.`,
          `   ├─ cause: ${String(error)}`,
          '   ├─ fix: restore access to that path, or remove it — we remake it.',
          '   └─ until then temp dirs accrue there, reclaimed by no mechanism.',
        ],
      });
    });
};

/**
 * .what = resets the prune throttle flag
 * .why = enables tests to verify throttle behavior
 *
 * @internal - only for test use
 */
export const resetPruneThrottle = (): void => {
  prunedThisProcess = false;
};

/**
 * .what = checks if prune has run this process
 * .why = enables tests to verify throttle behavior
 *
 * @internal - only for test use
 */
export const hasPrunedThisProcess = (): boolean => {
  return prunedThisProcess;
};
