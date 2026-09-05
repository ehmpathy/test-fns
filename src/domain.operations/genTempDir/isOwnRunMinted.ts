// .note = RELATIVE, never the @src alias. this module is reached from the allocation
//         path, which a runner's global hooks load OUTSIDE its moduleNameMapper
import { getAllRunMarkers, type RunMarker } from './runMarker';

/** the answer, memoized — see the `.note` on the memo below */
let mintedThisProcess: boolean | null = null;

/**
 * .what = tells whether OUR OWN invocation's setup minted a run, despite this
 *         process holding no run id
 * .why = 🔴 it is the ONE discriminator between two cells that SHARE A SYMPTOM and
 *        must never share a message:
 *
 *          no run id + no marker of ours  →  a genuinely unhooked consumer. their
 *                                            config is at fault; name the two keys
 *          no run id + a marker of OURS   →  our setup DID run for this very
 *                                            invocation, and the id failed to reach
 *                                            this process. a BROKEN MINT CHAIN —
 *                                            OUR defect, reported loudly and
 *                                            correctly by the teardown's own guard
 *
 *        by ENV those two states are identical, which is why the unhooked notice
 *        fired on both: it told a consumer to add config they had already added,
 *        and blamed them for a defect of ours. `case=10`'s demo forbids exactly
 *        that — *"the two cells share a symptom and must never share a message."*
 *
 *        the env cannot tell them apart. the DISK can, and it is already ours to
 *        read: a marker is written ONLY by our own setup
 *
 * .note = 🔴 the test is PID LINEAGE, never "is some run live". a coarser form —
 *         *any* marker whose process still answers — silences the notice for an
 *         unhooked consumer who merely runs beside a wired peer in the same scope,
 *         and this repo's own acceptance children proved it: they spawn beneath a
 *         live wired parent, and every unhooked case went silent.
 *
 *         a marker's `pid` is the process that ran the setup. our own invocation's
 *         setup is therefore either THIS process (a `--runInBand` run, or a vitest
 *         thread pool that shares one pid) or our PARENT (the fork the runner made
 *         to carry us). a peer's runner is neither, by construction — so the false
 *         positive is excluded rather than filtered (`rule.prefer.prevent-over-correct`)
 *
 * .note = the STATE is not read at all, and that is deliberate. `held`, `partial`,
 *         and `open` alike prove the setup ran; the question here is provenance,
 *         never progress
 *
 * .note = the answer is MEMOIZED per process, and it may be: a process cannot
 *         change invocations mid-life. without the memo a broken chain pays one
 *         readdir per allocation, in the worker — the exact cost profile this
 *         behavior exists to avoid
 *
 * .note = the HEALTHY path never calls this at all — a run that HAS an id does not
 *         ask. so a wired consumer pays no scan whatsoever
 */
export const isOwnRunMinted = (input: { tmpDir: string }): boolean => {
  if (mintedThisProcess !== null) return mintedThisProcess;

  const pidsOurs = [process.pid, process.ppid];
  mintedThisProcess = getAllMarkersReadable({ tmpDir: input.tmpDir })
    .map((entry) => entry.marker)
    .filter((marker): marker is RunMarker => !!marker)
    .some((marker) => pidsOurs.includes(marker.pid));

  return mintedThisProcess;
};

/**
 * .what = the markers, or an empty list when the root itself cannot be listed
 * .why = 🔴 this predicate sits on the ALLOCATION path, and `getAllRunMarkers`
 *        lists the root unguarded — so a root we may not read (an EACCES from a
 *        permissions change on a shared /tmp) would throw out of `genTempDir` and
 *        break a consumer's test where a warn is the whole owed response. this
 *        behavior must not turn a leak into a failed suite
 *
 * .note = it is NOT a failhide. the fault is already reported, loudly and by the
 *         reader that owns it: the age gate lists the same root on the same call
 *         and prints *"the temp-dir age gate failed to run over <root>"* with the
 *         errno and the fix. a second report of one fault would be noise; a
 *         SWALLOWED one would be the defect
 *
 * .note = an unreadable root answers "not ours", so the unhooked notice still
 *         speaks. that is the right way to be wrong here: a root our own setup
 *         wrote a marker into is a root we can read, so an unlistable one is far
 *         more likely a genuinely unhooked consumer than a broken chain
 */
const getAllMarkersReadable = (input: {
  tmpDir: string;
}): ReturnType<typeof getAllRunMarkers> => {
  try {
    return getAllRunMarkers({ tmpDir: input.tmpDir });
  } catch {
    return [];
  }
};

/**
 * .what = clears the memoized answer
 * .why = enables tests to drive both branches in one process
 *
 * @internal - only for test use
 */
export const resetOwnRunMinted = (): void => {
  mintedThisProcess = null;
};
