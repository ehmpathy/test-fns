import { asCountAgreement } from '../asCountAgreement';
import { FAULT_TORN_WRITE, setRunMarker } from '../runMarker';
import { sayReport } from '../sayReport';
import {
  computeRunArrears,
  type RunArrears,
  type RunArrearsAudit,
} from './computeRunArrears';

/**
 * .what = names every run whose teardown never fired, once each, and reaps not one
 * .why = a residue no one is told about accrues until a laptop takes four minutes
 *        to unlock. this is the report that makes an invisible population visible
 *
 * .note = it REPORTS and never reaps. the residue belongs to the age gate; this
 *         check only says that it exists and why
 *
 * @returns the arrears it named, in the order it named them
 */
export const reportRunArrears = (input: {
  tmpDir: string;
  run: string | null;
  maxAgeMs: number;
  /** the moment of this check — REQUIRED; see computeRunArrears.now */
  now: Date;
}): RunArrearsAudit => {
  const audit = computeRunArrears({
    tmpDir: input.tmpDir,
    run: input.run,
    maxAgeMs: input.maxAgeMs,
    now: input.now,
  });

  // a marker we could not read is a run whose fate is UNKNOWABLE, and it is the one
  // population BOTH reclaims skip — the dir sweep filters files, and the arrears
  // check cannot parse it. so it is named on every run until a human removes it
  // .note = it speaks even when there are no arrears; the two are independent
  //         findings, and a silence here is the failhide case=14 exists to end
  if (audit.namesUnreadable.length > 0) {
    const agreed = asCountAgreement({
      count: audit.namesUnreadable.length,
      one: 'run marker',
      many: 'run markers',
    });
    const anyMendableByAccess = audit.namesUnreadable.some((named) =>
      isFaultMendableByAccess({ named }),
    );
    sayReport({
      lines: [
        `🧹 test-fns: ${agreed.phrase} could not be read, so no run's fate could be judged from ${agreed.them}.`,
        ...audit.namesUnreadable.map((name) => `   ├─ ${name}`),
        // 🔴 the fix BRANCHES on the fault class, because the reader is in exactly
        //    one of two states and the move differs — the same shape, and the same
        //    reason, as the two-branch arrears fix at the foot of this file.
        //
        //    the line first said *"a marker we cannot PARSE"* while the lines above
        //    it can render `EACCES:` — a marker whose bytes are intact, that the os
        //    simply will not hand over. so it was widened to offer BOTH actions and
        //    name the cause at the grain the two share. that repair was right about
        //    the defect and one step short of its own conclusion: **a union of two
        //    fixes is not a fix for either reader.** the torn-write half was then
        //    told to *"widen access"* to a truncated file — an action that cannot
        //    succeed for their cause, which `rule.require.errors-name-the-fix`
        //    fails exactly as hard as an absent fix, and which this branch's own
        //    record calls worse than none.
        //
        // .note = the branch is on `some`, never on `every`. a mixed population
        //         holds BOTH readers, so the union line is the correct render for
        //         it — and the fault prefix on each line above tells each reader
        //         which half is theirs. it is only the all-torn case where the
        //         union names an impossible action for every reader present
        anyMendableByAccess
          ? `   └─ fix: remove ${agreed.them} by hand, or widen access to ${agreed.them} — a marker we cannot read names no run, at ${input.tmpDir}.`
          : `   └─ fix: remove ${agreed.them} by hand — a torn write names no run, and no access change can mend ${agreed.them}, at ${input.tmpDir}.`,
      ],
    });
  }

  if (audit.arrears.length === 0) return audit;

  // report before the stamp, so a process pre-empted mid-report still leaves the
  // marker unreported — a repeated line is benign; a swallowed one is the defect
  sayReport({ lines: asRunArrearsReport({ arrears: audit.arrears }) });

  // stamp each named marker, so one residue earns exactly one report
  const reportedAt = input.now.toISOString();
  for (const entry of audit.arrears)
    setRunMarker({
      tmpDir: input.tmpDir,
      marker: { ...entry.marker, reportedAt },
    });

  return audit;
};

/**
 * .what = whether a `<fault>: <name>` line names a fault a permission change can mend
 * .why = the two fault classes admit different actions, so the fix line must know
 *        which it faces. an errno (`EACCES`, `EIO`, …) means the bytes were never
 *        handed over — a wider mode can let the next run read them. a torn write
 *        means the bytes ARRIVED and are wrong, and no mode bit repairs that
 *
 * .note = it reads the PREFIX rather than a separate field, because that prefix is
 *         the rendered contract — `computeRunArrears` composes `${fault}: ${name}`,
 *         and `[case4] [t1]` asserts the exact string. a second carrier for one fact
 *         is a second place to drift
 */
const isFaultMendableByAccess = (input: { named: string }): boolean =>
  !input.named.startsWith(`${FAULT_TORN_WRITE}: `);

/**
 * .what = words the arrears report
 * .why = it must name a CLASS of cause, never one specific cause — "no dir was
 *        reclaimed" has many causes, and a report that picks one will confidently
 *        misdiagnose the rest. the ONE exception is a cause we have evidence for:
 *        an absent globalTeardown, which we can read from our own config
 *
 * .note = it yields LINES rather than a joined block, because `sayReport` — the one
 *         emitter every message in this behavior goes through — takes lines. a
 *         joined return would be split straight back apart at the call site
 */
const asRunArrearsReport = (input: { arrears: RunArrears[] }): string[] => {
  // .note = the possessive moves with the count too — "1 prior test run never
  //         reclaimed ITS temp dirs", "2 prior test runs … THEIR temp dirs". the
  //         `(s)` form left `their` beside a count of one, which is the one place
  //         the lazy suffix was not merely unpolished but wrong
  const agreed = asCountAgreement({
    count: input.arrears.length,
    one: 'prior test run',
    many: 'prior test runs',
  });
  const lines = [
    `🧹 test-fns: ${agreed.phrase} never reclaimed ${agreed.their} temp dirs.`,
  ];

  for (const entry of input.arrears) {
    // 🔴 THREE readings, never two. `partial` is written AHEAD of the reclaim, so it
    // means "the teardown began" and NOT "it met residue" — the two part company on
    // exactly the run pre-empted mid-rmSync, which is the run this state exists for.
    // a two-way split would tell that human their teardown "met residue it could not
    // remove" and then list no residue at all, which is worse than the vague answer
    const state = ((): string => {
      if (entry.marker.state !== 'partial') return 'its teardown never ran';
      if (entry.marker.residue.length === 0)
        return 'its teardown BEGAN but did not finish';
      return 'its teardown BEGAN and met residue it could not remove';
    })();
    // 🔴 the SCALE, on its own line. this report carried only the RUN count, so
    // "1 prior test run never reclaimed its temp dirs" read identically whether
    // that run left 3 dirs behind or 12,000 — and the silent accrual of scale is
    // the precise defect this behavior exists to end. two catalog critipaths
    // assert this number (`case=12` [t3], `case=11` [t1a]); neither the render nor
    // its snapshot carried it, which is sketch/proof drift in the backward
    // direction (`rule.require.experience-catalog-evolution`)
    const agreedDirs = asCountAgreement({
      count: entry.countDirs,
      one: 'temp dir',
      many: 'temp dirs',
    });
    lines.push(
      // 🔴 `run:` with the colon, because EVERY other label in this message family
      // carries one — `cause:`, `fix:`, `at:`, `node:`, `runner:`, `orphan:`,
      // `unparseable:`, `scope:`, `quiet:`. this line was the one `run <id>` among
      // three `run: <id>` renders, so one concept wore two labels across the
      // surface a consumer actually reads (`rule.forbid.ambiguous-labels`)
      //
      // .note = the divergence was AUTHORED, not inherited: the treestruct rewrite
      //         of `assertMintChainHeld` introduced `run: ` one round earlier and
      //         left this site alone, so a repair to one message split a family
      //         that had agreed with itself before. *a render fixed in one member
      //         of a family is a family that now disagrees* — the same shape as the
      //         nine-emitter blank-line defect, one round on
      `   ├─ run: ${entry.marker.run} — pid ${entry.marker.pid} (${
        entry.evidence === 'process-gone' ? 'gone' : 'aged out'
      }), began ${entry.marker.startedAt}`,
      // .note = the count sits ABOVE the state, so the state keeps the `└─` its
      //         residue lines nest beneath. residue is evidence FOR the state
      //         ("BEGAN and met residue it could not remove"), so it must hang off
      //         that line and no other
      //
      // 🔴 `with its stamp` states the SCOPE of the count, and it carries real load
      // rather than pedantry. the number counts dirs whose name holds THIS run's
      // id — so a run whose mint chain broke left its dirs UNSTAMPED and reads
      // `0`, in the one state whose whole harm is that dirs are on disk. bare, the
      // line read as a claim that the disk is clean, which flatly contradicts the
      // state printed directly beneath it. the scope is stated on EVERY line rather
      // than on the zero alone, because two phrasings for one fact is its own
      // defect (`rule.forbid.ambiguous-labels`)
      `   │  ├─ ${agreedDirs.phrase} still on disk with its stamp`,
      // 🔴 ZERO is the one count that reads as its own opposite, so it alone owes
      // a gloss. `0 temp dirs still on disk` sits directly above a state whose
      // entire harm is that dirs ARE on disk, and a human reads the two as a
      // contradiction. multiple careful readers have read it exactly that way,
      // which makes it a fact the message fails to state rather than a fact a
      // reader got wrong.
      //
      // the gloss names BOTH causes, because we hold evidence for neither: a run
      // that made no dirs and a run whose stamp never reached its workers are
      // indistinguishable from a count keyed on that stamp. to assert either
      // would be a guess printed as fact (`rule.forbid.failhide`)
      //
      // .note = it renders on the ZERO alone. the scope words `with its stamp`
      //         stay on every line — one term for one fact — but a gloss on a
      //         non-zero count would be noise, since a positive number cannot be
      //         misread as "the disk is clean"
      ...(entry.countDirs === 0
        ? [
            '   │  │  └─ zero means it made none, OR its stamp never reached its',
            '   │  │     workers — an unstamped dir counts to no run. check the dir.',
          ]
        : []),
      `   │  └─ ${state}`,
    );

    // a `partial` sends the reader to the FILESYSTEM, never to the wire-up
    //
    // .note = 🔴 the glyph is chosen by POSITION — `└─` for the last residue, `├─`
    //         for every one before it. it was a bare `└─` for all of them, so two
    //         stuck dirs rendered two "last item" markers in a row and the tree
    //         read as though it had ended twice. every `toContain` assertion over
    //         this report passed throughout: they check that the errno and the path
    //         appear, and say no word about the shape around them. a SNAPSHOT
    //         caught it on the first render (`rule.require.treestruct-output`)
    entry.marker.residue.forEach((residue, index) => {
      const isLast = index === entry.marker.residue.length - 1;
      lines.push(
        `   │     ${isLast ? '└─' : '├─'} ${residue.errno}: ${residue.path}`,
      );
    });
  }

  // the ONE specific cause we hold evidence for: the run's own setup read the
  // runner config and saw no teardown in it
  //
  // .note = the third member of the half-wired message family, and the only one
  //         whose fix is PROSE rather than a pasteable key — deliberately. the
  //         other two (`warnIfUnhooked`, `teardownAutoprune`) describe THIS run's
  //         own config, so both hand over the exact key. this one describes a run
  //         in ANOTHER process, under a config we never read and cannot name a
  //         key for — hence "that runner config", never "this" one
  //
  // .note = all three share one clause order — which half is wired, then the
  //         term — so a human reads them as one defect rather than three. this
  //         line already had that order; its two siblings did not
  const anyHalfWired = input.arrears.some(
    (entry) => entry.marker.teardownWired === false,
  );
  if (anyHalfWired)
    return [
      ...lines,
      '   ├─ cause: that run had NO globalTeardown wired — a half-wired config.',
      '   └─ fix: add the autoprune teardown to that runner config.',
    ];

  // otherwise a CLASS of cause — never one guess dressed as a diagnosis
  // .note = the class names a throw in the TEARDOWN as well as the setup, and that
  //         is a state this library itself produces: the broken-chain guard throws
  //         out of the teardown by design. a class that omitted it would send a
  //         human to hunt a signal that never landed, for a report we ourselves
  //         printed a moment earlier
  return [
    ...lines,
    '   ├─ cause: a class of pre-emption — a signal, a CI hard timeout, an OOM, or',
    '   │         a throw inside the global setup or teardown. it got no second write.',
    // 🔴 it must NOT scold a deliberate interrupt. a ^C is the single most common
    // way to reach this message, and it is an act a human MEANT to take — so the
    // first clause a reader meets must tell them they are fine. this line read
    // "no action is owed unless this repeats", which never acknowledges the
    // deliberate case at all and so reads as a fault report for an intended act
    //
    // .note = TWO branches, because the reader is in one of exactly two states,
    //         and the move differs: an interrupt they chose needs no move; a run
    //         that died on its own sends them to the runner logs at that instant.
    //         one answer for both would fail `errors-name-the-fix` for whichever
    //         reader it did not address (`case=12` [t3])
    '   └─ fix: no fix is owed if you interrupted that run on purpose. if it ended',
    '           on its own, check the runner logs at that timestamp — the residue',
    '           itself is bounded by the age gate.',
  ];
};
