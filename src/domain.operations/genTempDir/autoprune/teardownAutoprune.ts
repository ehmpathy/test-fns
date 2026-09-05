// .note = RELATIVE, never the @src alias. this module sits on the globalTeardown
//         path, which a runner loads OUTSIDE its moduleNameMapper

import type { TestRunner } from '../../../infra/isomorph.test/detectTestRunner';
import { asCountAgreement } from '../asCountAgreement';
import { asDurationHuman } from '../asDurationHuman';
import { getOneRunId } from '../getOneRunId';
import { getOneTempDirRoot } from '../getOneTempDirRoot';
import { getOneMaxAgeMs, MAX_AGE_ENV_KEY } from '../pruneStale';
import { delRunMarker, getOneRunMarker, setRunMarker } from '../runMarker';
import { sayReport } from '../sayReport';
import { getOneRunnerConfigPath } from '../warnIfUnhooked';
import { assertMintChainHeld } from './assertMintChainHeld';
import { pruneRun } from './pruneRun';

/**
 * the env key a human sets to KEEP this run's dirs for inspection
 *
 * .why = the one legitimate reason to leave residue is a human about to read it
 *
 * .note = 🔴 the hold is RUN-WIDE, never per failed test, and that is forced rather
 *         than chosen. the vision's register row 6 settled the granularity the other
 *         way — *"hold the dirs of failed tests"*, from the wish's own acceptance
 *         line — but a global teardown is handed `(globalConfig, projectConfig)` and
 *         **no test results at all**. results reach a REPORTER; in this very repo
 *         `testResults` appears in exactly one file, `SlowtestReporterJest.ts`.
 *         so row 6's answer is unreachable from the architecture the vision chose
 *         for the reclaim, and the two decisions conflict
 *
 * .note = the consequence the vision retired too early: it holds that a per-failure
 *         hatch makes the CI cell *"disappear rather than be bounded"*. it does not.
 *         a GREEN ci run with this key set holds EVERY dir — so the bound (a loud
 *         message plus the age gate) still carries load, exactly as cell 13 first said
 */
export const KEEP_ENV_KEY = 'TEST_FNS_KEEP';

/**
 * .what = reclaims exactly the dirs this run's id stamps, then settles the marker
 * .why = the guarantee lives with the allocation, so no call site can forget. and
 *        it runs once, in the main process, after every test file — a filter or a
 *        scope cannot step around it, because it is config rather than a test
 *
 * .note = it MUST be awaited by the runner. `--forceExit` calls exit(code) the
 *         instant this promise resolves, so a fire-and-forget reclaim would be
 *         killed mid-rmSync, silently, on every run
 */
export const teardownAutoprune = async (input: {
  /**
   * the runner in play
   *
   * .note = REQUIRED. this hook runs in the MAIN process, where JEST_WORKER_ID and
   *         VITEST are both unset — so env detection reports 'unknown' from exactly
   *         the one place that most needs to name a version. the adapter knows which
   *         runner it belongs to, so it must say
   */
  runner: TestRunner;
}): Promise<void> => {
  const { pathPhysical } = getOneTempDirRoot();
  const run = getOneRunId();

  // no id means our own setup never ran — say so rather than reclaim blind
  if (!run) {
    sayReport({
      lines: [
        '🧹 test-fns: the autoprune TEARDOWN ran, but its SETUP did not.',
        // 🔴 the ADDRESS. every member of this message family names the config file
        // at fault, because a cause and a fix alone leave the human to guess WHICH
        // of a repo's nine configs to edit — the gap `getOneRunnerConfigPath`'s own
        // `.why` exists to close. it is reachable here because this hook runs in
        // the MAIN process, so `process.argv` still holds the runner's own CLI, and
        // the runner is handed in as input precisely because env detection cannot
        // see it here
        `   ├─ at: ${getOneRunnerConfigPath({ runner: input.runner, argv: process.argv })}`,
        // 🔴 the cause names WHICH half is wired FIRST, then the term — the same
        // clause order its mirror in `warnIfUnhooked` uses, so one defect reads one
        // way across every message that speaks it
        '   ├─ cause: the autoprune teardown is wired, its setup is not — a half-wired config.',
        // 🔴 the PASTEABLE key, never prose. this describes THIS run's own config,
        // so it owes the exact key its mirror one module away hands over
        // (`rule.require.errors-name-the-fix`). prose is correct in exactly one
        // place — `reportRunArrears`, which describes a FOREIGN run's config it
        // does not own and cannot name a key for
        //
        // .note = `.jest` is hardcoded rather than rendered from `input.runner`,
        //         because this state is jest-ONLY by construction: vitest takes
        //         ONE `globalSetup` key whose module exports both hooks, so a
        //         vitest run that reached this teardown necessarily ran our
        //         setup too. a vitest arm would be an unreachable branch
        "   └─ fix: add `globalSetup: 'test-fns/autoprune.setup.jest'`.",
      ],
    });
    return;
  }

  const maxAgeMs = getOneMaxAgeMs();
  const markerOpen = getOneRunMarker({ tmpDir: pathPhysical, run });

  // the HOLD hatch — keep the dirs, settle the marker `held`, say where they are
  if (process.env[KEEP_ENV_KEY]) {
    if (markerOpen)
      setRunMarker({
        tmpDir: pathPhysical,
        marker: { ...markerOpen, state: 'held' },
      });
    sayReport({
      lines: [
        `🧹 test-fns: ${KEEP_ENV_KEY} is set, so this run KEPT ALL of its temp dirs.`,
        `   ├─ at: ${pathPhysical}`,
        `   ├─ run: ${run}`,
        '   ├─ scope: every dir this run made — a green run holds them too, since a',
        '   │         global teardown is handed no test results to filter by.',
        // 🔴 the key is NAMED, never merely the number. this line read "reclaimed
        // by the age gate after 86400000ms." — a true fact with no move attached,
        // to a human who set the hatch precisely because they want TIME. they had
        // no way to learn the window is theirs to widen, and the raw ms unit read
        // as an oversight rather than as the literal `..._MS` key it is
        // .note = the continuation is SIX spaces, to sit under "they" — `   └─ `
        //         is six chars wide. an 11-space draft (copied from a `└─ fix: `
        //         line, whose label makes it 11) aligned under no word at all, and
        //         the snapshot is what made that visible. *an indent is invisible
        //         in source and obvious in a rendered diff* — which is the whole
        //         argument for why these renders are snapshotted
        // .note = the human duration rides BESIDE the ms, never instead of it. the
        //         ms is the literal unit of the key the next clause names, so a
        //         reader who acts on it needs that number verbatim; a reader who
        //         only wants to know how long they have should not owe a division
        //         by 3,600,000 to learn it is a day
        `   ├─ they are reclaimed by the age gate after ${maxAgeMs}ms (${asDurationHuman(
          { ms: maxAgeMs },
        )}) — widen`,
        `   │  that window with ${MAX_AGE_ENV_KEY}, in ms.`,
        // 🔴 TWO fixes, because the message describes TWO states a human can be in.
        // this line held only the widen — a fix for "I need longer", to a reader
        // who by then is far more often done and wants the dirs gone. a message
        // that answers one of its reader's two moves fails `errors-name-the-fix`
        // for the other, and it was the more common one
        //
        // .note = the command is SCOPED by the run stamp, never a bare sweep of the
        //         dir. a peer run's dirs sit right beside these, and a human who
        //         pastes what we hand them must not be the one who reaps them —
        //         which is `case=5`'s guarantee held in prose as well as in code
        //
        // .note = the dir is QUOTED and the glob is not, so a path with a space
        //         survives the paste while the stamp still expands
        "   └─ done with them? remove this run's, and no peer's:",
        `        rm -rf "${pathPhysical}"/*.${run}.*`,
      ],
    });
    return;
  }

  // 🔴 mark `partial` AHEAD of every step below it, never after. `partial` means
  // "the teardown BEGAN" — a claim we can only make truthfully while we are still
  // alive to make it. written later it would never land on the processes that most
  // need it, and there are TWO of them, not one:
  //
  //   - one pre-empted mid-rmSync, killed by a signal or an OOM
  //   - one the broken-chain guard below THROWS out of
  //
  // either would leave `open`, and so be reported to the next run as "its teardown
  // never ran" — which sends the adopter to audit a config that was never at fault,
  // while the cause sat in a file mode or a runner upgrade. the write-ahead rule is
  // about the PROCESS ENDING, so it must cover every way this one can end
  if (markerOpen)
    setRunMarker({
      tmpDir: pathPhysical,
      marker: { ...markerOpen, state: 'partial' },
    });

  // the broken-chain guard — throws loud rather than reclaim zero in silence
  // .note = `since` is OUR OWN start, never the age window. an unstamped dir that
  //         predates us belongs to an unhooked run and says no word about our chain.
  //         with no marker we have no honest boundary, so we do not accuse at all
  if (markerOpen)
    assertMintChainHeld({
      tmpDir: pathPhysical,
      run,
      since: new Date(markerOpen.startedAt),
      runner: input.runner,
    });

  // the RECLAIM, awaited
  const audit = await pruneRun({ tmpDir: pathPhysical, run });

  // residue found — re-write the marker to CARRY it, so the next run can print what
  // this one may not live long enough to say. the state is already `partial`
  if (audit.residue.length > 0) {
    if (markerOpen)
      setRunMarker({
        tmpDir: pathPhysical,
        marker: {
          ...markerOpen,
          state: 'partial',
          residue: audit.residue,
        },
      });
    // .note = the fourth member of the one message family, and the last to get the
    //         count agreement. it was **visibly wrong** in `case8`, whose scene seals
    //         exactly one dir and whose render therefore read "remove THEM by hand"
    //         over a single path
    const agreed = asCountAgreement({
      count: audit.residue.length,
      one: 'temp dir',
      many: 'temp dirs',
    });
    sayReport({
      lines: [
        `🧹 test-fns: this run could not reclaim ${agreed.phrase} it made.`,
        ...audit.residue.map((entry) => `   ├─ ${entry.errno}: ${entry.path}`),
        `   └─ fix: remove ${agreed.them} by hand. the age gate reclaims ${agreed.them} meanwhile.`,
      ],
    });
    return;
  }

  // a clean reclaim settles the marker by removal — zero new entries of any kind
  delRunMarker({ tmpDir: pathPhysical, run });
};
