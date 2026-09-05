/**
 * .what = clamps the arrears report — the ONE cause it may name outright, the
 *         class it must fall back to otherwise, and the once-per-marker bound
 * .why = this report is the only voice a pre-empted run ever gets. a teardown
 *        cannot report its own absence, so if this misdiagnoses, the residue is
 *        both invisible AND misattributed — worse than silence, because it sends
 *        a human to audit a config that was never at fault
 *
 * .note = 🔴 this file exists because a YAGNI review found `teardownWired` was
 *         DEFAULTED rather than required. the field's whole justification is that
 *         a half-wired config is "a cause with evidence" — and a default toward
 *         `true` fabricates that evidence in the direction that SILENCES the
 *         diagnosis. the default is gone; this clamps that the diagnosis it
 *         suppressed actually fires
 */
import { genTempDir, given, then, useThen, when } from '@src/contract';

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { genRunMarkerOpen, setRunMarker } from '../runMarker';
import { reportRunArrears } from './reportRunArrears';

/**
 * .what = yields a pid that is certainly gone
 * .why = 🔴 pid 0 is NOT "dead" — `isProcessGone` refuses a pid <= 0 as
 *        UNANSWERABLE (0 addresses a process group on posix, never a process), so
 *        a clamp built on it falls through to the age fallback and races a 1ms
 *        window, to pass or fail on scheduler luck
 *
 * .how = spawnSync blocks until the child exits, so its pid is gone by the time
 *        it returns — a real dead process rather than a number we hope is unused
 */
const getOnePidGone = (): number => {
  const child = spawnSync(process.execPath, ['-e', '0']);
  return child.pid ?? 0;
};

/**
 * .what = the one instant every check in this file is made at
 * .why = 🔴 `now` is REQUIRED on the arrears pair, never optional. an unreached
 *        seam is not a seam; worse, an omitted `now` reads the clock TWICE (once to
 *        judge age, once to stamp reportedAt), so the input that exists to control
 *        time becomes the very cause that splits it. this file OWNS the clock
 *        rather than races the real one
 */
const NOW: Date = new Date('2026-09-02T12:00:00.000Z');

/** a moment far enough back that any age window would name it */
const asMomentLongPast = (): string =>
  new Date(NOW.getTime() - 10 * 60 * 1000).toISOString();

/** captures console.error for one call, then restores it */
const getAllLinesSpoken = (act: () => void): string[] => {
  const lines: string[] = [];
  const errorBefore = console.error;
  console.error = (...args: unknown[]): void => {
    lines.push(args.map(String).join(' '));
  };
  try {
    act();
  } finally {
    console.error = errorBefore;
  }
  return lines;
};

/**
 * .what = a marker for a run that is certainly over
 * .why = BOTH discriminators are satisfied, and that is deliberate: the pid is
 *        genuinely gone, and the start time is genuinely past. so the clamp holds
 *        whether the liveness question is answerable on this platform or not — a
 *        pid that a kernel happened to recycle cannot turn this test red
 */
const setMarkerOfDeadRun = (input: {
  tmpDir: string;
  run: string;
  teardownWired: boolean;
}): void =>
  setRunMarker({
    tmpDir: input.tmpDir,
    marker: {
      ...genRunMarkerOpen({
        run: input.run,
        teardownWired: input.teardownWired,
      }),
      pid: getOnePidGone(),
      startedAt: asMomentLongPast(),
    },
  });

/**
 * .what = a marker for a dead run whose teardown BEGAN — the `partial` state
 * .why = 🔴 `partial` is declared, written by the teardown, and branched on by the
 *        report — so a suite that never drives it leaves the one distinction the
 *        state exists to carry unguarded
 */
const setMarkerOfBegunRun = (input: {
  tmpDir: string;
  run: string;
  residue: Array<{ path: string; errno: string }>;
}): void =>
  setRunMarker({
    tmpDir: input.tmpDir,
    marker: {
      ...genRunMarkerOpen({ run: input.run, teardownWired: true }),
      pid: getOnePidGone(),
      startedAt: asMomentLongPast(),
      state: 'partial',
      residue: input.residue,
    },
  });

describe('reportRunArrears', () => {
  given('[case1] a prior run whose config had NO teardown wired', () => {
    when('[t0] the next run reports its arrears', () => {
      const scene = useThen('the report is spoken', () => {
        const tmpDir = genTempDir({ slug: 'arrears-half-wired' });
        setMarkerOfDeadRun({
          tmpDir,
          run: 'r0ff0ded1',
          teardownWired: false,
        });
        const lines = getAllLinesSpoken(() =>
          reportRunArrears({
            tmpDir,
            run: 'rfeed1111',
            maxAgeMs: 1,
            now: NOW,
          }),
        );
        return { tmpDir, line: lines.join('\n') };
      });

      then('it names the half-wired config OUTRIGHT, not a class', () => {
        // .why = this is the one cause we hold evidence for — the run's own setup
        //        read its runner config and saw no teardown beside it. a report
        //        that buries it under "a class of pre-emption" wastes the evidence
        expect(scene.line).toContain('NO globalTeardown wired');
        expect(scene.line).toContain('half-wired');
      });

      then('and it names the fix, not merely the symptom', () => {
        expect(scene.line).toContain('fix:');
        expect(scene.line).toContain('teardown');
      });

      then('it does NOT fall back to the vague class of cause', () => {
        // .why = the two branches are exclusive; a report that says both leaves
        //        the human to pick, which is the diagnosis they came here for
        expect(scene.line).not.toContain('a class of pre-emption');
      });
    });
  });

  given('[case2] a prior run whose teardown WAS wired, yet never ran', () => {
    when('[t0] the next run reports its arrears', () => {
      const scene = useThen('the report is spoken', () => {
        const tmpDir = genTempDir({ slug: 'arrears-pre-empted' });
        setMarkerOfDeadRun({ tmpDir, run: 'rc0dedea1', teardownWired: true });
        const lines = getAllLinesSpoken(() =>
          reportRunArrears({
            tmpDir,
            run: 'rfeed1111',
            maxAgeMs: 1,
            now: NOW,
          }),
        );
        return { tmpDir, line: lines.join('\n') };
      });

      then('it names a CLASS of cause, never one guess as a diagnosis', () => {
        // .why = "no dir was reclaimed" has many causes. with the config ruled
        //        out we have no evidence left, so to name one would be to guess
        //        confidently — and be confidently wrong most of the time
        expect(scene.line).toContain('a class of pre-emption');
        expect(scene.line).not.toContain('NO globalTeardown wired');
      });

      then('🔴 and it words the evidence GONE — a fact, not a guess', () => {
        // .why = 🔴 this is the POSITIVE assertion on `(gone)`. `case5` clamps its
        //        twin (`aged out`, and `not.toContain('(gone)')`), and the messages
        //        snapshot renders `aged out` alone by design — so absent this line,
        //        the word the kernel earns us is asserted only by its own absence
        //        elsewhere
        //
        //        that hole is real: the two words carry different CONFIDENCE, and
        //        the whole argument at reportRunArrears.ts:88 is that a report which
        //        speaks them with one word sells a guess at a fact's price. with
        //        half of that distinction unclamped, a renderer that emits `aged
        //        out` for BOTH branches stays green
        //
        // .how = `setMarkerOfDeadRun` spawns a child and waits for it, so this pid
        //        is genuinely reaped — never a number we hope is unused
        expect(scene.line).toContain('(gone)');
        expect(scene.line).not.toContain('aged out');
      });
    });
  });

  given('[case3] one residue, and several runs that follow it', () => {
    when('[t0] two later runs each check the arrears', () => {
      const scene = useThen('both checks are made', () => {
        const tmpDir = genTempDir({ slug: 'arrears-reported-once' });
        setMarkerOfDeadRun({ tmpDir, run: 'r0ff1ce01', teardownWired: true });
        const linesFirst = getAllLinesSpoken(() =>
          reportRunArrears({
            tmpDir,
            run: 'rda7e0001',
            maxAgeMs: 1,
            now: NOW,
          }),
        );
        const linesSecond = getAllLinesSpoken(() =>
          reportRunArrears({
            tmpDir,
            run: 'rda7e0002',
            maxAgeMs: 1,
            now: NOW,
          }),
        );
        return { linesFirst, linesSecond };
      });

      then('the FIRST names it', () => {
        expect(scene.linesFirst).toHaveLength(1);
        expect(scene.linesFirst[0]).toContain('r0ff1ce01');
      });

      then('the SECOND says no word — one residue, one report', () => {
        // .why = the predicate (unsettled AND process gone) holds for as long as
        //        the residue does, so without the reportedAt stamp every later run
        //        would name the same casualty forever. a condition that never
        //        lapses is not a bound — it is how a real alarm gets muted
        expect(scene.linesSecond).toEqual([]);
      });
    });
  });

  given('[case4] a run that is still LIVE', () => {
    when('[t0] a peer run checks the arrears', () => {
      const scene = useThen('the check is made', () => {
        const tmpDir = genTempDir({ slug: 'arrears-live-peer' });
        // our own pid answers, so this marker reads as a live peer — and its
        // start time is deliberately ANCIENT, so an age-keyed check would name
        // it at once. only the liveness question saves it
        setRunMarker({
          tmpDir,
          marker: {
            ...genRunMarkerOpen({ run: 'r11feba5e', teardownWired: true }),
            startedAt: asMomentLongPast(),
          },
        });
        const lines = getAllLinesSpoken(() =>
          reportRunArrears({
            tmpDir,
            run: 'rfeed1111',
            maxAgeMs: 1,
            now: NOW,
          }),
        );
        return { lines };
      });

      then('it is NOT slandered, though it is far past the age window', () => {
        // .why = maxAgeMs is 1ms here, so an age-keyed check would name it at
        //        once. the process is the discriminator precisely because no age
        //        window can separate a live peer from a dead run — the two sit
        //        minutes apart while detection is owed in seconds
        expect(scene.lines).toEqual([]);
      });
    });
  });

  given('[case5] a run whose liveness question CANNOT be answered', () => {
    // .why = 🔴 this fallback is the branch this case exists to clamp. `isProcessGone`
    //        yields null on any platform or pid where the question is unanswerable,
    //        and the age window decides instead — a second, weaker discriminator
    //        whose verdict the report words differently. it is reachable and worded,
    //        so it must be clamped too
    //
    // .how = pid 0 addresses a process GROUP on posix, never a process, so
    //        isProcessGone refuses it as unanswerable. that same fact makes pid 0 a
    //        flaky pick wherever a clamp wants a LIVE process — here it is the point
    //        rather than the hazard
    const setMarkerUnanswerable = (input: {
      tmpDir: string;
      run: string;
      startedAt: string;
    }): void =>
      setRunMarker({
        tmpDir: input.tmpDir,
        marker: {
          ...genRunMarkerOpen({ run: input.run, teardownWired: true }),
          pid: 0,
          startedAt: input.startedAt,
        },
      });

    when('[t0] its start time is PAST the age window', () => {
      const scene = useThen('the check is made', () => {
        const tmpDir = genTempDir({ slug: 'arrears-aged-out' });
        setMarkerUnanswerable({
          tmpDir,
          run: 'ra6ed0011',
          startedAt: asMomentLongPast(),
        });
        const lines = getAllLinesSpoken(() =>
          reportRunArrears({
            tmpDir,
            run: 'rfeed1111',
            maxAgeMs: 1,
            now: NOW,
          }),
        );
        return { line: lines.join('\n') };
      });

      then('it IS named — the fallback still catches the casualty', () => {
        expect(scene.line).toContain('ra6ed0011');
      });

      then('and the report words it AGED OUT, never as certainty', () => {
        // .why = the two verdicts carry different confidence. `gone` is a fact the
        //        kernel told us; `aged out` is a guess the clock made. a report that
        //        spoke them with one word would sell the guess at the fact's price
        expect(scene.line).toContain('aged out');
        expect(scene.line).not.toContain('(gone)');
      });
    });

    when('[t1] its start time is INSIDE the age window', () => {
      const scene = useThen('the check is made', () => {
        const tmpDir = genTempDir({ slug: 'arrears-aged-within' });
        setMarkerUnanswerable({
          tmpDir,
          run: 'r40011e01',
          startedAt: NOW.toISOString(),
        });
        const lines = getAllLinesSpoken(() =>
          reportRunArrears({
            tmpDir,
            run: 'rfeed1111',
            maxAgeMs: 60 * 60 * 1000,
            now: NOW,
          }),
        );
        return { lines };
      });

      then(
        'it says no word — the fallback is a WINDOW, not a catch-all',
        () => {
          // .why = without this, [t0] would pass on an implementation that named
          //        every unanswerable marker outright. the window is what keeps the
          //        weaker discriminator from slander of a peer we merely cannot see
          expect(scene.lines).toEqual([]);
        },
      );
    });
  });

  // .note = 🔴 the case labels continue this file's ONE counter, so the tail reads
  //         `[case6]`, `[case7]`, `[case8]`. a `given` appended in a later round
  //         invites a restart at `[case1]` and a SECOND holder of a label an earlier
  //         `given` already owns — and no gate catches it: jest runs a duplicate
  //         name happily, so every case reads green
  //
  //         a duplicate label costs two things. `--scope name://case4` then selects
  //         two unrelated cases, which is the fastest feedback loop this repo has
  //         (see `git.repo.test --scope`); and it breaks the sole purpose of a case
  //         label — a stable handle a human can name in a review
  given('[case6] a marker file this run cannot read or parse', () => {
    // .why = 🔴 an arrears check that DROPS these, on the line right below
    //        `getAllRunMarkers`, undoes its own producer — whose note says a marker
    //        we cannot parse is "yielded as null, never dropped — a silently skipped
    //        marker is a casualty no one is ever told about". the producer takes
    //        deliberate trouble to preserve them, so its one consumer may not
    //        discard them
    //
    // .why = and it is the WORST population to lose. a marker we cannot parse is
    //        skipped by BOTH reclaims — the dir sweep filters files by construction,
    //        and this check cannot judge it — so it is immortal, and dropped here it
    //        would be silent too

    when('[t0] the next run makes its arrears check', () => {
      const scene = useThen('the check is made', () => {
        const tmpDir = genTempDir({ slug: 'arrears-unreadable' });
        fs.writeFileSync(
          path.join(tmpDir, 'run.rdeadfa11.marker.json'),
          '{"run":"rdeadfa11","pid":', // a write torn mid-flight
          'utf8',
        );
        const lines = getAllLinesSpoken(() =>
          reportRunArrears({
            tmpDir,
            run: 'rfeed1111',
            maxAgeMs: 60 * 60 * 1000,
            now: NOW,
          }),
        );
        return { line: lines.join('\n') };
      });

      then('🔴 it NAMES the marker rather than drop it in silence', () => {
        expect(scene.line).toContain('run.rdeadfa11.marker.json');
      });

      then('and it says how many, so the count is the visible signal', () => {
        // .note = the noun AND the pronoun both agree with the count. a render
        //         like `1 run marker(s) could not be read … judged from them`
        //         sets a plural pronoun beside a count of one.
        //         `asCountAgreement` owns the forms; this asserts the sentence
        //         they build
        expect(scene.line).toContain('1 run marker could not be read');
        expect(scene.line).toContain("no run's fate could be judged from it");
      });

      then('and it names the fix, since no mechanism will reclaim it', () => {
        // .why = this is the ONE residue class with no automatic reclaim at all.
        //        a report that named it with no such note would leave a human to
        //        assume the age gate eventually takes it. it never does
        expect(scene.line).toContain('fix:');
        expect(scene.line).toContain('by hand');
      });

      then('and it does NOT accuse the torn marker of arrears', () => {
        // .why = an unreadable marker names no run, so it cannot be evidence that a
        //        teardown failed to fire. to fold it into the arrears count would
        //        trade a silent leak for a confident misdiagnosis
        expect(scene.line).not.toContain('never reclaimed their temp dirs');
        expect(scene.line).not.toContain('a class of pre-emption');
      });
    });

    when('[t1] a whole marker sits beside the torn one', () => {
      const scene = useThen('the check is made', () => {
        const tmpDir = genTempDir({ slug: 'arrears-unreadable-mixed' });
        fs.writeFileSync(
          path.join(tmpDir, 'run.rdeadfa11.marker.json'),
          '{"run":"rdeadfa11","pid":',
          'utf8',
        );
        setMarkerOfDeadRun({
          tmpDir,
          run: 'rdeadd0c1',
          teardownWired: true,
        });
        const lines = getAllLinesSpoken(() =>
          reportRunArrears({
            tmpDir,
            run: 'rfeed1111',
            maxAgeMs: 1,
            now: NOW,
          }),
        );
        return { line: lines.join('\n') };
      });

      then(
        'it speaks BOTH findings, never one at the cost of the other',
        () => {
          // .why = the two are independent. an early return on either would silence
          //        the other, and the whole marker is the one that carries a fix a
          //        human can act on today
          expect(scene.line).toContain('run.rdeadfa11.marker.json');
          expect(scene.line).toContain('rdeadd0c1');
        },
      );
    });
  });

  given(
    '[case7] a dead run whose teardown BEGAN and was cut off mid-reclaim',
    () => {
      // .why = 🔴 THE cell this state exists for. were `partial` written AFTER the
      //        reclaim returned, a process killed mid-rmSync would leave `open` —
      //        and the human would be told "its teardown never ran", then audit a
      //        config that is not at fault. the marker is written AHEAD of the
      //        reclaim, which is the only moment a process can truthfully record
      //        that it began
      when('[t0] the next run reports its arrears', () => {
        const scene = useThen('the report is spoken', () => {
          const tmpDir = genTempDir({ slug: 'arrears-begun-nofinish' });
          setMarkerOfBegunRun({ tmpDir, run: 'rbe6a0001', residue: [] });
          const lines = getAllLinesSpoken(() =>
            reportRunArrears({
              tmpDir,
              run: 'rfeed1111',
              maxAgeMs: 1,
              now: NOW,
            }),
          );
          return { line: lines.join('\n') };
        });

        then('🔴 it says the teardown BEGAN, never that it never ran', () => {
          expect(scene.line).toContain('BEGAN but did not finish');
          expect(scene.line).not.toContain('its teardown never ran');
        });

        then('🔴 and it does NOT claim residue it cannot name', () => {
          // .why = a two-way split says "met residue it could not remove" for any
          //        `partial`. with an empty residue that sentence names no path, so
          //        the human hunts a file mode that is not the cause. a vague true
          //        answer beats a specific false one
          expect(scene.line).not.toContain('met residue it could not remove');
        });
      });
    },
  );

  given('[case8] a dead run whose teardown finished and MET residue', () => {
    when('[t0] the next run reports its arrears', () => {
      const scene = useThen('the report is spoken', () => {
        const tmpDir = genTempDir({ slug: 'arrears-begun-residue' });
        setMarkerOfBegunRun({
          tmpDir,
          run: 'rbe6a0002',
          residue: [{ path: '/tmp/test-fns/stuck-dir', errno: 'EACCES' }],
        });
        const lines = getAllLinesSpoken(() =>
          reportRunArrears({
            tmpDir,
            run: 'rfeed1111',
            maxAgeMs: 1,
            now: NOW,
          }),
        );
        return { line: lines.join('\n') };
      });

      then('it says the teardown met residue, and NAMES the path', () => {
        // .why = this branch sends the reader to the FILESYSTEM rather than to the
        //        wire-up — the opposite of every other arrears message — so the path
        //        and the errno are the whole payload
        expect(scene.line).toContain('met residue it could not remove');
        expect(scene.line).toContain('EACCES');
        expect(scene.line).toContain('/tmp/test-fns/stuck-dir');
      });

      then('and it is told apart from the begun-but-unfinished branch', () => {
        expect(scene.line).not.toContain('BEGAN but did not finish');
        expect(scene.line).not.toContain('its teardown never ran');
      });
    });
  });
});
