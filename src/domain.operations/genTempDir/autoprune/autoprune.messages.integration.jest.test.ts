/**
 * .what = the ONE place every human-read message this behavior emits is rendered
 *         whole, and snapshotted, so a reviewer can read it in a pull request
 * .why = 🔴 four of this behavior's five sharp critipaths deliver their entire value
 *        as RENDERED TEXT — case=7's unhooked notice, case=9's residue report,
 *        case=10's broken-chain report, case=12's arrears report — and absent this
 *        file the only clamp on that text is a `toContain` fragment
 *
 *        a fragment assertion is functional verification and it is not observability:
 *        it proves the words are somewhere in the string, and says no word about the
 *        SHAPE around them. a broken tree glyph, a doubled line, a lost blank, a
 *        `└─` where a `├─` belongs — every one of those passes a `toContain` suite
 *        green, and not one is visible in a diff of the file that emits it
 *
 *        `rule.require.snapshots` is explicit that the two are complementary and
 *        that BOTH are owed: "snapshot: observability in code reviews, aesthetic
 *        verification / assertions: functional verification". the extant clamps
 *        supply the second. this file supplies the first, and replaces not one of
 *        them — the fragment assertions stay exactly where they are
 *
 * .note = an INTEGRATION test: it writes real markers to a real temp dir and reads
 *         what the operations print. the messages are the CONTRACT with the human,
 *         which is the grain `rule.require.test-coverage-by-grain` demands snapshots
 *         of; the file sits beside the code that renders them rather than under
 *         contract/, because the renderers are internal and only their OUTPUT is
 *         public (`rule.prefer.most-common-denominator`)
 *
 * .note = the DEFAULT is a fixed interpolation, never a mask. the run id, the pid,
 *         the startedAt and the `now` are chosen here wherever they can be, so an
 *         export is stable by construction rather than by a normalizer. a blanket
 *         normalizer would blur exactly the region a reviewer most needs to read —
 *         and it would hide a defect that printed the wrong pid, which is the fact
 *         the report exists to carry
 *
 *         🔴 never as an absolute — "EVERY interpolation is FIXED, never masked" —
 *         because three exports break it. an absolute is the most expensive kind of
 *         false note: it tells a reader they may stop and look no further. the
 *         three, and why each earns its exception:
 *
 *         1. `asRenderStable` masks `<tmpDir>`, `<run>`, `<ts>`, `<hex>` — those
 *            come from a REAL genTempDir call, so no literal can fix them. the
 *            mask is per-segment, which is what keeps the shape around them whole
 *         2. `[case1] [t1]` masks a real reaped pid, because a `(gone)` verdict
 *            needs a pid the kernel truly reaped — a fixed one cannot be
 *         3. `[case11]` carries LIBUV's own wording, not ours. see its own note
 *
 *         *the rule: mask only what the host chooses, mask it per-segment, and name
 *         each exception where it is made.*
 *
 * .note = 🔴 the critipaths named above are a CLAIM, and a header claim is the easiest
 *         kind to falsify silently: *a documented intent with no realized snapshot is
 *         exactly the claim-in-prose-that-no-gate-grades this behavior exists to end.*
 *         so each names its keeper — case=10's broken-chain report is `[case12]`, the
 *         third sense of `partial` is `[case2b]`.
 *
 *         *a header that lists what a file covers is a promise, and a promise in a
 *         comment is graded by no runner.* a gap of this kind is reachable, worded,
 *         and invisible — so the guard against it is that every claim in this header
 *         names the case that keeps it
 *
 * .note = 🔴 `[case13]` covers the arrears report's DIR COUNT, whose gap takes a
 *         subtler shape than the two above: an arrears export built on a tmpDir that
 *         holds no dirs of the dead run renders the count as `0`, so the field reads
 *         as never missed — present, snapshotted, and constant. two catalog
 *         critipaths (`case=12` [t3], `case=11` [t1a]) assert it names real scale,
 *         which no such export can exercise
 *
 *         *a value that is zero in every fixture is indistinguishable from a value
 *         no code computes.* the guard is a fixture that makes real dirs, plus a
 *         peer-safety twin — a tally is as attributable-to-the-wrong-owner as a reap
 *
 * .note = 🔴 every render here goes through `asTerminalText`, so every export carries
 *         the newline `console.error` writes — and, since `sayReport` closes each
 *         block with a blank line, the blank a terminal shows between two stacked
 *         reports. that transformer exists precisely to make these exports agree
 *         with their acceptance twins character for character, so this header must
 *         never name a divergence from them and call it intended.
 *
 *         *a note that names a difference and calls it intended is the hardest kind
 *         to catch, because it answers the reviewer's question before they ask it* —
 *         the same shape `PID_UNANSWERABLE`'s note guards against, forty lines
 *         below
 */
import { genTempDir, given, then, when } from '@src/contract';

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeTempDirName } from '../computeTempDirName';
import { GATE_SWEPT_ENV_KEY, genRunId, RUN_ID_ENV_KEY } from '../getOneRunId';
import { getOneTempDirRoot } from '../getOneTempDirRoot';
import {
  MAX_AGE_ENV_KEY,
  pruneStaleOnce,
  reportStaleResidue,
  reportUnreadableNames,
  resetPruneThrottle,
} from '../pruneStale';
import { delRunMarker, genRunMarkerOpen, setRunMarker } from '../runMarker';
import {
  QUIET_ENV_KEY,
  resetUnhookedNotice,
  warnIfUnhooked,
} from '../warnIfUnhooked';
import { assertMintChainHeld } from './assertMintChainHeld';
import { reportRunArrears } from './reportRunArrears';
import { KEEP_ENV_KEY, teardownAutoprune } from './teardownAutoprune';

/** a run that began at a fixed instant, judged at a fixed instant one day on */
const STARTED_AT = '2026-01-19T12:00:00.000Z';
const NOW: Date = new Date('2026-01-20T12:00:00.000Z');

/**
 * the pid every marker below carries
 *
 * .why = 0 is the one pid whose liveness answer is FIXED: `isProcessGone` refuses
 *        the question (a signal to 0 addresses the whole process group), so it
 *        answers null and the check falls to the age window. a real pid would be
 *        alive or dead by the machine's luck, so the rendered evidence word would
 *        differ between runs and the snapshot would churn
 *
 * .note = 🔴 the cost is that a marker on this pid renders `aged out` and never
 *         `(gone)`, so `[case1] [t1]` below renders the `(gone)` branch on a real
 *         reaped pid, masked per-segment. that gap is a HOLE, never a division of
 *         labour: a `not.toContain` elsewhere asserts the word by its ABSENCE
 *         alone, which leaves the PRIMARY branch with no rendered shape anywhere
 *         while the fallback carries eleven
 *
 *         *a note that names a cost and then calls it intended is the easiest
 *         defect to read past* — it answers the reviewer's question before they
 *         ask it
 */
const PID_UNANSWERABLE = 0;

/**
 * .what = a pid that is certainly gone
 * .why = `isProcessGone` refuses a pid <= 0 as UNANSWERABLE (0 addresses a process
 *        group on posix, never a process), so 0 cannot exercise the `(gone)` branch
 *        — it is the very sentinel that forces the fallback
 *
 * .how = spawnSync blocks until the child exits, so its pid is gone by the time it
 *        returns — a real dead process rather than a number we hope is unused
 */
const getOnePidGone = (): number => {
  const child = spawnSync(process.execPath, ['-e', '0']);
  return child.pid ?? 0;
};

/** captures console.error across one act, then restores it */
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
 * .what = the spoken lines as a TERMINAL receives them — with the final newline
 *         `console.error` writes after every call
 *
 * .why = 🔴 a bare `lines.join('\n')` drops that newline, and jest then glues its
 *        own `"` end-delimiter onto the last character of the render. on the
 *        hold message that produced:
 *
 *            rm -rf "<tmpDir>"/*.raabbccdd.*"
 *
 *        which reads as an unterminated shell string. the product emits no such
 *        line — `teardownAutoprune.ts:139` is balanced, and the acceptance twin
 *        (captured from a real child's stderr, which DOES carry the newline)
 *        renders it balanced with the delimiter on its own line.
 *
 *        **a careful reader parses that delimiter as product output and files it
 *        as a blocker**, and is right to: a snapshot exists to show a reviewer
 *        what a human sees, and one a careful reader cannot parse has failed at
 *        its only job. the defect is real; only its address misleads.
 *
 *        this form is also the more faithful representation — `console.error(x)`
 *        writes `x + '\n'`, so this is what reaches a terminal, and it makes the
 *        integration renders agree with their acceptance twins character for
 *        character.
 *
 * .note = a render must never end flush against jest's delimiter. if a future
 *         snapshot site bypasses this transformer, the same misread returns.
 */
const asTerminalText = (lines: string[]): string => `${lines.join('\n')}\n`;

/**
 * .what = masks libuv's `strerror` prose, and it alone, out of a rendered errno line
 * .why = a node errno string is `${code}: ${strerror}, ${syscall} '${path}'`. the
 *        code and the syscall are node's public `ErrnoException` surface and do not
 *        move; the strerror text is libuv's, so an upstream reword would redden a
 *        snapshot that carried it — for a non-defect, on every consumer's pipeline
 *
 * .note = it masks the ONE volatile part rather than the whole line. `<cause>` over
 *         the lot would hide the errno and the syscall, which are the two facts the
 *         `cause:` line exists to carry, and would leave the export unable to fail
 *         on a real change of either
 *
 * .note = the product is untouched — the human still reads libuv's real words. this
 *         is a property of the RECORD, never of the message
 */
const asStrerrorMasked = (text: string): string =>
  text.replace(/([A-Z]+[0-9]*): [^,\n]+, /g, '$1: <strerror>, ');

/**
 * .what = the lines of one render that carry a top-level tree glyph
 * .why = 🔴 a snapshot ALONE has no teeth on a developer machine. jest rewrites a
 *        changed snapshot in place and reports green; only `--ci` (which the github
 *        runner sets, and which `.github/workflows/.test.yml` therefore gets for
 *        free) refuses the write and fails. so locally a snapshot is a RECORD for
 *        the reviewer's diff, never a check
 *
 *        proven, not assumed: flip `reportUnreadableNames`'s `├─` to `└─` and the
 *        suite reports every test passed and none failed, while it silently
 *        rewrites three lines of the snapshot to hold the defect
 *
 *        that is precisely why `rule.require.snapshots` says to use BOTH. this
 *        yields the glyph lines so each render below can also be asserted on the
 *        property a human would notice — which is what bites on both machines
 */
const getAllLinesGlyphed = (input: { text: string }): string[] =>
  input.text.split('\n').filter((line) => /^ {3}[├└]─ /.test(line));

/** captures console.error across one AWAITED act, then restores it */
const getAllLinesSpokenAsync = async (
  act: () => Promise<void>,
): Promise<string[]> => {
  const lines: string[] = [];
  const errorBefore = console.error;
  console.error = (...args: unknown[]): void => {
    lines.push(args.map(String).join(' '));
  };
  try {
    await act();
  } finally {
    console.error = errorBefore;
  }
  return lines;
};

/**
 * .what = runs an act with this process's run id set to a fixed value, or absent
 * .why = the teardown reads its id from the ambient env — the SAME key the real
 *        suite around this file runs under. without a restore, one case here would
 *        strip the id every later test file inherits, and the suite's own reclaim
 *        would go blind. the `finally` is the whole reason this helper exists
 */
/**
 * .what = swaps the three volatile segments of a rendered temp-dir path for tokens
 * .why = a residue line names a real fixture dir, and three of its four segments
 *        are minted fresh every run — the root, the timestamp, and the 8-hex tail.
 *        each is masked SEPARATELY rather than the whole path swept to one token,
 *        so what survives into the snapshot is the SHAPE a reviewer must be able
 *        to read: the slug they chose, the segment order, and the errno beside it
 *
 * .note = a whole-path mask would be two lines shorter and would hide a defect that
 *         prints the segments out of order, or drops the slug — which is the one
 *         part of the name a human uses to find the dir
 */
const asRenderStable = (input: {
  /**
   * the lines a report spoke, exactly as `getAllLinesSpoken` captured them
   *
   * .why = 🔴 it takes the LINES, never a pre-joined string, so the terminal
   *        shape is this transformer's to decide rather than each call site's.
   *        a call site that hands over `spoken.join('\n')` drops the final
   *        newline `console.error` writes, so its export renders ONE newline
   *        where the other eleven render two and the file disagrees with its
   *        own header rule
   *
   * .note = a note cannot guard what a signature can. `asTerminalText`'s own
   *         jsdoc names the hazard — *"if any snapshot site bypasses this
   *         transformer, the same misread returns"* — and prose does not stop a
   *         call site from the bypass, so the signature does: a caller holds
   *         lines and no seam to join them wrong
   */
  lines: string[];
  pathPhysical: string;
  /**
   * the run id to mask, or `null` to leave it concrete
   *
   * .why = 🔴 a mask is owed only by a value that CHURNS. a run id minted by the
   *        product churns every run and must be masked; one a fixture pins to a
   *        literal does not, and to mask it anyway costs a reader real signal —
   *        `[case3]` would render `run <run>` where every other export in this
   *        file shows a concrete `rbeefcafe`, so its record reads as unfinished
   *        and blurs the one example a human has of what the message looks like
   *
   * .note = the dir-name masks below are unconditional and stay so: the timestamp
   *         and the 8-hex suffix are minted by `computeTempDirName`, so they churn
   *         even when the run does not
   */
  run: string | null;
}): string =>
  // .note = the terminal shape comes from `asTerminalText` and from there ALONE,
  //         so a masked export and a bare one end identically — which is what the
  //         header's rule promises and what a `.replace(/\n?$/, '\n')` here would
  //         quietly break, since it normalizes to ONE newline and so erases the
  //         blank line `sayReport` closes every block with
  ((one: string): string =>
    input.run === null ? one : one.split(input.run).join('<run>'))(
    asTerminalText(input.lines),
  )
    .split(input.pathPhysical)
    .join('<tmpDir>')
    .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
    .replace(/\.[a-f0-9]{8}(?=$|\D)/g, '.<hex>');

/**
 * .what = plants `count` dirs stamped with `run`, and yields the paths it made
 *
 * .why = 🔴 an arrears fixture built on a tmpDir that holds NO dirs of the dead run
 *        renders `0 temp dirs still on disk` — inside the very states whose entire
 *        harm is that dirs ARE on disk. that is the degenerate-fixture shape: a
 *        value that is zero in every fixture is indistinguishable from a value no
 *        code computes.
 *
 *        `[case3]` is the sharpest form, and it is worse than a bland zero — a
 *        `0 temp dirs still on disk` DIRECTLY ABOVE two named residue paths. that
 *        render cannot occur in production: residue is, by construction, the
 *        stamped dirs the teardown failed to remove, so any run with residue has a
 *        count of at least its residue length. invented paths that parse as no temp
 *        dir and exist on no disk would document a shape the product cannot emit
 *
 * .note = the run must be HEX (`r[a-f0-9]{8}`) — `case=14`'s mint guard refuses
 *         every other form at the first mkdir rather than let an unparseable name
 *         reach disk. that is why the ids below read as hex words (`rc0ffee01`)
 *         rather than as mnemonics (`rgone0001`)
 */
const plantDirsOfRun = (input: {
  tmpDir: string;
  run: string;
  count: number;
}): string[] =>
  Array.from({ length: input.count }, (_unused, index) => {
    const dir = path.join(
      input.tmpDir,
      computeTempDirName({ slug: `left-${index}`, run: input.run }),
    );
    fs.mkdirSync(dir);
    return dir;
  });

const withEnv = async <T>(
  /** each key set to its value, or removed when the value is null */
  keys: Record<string, string | null>,
  act: () => Promise<T>,
): Promise<T> => {
  const before = Object.keys(keys).map((key) => ({
    key,
    value: process.env[key],
  }));
  const setOneKey = (input: {
    key: string;
    value: string | undefined;
  }): void => {
    if (input.value === undefined) delete process.env[input.key];
    if (input.value !== undefined) process.env[input.key] = input.value;
  };
  try {
    for (const [key, value] of Object.entries(keys))
      setOneKey({ key, value: value ?? undefined });
    return await act();
  } finally {
    for (const entry of before) setOneKey(entry);
  }
};

/** the single-key case, which every act below but the hold hatch wants */
const withRunIdEnv = async <T>(
  input: { value: string | null },
  act: () => Promise<T>,
): Promise<T> => await withEnv({ [RUN_ID_ENV_KEY]: input.value }, act);

describe('the messages autoprune speaks to a human', () => {
  given('[case1] a prior run whose teardown never fired', () => {
    when('[t0] the next run reports its arrears', () => {
      then('🔴 the report reads as written here', () => {
        const tmpDir = genTempDir({ slug: 'msg-arrears-class' });
        // 🔴 the dead run's dirs are PLANTED, so the count line carries a real
        // scale. this render is the proof of cell 8b, whose whole harm is that
        // dirs pile up — a harm no count of zero can assert
        plantDirsOfRun({ tmpDir, run: 'rdeadbee1', count: 2 });
        setRunMarker({
          tmpDir,
          marker: {
            run: 'rdeadbee1',
            pid: PID_UNANSWERABLE,
            startedAt: STARTED_AT,
            state: 'open',
            reportedAt: null,
            residue: [],
            teardownWired: true,
          },
        });

        const spoken = getAllLinesSpoken(() => {
          reportRunArrears({
            tmpDir,
            run: 'rc0de0001',
            maxAgeMs: 1000,
            now: NOW,
          });
        });

        expect(asTerminalText(spoken)).toMatchSnapshot();
        expect(spoken.join('\n')).toContain('2 temp dirs still on disk');
      });

      then(
        '🔴 and the same report, with the evidence GONE rather than aged',
        () => {
          // .why = 🔴 every other render in this file carries `(aged out)`, because
          //        PID_UNANSWERABLE makes the liveness answer fixed. so the FALLBACK
          //        branch is snapshotted eleven times over, and absent THIS export
          //        the PRIMARY branch — the one a real pre-empted run earns, and the
          //        one the design's whole `pid`-over-clock argument exists to
          //        produce — is rendered in exactly ZERO of them. the guide asks that
          //        each output variant be exercised, and a fragment assertion
          //        elsewhere leaves it with no rendered shape anywhere, which is the
          //        half a fragment cannot give
          //
          // .how = the pid is REAL and genuinely reaped, then masked to `<pid>` — the
          //        same per-segment mask `asRenderStable` already applies to the root,
          //        the timestamp and the hex. the word beside it is what this snapshot
          //        is for, and the word is not masked
          const pidGone = getOnePidGone();
          const tmpDir = genTempDir({ slug: 'msg-arrears-gone' });
          plantDirsOfRun({ tmpDir, run: 'rc0ffee01', count: 4 });
          setRunMarker({
            tmpDir,
            marker: {
              run: 'rc0ffee01',
              pid: pidGone,
              startedAt: STARTED_AT,
              state: 'open',
              reportedAt: null,
              residue: [],
              teardownWired: true,
            },
          });

          const spoken = getAllLinesSpoken(() => {
            reportRunArrears({
              tmpDir,
              run: 'rc0de0001',
              // .note = a window WIDE enough that the age fallback cannot fire. so a
              //         `(gone)` here proves the liveness check answered, rather than
              //         that the clock happened to agree with it
              maxAgeMs: 365 * 24 * 60 * 60 * 1000,
              now: NOW,
            });
          });

          const rendered = asTerminalText(spoken)
            .split(String(pidGone))
            .join('<pid>');

          expect(rendered).toContain('(gone)');
          expect(rendered).not.toContain('aged out');
          expect(rendered).toContain('4 temp dirs still on disk');
          expect(rendered).toMatchSnapshot();
        },
      );
    });
  });

  given('[case2] a prior run whose config wired NO teardown', () => {
    when('[t0] the next run reports its arrears', () => {
      then(
        '🔴 the report names the half-wired config, and reads as here',
        () => {
          const tmpDir = genTempDir({ slug: 'msg-arrears-halfwired' });
          // 🔴 cell 28's harm, stated by the catalog, is that "ids are minted,
          // every dir is stamped, and not one is ever reclaimed" — an ACCRUAL,
          // which no count of zero can prove, so the dirs are PLANTED
          plantDirsOfRun({ tmpDir, run: 'rbadfeed1', count: 6 });
          setRunMarker({
            tmpDir,
            marker: {
              run: 'rbadfeed1',
              pid: PID_UNANSWERABLE,
              startedAt: STARTED_AT,
              state: 'open',
              reportedAt: null,
              residue: [],
              teardownWired: false,
            },
          });

          const spoken = getAllLinesSpoken(() => {
            reportRunArrears({
              tmpDir,
              run: 'rc0de0001',
              maxAgeMs: 1000,
              now: NOW,
            });
          });

          expect(asTerminalText(spoken)).toMatchSnapshot();
          expect(spoken.join('\n')).toContain('6 temp dirs still on disk');
        },
      );
    });
  });

  given('[case2b] a prior run pre-empted mid-reclaim, with NO residue', () => {
    when('[t0] the next run reports its arrears', () => {
      then(
        '🔴 it says the teardown BEGAN but did not finish, and reads as here',
        () => {
          // 🔴 the THIRD sense of `partial`, and the subtlest to render.
          // `partial` is written AHEAD of the reclaim, so it means "the
          // teardown began" and NOT "it met residue" — the two part company on
          // exactly the run pre-empted mid-rmSync, which is the run this state
          // exists for. its sentence differs from BOTH of its neighbours:
          //
          //   state=open                → "its teardown never ran"
          //   state=partial, residue    → "BEGAN and met residue it could not remove"
          //   state=partial, NO residue → "BEGAN but did not finish"   ← here
          //
          // the file's own header names four rendered-text critipaths it claims to
          // snapshot, and this branch is one: reachable, worded, and — on a
          // `toContain` in reportRunArrears alone — proven present in WORDS while
          // its shape goes unrendered. that is the exact division this file exists
          // to close
          //
          // .note = every interpolation is FIXED (run, pid, startedAt, empty
          //         residue), so this export needs no mask at all
          const tmpDir = genTempDir({ slug: 'msg-arrears-began' });
          // 🔴 a teardown pre-empted mid-reclaim has, by definition, dirs it did
          // not reach. an EMPTY residue means it recorded no failure — never that
          // it left none behind, which is what a count of zero would assert
          plantDirsOfRun({ tmpDir, run: 'rbeefcafe', count: 5 });
          setRunMarker({
            tmpDir,
            marker: {
              run: 'rbeefcafe',
              pid: PID_UNANSWERABLE,
              startedAt: STARTED_AT,
              state: 'partial',
              reportedAt: null,
              residue: [],
              teardownWired: true,
            },
          });

          const spoken = getAllLinesSpoken(() => {
            reportRunArrears({
              tmpDir,
              run: 'rc0de0001',
              maxAgeMs: 1000,
              now: NOW,
            });
          });

          expect(asTerminalText(spoken)).toMatchSnapshot();

          // the functional half — it must be told apart from BOTH neighbours, and
          // it must claim no residue it cannot name
          expect(spoken.join('\n')).toContain('BEGAN but did not finish');
          expect(spoken.join('\n')).not.toContain('its teardown never ran');
          expect(spoken.join('\n')).not.toContain('met residue');
          expect(spoken.join('\n')).toContain('5 temp dirs still on disk');
        },
      );
    });
  });

  given('[case2c] a prior run whose stamp reached NONE of its dirs', () => {
    when('[t0] the next run reports its arrears', () => {
      then('🔴 the ZERO explains itself, and reads as here', () => {
        // 🔴 the one count that reads as its OWN OPPOSITE. `0 temp dirs still on
        // disk` sits directly above a state whose entire harm is that dirs ARE
        // on disk, so a human reads the pair as a contradiction. careful readers
        // read it exactly that way, which makes it a fact the message fails to
        // state rather than a fact a reader got wrong.
        //
        // .why this file = a gloss carried by an acceptance export alone is
        //      snapped at ONE grain while the file that owns the message family
        //      renders it nowhere. every other arrears fixture here plants a
        //      POSITIVE count, so the zero arm owes its own export — the
        //      degenerate-fixture shape inverted: not a value that is zero
        //      everywhere, but a branch no fixture reaches
        //
        // .note = the gloss names BOTH causes because we hold evidence for
        //         neither. a run that made no dirs and a run whose stamp never
        //         landed are indistinguishable from a count keyed on that stamp,
        //         so to assert either would print a guess as fact
        const tmpDir = genTempDir({ slug: 'msg-arrears-zero' });

        // deliberately plant NOT ONE dir — a broken mint chain leaves dirs that
        // carry no id, so a count scoped to the stamp finds none of them
        setRunMarker({
          tmpDir,
          marker: {
            run: 'rd00d0000',
            pid: PID_UNANSWERABLE,
            startedAt: STARTED_AT,
            state: 'partial',
            reportedAt: null,
            residue: [],
            teardownWired: true,
          },
        });

        const spoken = getAllLinesSpoken(() => {
          reportRunArrears({
            tmpDir,
            run: 'rc0de0001',
            maxAgeMs: 1000,
            now: NOW,
          });
        });

        expect(asTerminalText(spoken)).toMatchSnapshot();

        // the functional half — the gloss must be PRESENT on the zero
        expect(spoken.join('\n')).toContain('0 temp dirs still on disk');
        expect(spoken.join('\n')).toContain('zero means it made none');
        expect(spoken.join('\n')).toContain('counts to no run');
      });

      then(
        '🔴 and a POSITIVE count carries no gloss, so it is not noise',
        () => {
          // the guard's guard: a gloss that rendered on every count would be the
          // opposite defect — a line every reader pays for, to disambiguate a
          // number that cannot be misread. `5 temp dirs still on disk` says the
          // disk is dirty, which is what the state beneath it also says
          const tmpDir = genTempDir({ slug: 'msg-arrears-zero-guard' });
          plantDirsOfRun({ tmpDir, run: 'rd00d0001', count: 5 });
          setRunMarker({
            tmpDir,
            marker: {
              run: 'rd00d0001',
              pid: PID_UNANSWERABLE,
              startedAt: STARTED_AT,
              state: 'partial',
              reportedAt: null,
              residue: [],
              teardownWired: true,
            },
          });

          const spoken = getAllLinesSpoken(() => {
            reportRunArrears({
              tmpDir,
              run: 'rc0de0001',
              maxAgeMs: 1000,
              now: NOW,
            });
          });

          expect(spoken.join('\n')).toContain('5 temp dirs still on disk');
          expect(spoken.join('\n')).not.toContain('zero means it made none');
        },
      );
    });
  });

  given('[case3] a prior run pre-empted mid-reclaim, with residue', () => {
    when('[t0] the next run reports its arrears', () => {
      then(
        '🔴 it sends the reader to the FILESYSTEM, and reads as here',
        () => {
          // 🔴 the residue paths are REAL dirs of the dead run, planted on disk,
          // never invented literals (`/tmp/test-fns/stuck-dir`,
          // `/tmp/test-fns/busy-dir`). an invented path parses as no temp dir and
          // exists on no disk, so the count reads `0` DIRECTLY ABOVE two residue
          // lines — a render the product cannot emit, since residue IS the
          // stamped dirs the teardown could not remove
          //
          // .the general shape = a fixture may hold a value the product forbids,
          //         and the snapshot will then certify an impossible render. the
          //         fix is to build the fixture through the same operation the
          //         product uses (`computeTempDirName`), never by hand-written
          //         literals that only LOOK like what the product makes
          const RUN_PARTIAL = 'rfaded0b1';
          const tmpDir = genTempDir({ slug: 'msg-arrears-partial' });
          const [dirStuck, dirBusy] = plantDirsOfRun({
            tmpDir,
            run: RUN_PARTIAL,
            count: 2,
          }) as [string, string];
          setRunMarker({
            tmpDir,
            marker: {
              run: RUN_PARTIAL,
              pid: PID_UNANSWERABLE,
              startedAt: STARTED_AT,
              state: 'partial',
              reportedAt: null,
              residue: [
                { path: dirStuck, errno: 'EACCES' },
                { path: dirBusy, errno: 'EBUSY' },
              ],
              teardownWired: true,
            },
          });

          const spoken = getAllLinesSpoken(() => {
            reportRunArrears({
              tmpDir,
              run: 'rc0de0001',
              maxAgeMs: 1000,
              now: NOW,
            });
          });

          const rendered = asRenderStable({
            lines: spoken,
            pathPhysical: tmpDir,
            // .note = LEFT CONCRETE. `RUN_PARTIAL` is a fixture literal, so it
            //         churns not at all — and masked, this export would be the
            //         one in the file to read `run <run>` where every other
            //         shows a real id
            run: null,
          });

          expect(rendered).toMatchSnapshot();

          // 🔴 the MIRROR of `[case12]`'s clamp: a `sayReport` block ends with the
          // blank line the emitter closes on, so a terminal shows a gap between two
          // stacked reports. a call site that joins the lines by hand bypasses
          // `asTerminalText` and renders ONE newline here — a divergence a reviewer
          // reads as a capture blemish, correctly
          expect(rendered.endsWith('\n\n')).toEqual(true);

          // 🔴 the count and the residue evidence must agree. a human who reads
          // `N temp dirs still on disk` above a list of M residue paths must never
          // find N < M — the residue is a SUBSET of the dirs still on disk
          expect(rendered).toContain('2 temp dirs still on disk');
        },
      );

      then('🔴 exactly ONE residue line is marked as the last', () => {
        // .why = the functional half of the pair the snapshot above supplies the
        //        observability half for (`rule.require.snapshots`: use BOTH). the
        //        defect it grades: two stuck dirs that each render `└─`, so the
        //        tree reads as though it ends twice
        const tmpDir = genTempDir({ slug: 'msg-residue-glyphs' });
        setRunMarker({
          tmpDir,
          marker: {
            run: 'r0ddba11d',
            pid: PID_UNANSWERABLE,
            startedAt: STARTED_AT,
            state: 'partial',
            reportedAt: null,
            residue: [
              { path: '/tmp/a', errno: 'EACCES' },
              { path: '/tmp/b', errno: 'EBUSY' },
              { path: '/tmp/c', errno: 'ENOTEMPTY' },
            ],
            teardownWired: true,
          },
        });

        const linesResidue = getAllLinesSpoken(() => {
          reportRunArrears({
            tmpDir,
            run: 'rc0de0001',
            maxAgeMs: 1000,
            now: NOW,
          });
        })
          .join('\n')
          .split('\n')
          // .note = matched on the GLYPH at the residue depth, never on the indent
          //         alone — the cause line below wraps onto a continuation at that
          //         same depth, and an indent-only filter sweeps it in as a fourth
          //         residue. a filter that over-matches makes a count assertion
          //         report on lines it never meant to judge
          .filter((line) => /^ {3}│ {5}[├└]─ /.test(line));

        expect(linesResidue).toHaveLength(3);
        expect(linesResidue.filter((line) => line.includes('└─'))).toHaveLength(
          1,
        );
        expect(linesResidue.filter((line) => line.includes('├─'))).toHaveLength(
          2,
        );

        // the LAST one is the one marked last — never merely one of them
        expect(linesResidue[2]).toContain('└─');
      });
    });
  });

  given('[case4] a marker file that cannot be read at all', () => {
    when('[t0] the next run reports what it could not judge', () => {
      then('🔴 the unreadable-marker notice reads as here', () => {
        const tmpDir = genTempDir({ slug: 'msg-arrears-unreadable' });
        fs.writeFileSync(
          path.join(tmpDir, 'run.rdeadfa11.marker.json'),
          '{"run":"rdeadfa1',
          'utf8',
        );

        const spoken = getAllLinesSpoken(() => {
          reportRunArrears({
            tmpDir,
            run: 'rc0de0001',
            maxAgeMs: 1000,
            now: NOW,
          });
        });

        // .note = the tmpDir is interpolated into the fix line, and it is unique per
        //         run — so the PATH is replaced with a fixed token while every other
        //         character is snapshotted as emitted. this is the one interpolation
        //         this file cannot fix at the source, and it is masked narrowly
        const rendered = asTerminalText(spoken).split(tmpDir).join('<tmpDir>');

        // 🔴 the fix must NOT offer to widen access here, and the snapshot alone
        //    cannot say so — it records whatever renders. a torn write is bytes
        //    that ARRIVED and are wrong; a chmod over a truncated file leaves it
        //    exactly as unparseable, so *"widen access"* names an action that
        //    cannot succeed for this reader's cause. `[t1]` below asserts the
        //    mirror, so the pair pins BOTH branches rather than one
        expect(rendered).toContain('unparseable: run.rdeadfa11.marker.json');
        expect(rendered).not.toContain('widen access');
        expect(rendered).toContain('no access change can mend it');

        expect(rendered).toMatchSnapshot();
      });
    });

    when('[t1] the marker is READABLE-BY-NAME but REFUSED by the os', () => {
      then(
        '🔴 the EACCES fault reads as its own line, not as a torn write',
        () => {
          // 🔴 `computeRunArrears` renders `${entry.fault}: ${entry.name}`, so the
          //    fault is a USER-FACING byte of this line and it has more than one
          //    value. `[t0]` above snaps `unparseable` — a torn write, where the
          //    bytes arrived and are wrong. this is the other one: the bytes are
          //    intact and the os will not hand them over.
          //
          //    the two send a human to different places. a torn write says *a run
          //    died mid-write*; an EACCES says *check the file mode, or who owns
          //    this directory*. a snapshot of one is not a snapshot of the other,
          //    and a regression that dropped the prefix would collapse both into
          //    one indistinguishable `run.x.marker.json`
          const tmpDir = genTempDir({ slug: 'msg-arrears-refused' });
          const pathSealed = path.join(tmpDir, 'run.rdeadfa11.marker.json');
          fs.writeFileSync(pathSealed, '{"run":"rdeadfa11"}', 'utf8');
          fs.chmodSync(pathSealed, 0o000);

          try {
            // guard the guard: root ignores mode bits, so a machine that CAN read
            // this file would snap the wrong variant under a green suite — which
            // is exactly the silent-pass this whole case exists to forbid
            const refused = ((): boolean => {
              try {
                fs.readFileSync(pathSealed, 'utf8');
                return false;
              } catch {
                return true;
              }
            })();
            expect(refused).toEqual(true);

            const spoken = getAllLinesSpoken(() => {
              reportRunArrears({
                tmpDir,
                run: 'rc0de0001',
                maxAgeMs: 1000,
                now: NOW,
              });
            });

            const rendered = asTerminalText(spoken)
              .split(tmpDir)
              .join('<tmpDir>');

            // paired with the snapshot, per probe 1: a snapshot alone is rewritten
            // green on a dev machine, so the FAULT itself carries an assertion
            expect(rendered).toContain('EACCES: run.rdeadfa11.marker.json');
            expect(rendered).not.toContain('unparseable');

            // 🔴 the other half of the branch `[t0]` pins. here the bytes are
            //    intact and the os withholds them, so a wider mode genuinely lets
            //    the next run read the file — this is the ONE reader for whom
            //    *"widen access"* is a real move, and it must still be offered
            expect(rendered).toContain('widen access');

            expect(rendered).toMatchSnapshot();
          } finally {
            // 🔴 unsealed HERE and not at the end of the body — a red assertion
            //    above would otherwise leave a file the suite's own reclaim
            //    cannot remove, and the EACCES would resurface as a teardown
            //    failure that names the wrong cause
            fs.chmodSync(pathSealed, 0o600);
          }
        },
      );
    });
  });

  given('[case5] a consumer whose runner config wires no autoprune', () => {
    /**
     * .what = renders the unhooked notice under a fixed argv
     * .why = the notice names the config file at fault, read from `process.argv` —
     *        which differs between the unit and integration suites. a fixed argv
     *        here makes the rendered address stable, and it exercises the `-c`
     *        shape the repo's own commands actually pass
     */
    const getOneNoticeSpoken = (
      reason: 'setup-absent' | 'teardown-absent',
      options?: { argv?: string[]; runner?: 'jest' | 'vitest' },
    ): string => {
      const argvBefore = process.argv;
      const quietBefore = process.env[QUIET_ENV_KEY];
      const vitestBefore = process.env.VITEST;
      try {
        delete process.env[QUIET_ENV_KEY];

        // .why = the notice reads its runner through `getOneTestRunner()`, which is
        //        UNCACHED and checks `VITEST` ahead of `JEST_WORKER_ID`. so a suite
        //        hosted by jest can still render the VITEST family address — the
        //        only way to observe that string composed into a whole message
        if (options?.runner === 'vitest') process.env.VITEST = 'true';

        process.argv = options?.argv ?? [
          'node',
          'jest',
          '-c',
          './jest.unit.config.ts',
        ];
        resetUnhookedNotice();
        return asTerminalText(
          getAllLinesSpoken(() => warnIfUnhooked({ reason })),
        );
      } finally {
        process.argv = argvBefore;
        if (quietBefore === undefined) delete process.env[QUIET_ENV_KEY];
        if (quietBefore !== undefined) process.env[QUIET_ENV_KEY] = quietBefore;
        if (vitestBefore === undefined) delete process.env.VITEST;
        if (vitestBefore !== undefined) process.env.VITEST = vitestBefore;
        resetUnhookedNotice();
      }
    };

    when('[t0] no autoprune setup is wired at all', () => {
      then("🔴 the notice reads as here — both runners' fixes included", () => {
        expect(getOneNoticeSpoken('setup-absent')).toMatchSnapshot();
      });
    });

    when('[t0b] the same notice, where the config CANNOT be named', () => {
      then('🔴 both addresses read as ONE message in two states', () => {
        // .why = 🔴 the `at:` line has two renders, and apart from this export they
        //        live in different FILES: this suite pins an argv that carries
        //        `-c ./jest.unit.config.ts`, so it reads `at: ./jest.unit.config.ts`;
        //        every spawned child in the acceptance suites has no `-c`, so it
        //        falls back to `at: your jest config (this repo may hold several)`.
        //
        //        a reviewer meets that as ONE message rendered inconsistently
        //        across snapshots and files it as a blocker. it is not — it is one
        //        message with two observed states, and the specific one is the
        //        BETTER of the pair (`rule.require.errors-name-the-fix`: name the
        //        config file at fault, never merely "your test runner").
        //
        //        **but a reviewer who must diff two files to learn that is a
        //        reviewer the artifact failed.** so both renders are taken HERE,
        //        side by side, in one export — the difference reads as a designed
        //        pair rather than as a drift
        const spokenNamed = getOneNoticeSpoken('setup-absent');
        const spokenFallback = getOneNoticeSpoken('setup-absent', {
          argv: ['node', 'jest'],
        });

        expect({ spokenNamed, spokenFallback }).toMatchSnapshot();

        // the functional half — the two differ ONLY at the address, and the
        // specific one names a real file while the fallback names the class
        expect(spokenNamed).toContain('at: ./jest.unit.config.ts');
        expect(spokenFallback).toContain('at: your jest config');
        expect(spokenNamed.split('\n').length).toEqual(
          spokenFallback.split('\n').length,
        );
      });
    });

    when('[t0c] the same notice, as a VITEST consumer reads it', () => {
      then('🔴 both VITEST addresses read as one message in two states', () => {
        // .why THIS EXISTS = `[t0]` and `[t0b]` render the jest family, and every
        //      acceptance child forces `JEST_WORKER_ID='1'` — so absent this export
        //      the `at:` line a VITEST consumer actually reads is rendered by NO
        //      snapshot in the repo. the vitest argv shapes are clamped as
        //      fragments through `getOneRunnerConfigPath`, never as a whole message.
        //
        // .why it MATTERS more than the jest pair = vitest is the runner whose
        //      wire-up is ONE key, so a vitest consumer who reads this notice has
        //      exactly one line to act on. an address that named the wrong family
        //      would send them to a jest config they do not own.
        //
        // .note = the FIX lines are runner-agnostic by design — this notice prints
        //         both runners' fixes, since an unhooked consumer has told us no
        //         word about which runner they mean. only the `at:` differs, and
        //         that is precisely what these two renders expose
        const spokenNamed = getOneNoticeSpoken('setup-absent', {
          runner: 'vitest',
          argv: ['node', 'vitest', '--config', './vitest.acceptance.config.ts'],
        });
        const spokenFallback = getOneNoticeSpoken('setup-absent', {
          runner: 'vitest',
          argv: ['node', 'vitest'],
        });

        expect({ spokenNamed, spokenFallback }).toMatchSnapshot();

        // the functional half — paired, so a resnap cannot launder a wrong family
        expect(spokenNamed).toContain('at: ./vitest.acceptance.config.ts');
        expect(spokenFallback).toContain('at: your vitest config');

        // 🔴 and the fallback names VITEST, never jest. this is the assertion the
        // whole `[t0c]` exists for: the family string is interpolated from the
        // detected runner, so a regression that hardcoded `jest` there would pass
        // every jest-hosted render in this file and fail only here
        expect(spokenFallback).not.toContain('your jest config');

        // the two vitest renders differ ONLY at the address, as the jest pair does
        expect(spokenNamed.split('\n').length).toEqual(
          spokenFallback.split('\n').length,
        );
      });
    });

    when('[t1] the setup is wired but its teardown is not', () => {
      then('🔴 the half-wired notice reads as here', () => {
        // .why = this is the state a two-key config surface makes reachable and a
        //        one-key one does not. its message must differ from [t0]'s, since
        //        the fix differs — one key to add, not two
        expect(getOneNoticeSpoken('teardown-absent')).toMatchSnapshot();

        // 🔴 the family's ONE clause order, clamped here as well as in `[case6]`.
        // drop the shared TERM — *"the autoprune setup is wired, its teardown is
        // not."* — or order the clauses otherwise than the two peer members do,
        // and one defect reads as three different sentences, which makes a human
        // re-read to check they are the same defect
        // (`rule.forbid.ambiguous-labels`, `rule.require.ubiqlang`)
        //
        // .note = a snapshot alone would SEAL such a divergence rather than catch
        //         it — it grades each render against its own past, never against
        //         the rest of the family. a cross-member assertion is the only
        //         shape that can see a family disagree with itself
        expect(getOneNoticeSpoken('teardown-absent')).toContain(
          'the autoprune setup is wired, its teardown is not — a half-wired config',
        );
      });
    });
  });

  given('[case6] a config with a globalTeardown but NO globalSetup', () => {
    when('[t0] the teardown fires with no run id to its name', () => {
      then('🔴 the teardown-side half-wired notice reads as here', async () => {
        // .note = it returns the moment it has spoken, so this drives the real
        //         operation and still touches not one entry on disk
        const spoken = await withRunIdEnv(
          { value: null },
          async () =>
            await getAllLinesSpokenAsync(
              async () => await teardownAutoprune({ runner: 'jest' }),
            ),
        );

        expect(asTerminalText(spoken)).toMatchSnapshot();

        // the functional half — it must name WHICH half is absent and what to add.
        // "half-wired" alone would read the same from either side of the pair
        expect(spoken.join('\n')).toContain('SETUP did not');

        // 🔴 the fix is the PASTEABLE key, never prose. an assertion on the vague
        // form — `'fix: add the autoprune setup'` — passes over a line that names
        // no key at all, while its mirror one module away hands over the exact
        // one. *an assertion written against the vague form is what lets the
        // vague form survive beside the actionable one.*
        expect(spoken.join('\n')).toContain(
          "fix: add `globalSetup: 'test-fns/autoprune.setup.jest'`",
        );
        expect(spoken.join('\n')).not.toContain('add the autoprune setup to');

        // and the cause carries the family's ONE clause order — which half is
        // wired, then the term — as every member of the family must
        expect(spoken.join('\n')).toContain(
          'the autoprune teardown is wired, its setup is not — a half-wired config',
        );

        // 🔴 the ADDRESS, which a member of this family can ship WITHOUT while every
        // field-by-field check calls the family consistent. a cause and a fix with no
        // `at:` leave the human to guess which of a repo's nine configs to edit —
        // and the two assertions above pass just as green over that gap, which is how
        // such a gap survives. *a family checked field-by-field is checked only for
        // the fields someone thought to name.*
        expect(spoken.join('\n')).toContain('├─ at: ');

        // and it names the RUNNER it was handed, never a guess — this hook runs in
        // the main process, where env detection reports 'unknown', so a value that
        // reads `jest` proves the input was used rather than the env re-read
        expect(spoken.join('\n')).toContain('at: your jest config');
      });
    });
  });

  given('[case7] a run held open by the hold hatch', () => {
    /**
     * .what = the hold render, over a root that holds `countDirs` of this run's dirs
     * .why = the count is a PARAMETER rather than a fixture constant, so `[t1]` below
     *        can drive the same render at two counts and compare them
     *
     * .note = the window is fixed via the env key rather than left to the default, so
     *         the rendered `after Nms` cannot churn when the default moves. the
     *         default's own VALUE is clamped by pruneStale.integration.jest.test.ts —
     *         a different question
     *
     * .note = a FIXED run id, so the rendered `run:` line cannot churn — and a valid
     *         one, since it enters through the env, where `getOneRunId` refuses any
     *         value outside `r[a-f0-9]{8}`. a legible mnemonic such as `rheldrun1`
     *         is not hex, so the boundary guard refuses it — that guard at work
     */
    const getOneHoldRender = async (input: {
      countDirs: number;
    }): Promise<string> => {
      const { pathPhysical } = getOneTempDirRoot();
      const namesPlanted = Array.from({ length: input.countDirs }, (_, index) =>
        computeTempDirName({ slug: `held-${index}`, run: 'raabbccdd' }),
      );
      for (const name of namesPlanted)
        fs.mkdirSync(path.join(pathPhysical, name), { recursive: true });

      try {
        const spoken = await withEnv(
          {
            [RUN_ID_ENV_KEY]: 'raabbccdd',
            [KEEP_ENV_KEY]: '1',
            [MAX_AGE_ENV_KEY]: '86400000',
          },
          async () =>
            await getAllLinesSpokenAsync(
              async () => await teardownAutoprune({ runner: 'jest' }),
            ),
        );
        return asTerminalText(spoken).split(pathPhysical).join('<tmpDir>');
      } finally {
        for (const name of namesPlanted)
          fs.rmSync(path.join(pathPhysical, name), {
            recursive: true,
            force: true,
          });
      }
    };

    when('[t0] the teardown fires with the hold key set', () => {
      then('🔴 it says WHERE they are, and reads as here', async () => {
        const { pathPhysical } = getOneTempDirRoot();

        const spoken = await withEnv(
          {
            [RUN_ID_ENV_KEY]: 'raabbccdd',
            [KEEP_ENV_KEY]: '1',
            [MAX_AGE_ENV_KEY]: '86400000',
          },
          async () =>
            await getAllLinesSpokenAsync(
              async () => await teardownAutoprune({ runner: 'jest' }),
            ),
        );

        // .note = this run minted no marker and made no dir, so the hold keeps not
        //         one entry and leaves not one behind. the message is identical
        //         either way — 🔴 a claim `[t1]` below GRADES, since *a coverage
        //         claim in a comment is read by no gate*. the FUNCTIONAL
        //         half — that the dirs really do survive — is clamped by
        //         teardownAutoprune.hold.integration.jest.test.ts. this file owns
        //         the observability half alone (`rule.require.snapshots`)
        // .note = 🔴 the RUN is masked too, not only the path. this render and the
        //         acceptance grain's (`autoprune.acceptance` `[case4] [t1]`) are the
        //         same message captured two ways — this one pins a fixture run id,
        //         that one mints a real one — so unmasked, this export shows
        //         `raabbccdd` where its twin shows a minted id and the pair reads
        //         as a contradiction a reviewer must re-derive. the mask here makes
        //         the two byte-identical, so the divergence does not EXIST rather
        //         than earn an explanation
        //         (`rule.prefer.prevent-over-correct` — rung 1 over rung 3).
        //
        //         no proof is lost: the exact literal is pinned functionally just
        //         below, on both the `run:` line and the `rm -rf` glob. that is the
        //         same division this export applies to `at:` — masked here,
        //         asserted there — and `run:` is the one line that takes both
        expect(
          asTerminalText(spoken)
            .split(pathPhysical)
            .join('<tmpDir>')
            .split('raabbccdd')
            .join('<run>'),
        ).toMatchSnapshot();

        // the functional half — the hold's whole value is that a human can FIND
        // the dirs, so the address, the run, and the window it survives are each
        // a load-bearing fact rather than decoration
        expect(spoken.join('\n')).toContain(`at: ${pathPhysical}`);
        expect(spoken.join('\n')).toContain('run: raabbccdd');

        // 🔴 BOTH renders of the window, never one. the raw ms is the literal unit
        // of the `..._MS` key the next clause tells them to set, so a human who
        // ACTS needs it verbatim; the human form is what a human who only wants to
        // know how long they have reads without a division by 3,600,000. an assert
        // on either alone would stay green while the other was dropped
        expect(spoken.join('\n')).toContain('86400000ms');
        expect(spoken.join('\n')).toContain('(24h)');

        // 🔴 the SECOND fix — the copy-paste that reclaims them now. a message that
        // named only the widen would answer "I need longer" to a reader who is far
        // more often done and wants the dirs gone
        // .note = it must be SCOPED by the run stamp. a bare sweep of the dir would
        //         hand a human the one command that reaps a peer's live run, which
        //         is the single outcome case=5 exists to make unreachable — and a
        //         command we PRINT is as much our act as one we execute
        expect(spoken.join('\n')).toContain(
          `rm -rf "${pathPhysical}"/*.raabbccdd.*`,
        );
        expect(spoken.join('\n')).not.toContain(`rm -rf "${pathPhysical}"/*"`);
      });
    });

    when('[t1] the same hold fires over a root that HOLDS dirs', () => {
      then(
        '🔴 the render is identical — the hold message is count-INVARIANT',
        async () => {
          // .why = `[t0]` snapshots a hold over an EMPTY root, and justifies that in
          //        prose: *"the message is identical either way"*. it is — the fix
          //        line is a glob (`*.raabbccdd.*`), never a list, so the render does
          //        not vary with what the glob will match. but a claim asserted by no
          //        test lets a future round add a count to that message while the
          //        zero-dir snapshot stays green and every real consumer's render
          //        diverges from it.
          //
          //        *a snapshot of one variant is exhaustive only if the OTHER
          //        variants are proven identical* — this is the proof
          //        (`rule.require.contract-snapshot-exhaustiveness`)
          const renderEmpty = await getOneHoldRender({ countDirs: 0 });
          const renderHeld = await getOneHoldRender({ countDirs: 3 });

          expect(renderHeld).toEqual(renderEmpty);

          // guard the guard: two empty strings are trivially equal, and would pass
          // the assertion above while proving no property at all
          expect(renderHeld).toContain('KEPT ALL of its temp dirs');
        },
      );
    });
  });

  given('[case8] a run one of whose dirs will not delete', () => {
    when('[t0] the teardown reports what it could not take', () => {
      then('🔴 the residue report reads as here', async () => {
        const { pathPhysical } = getOneTempDirRoot();
        const run = genRunId();
        let pathSealed: string | null = null;

        const spoken = await withRunIdEnv({ value: run }, async () => {
          try {
            setRunMarker({
              tmpDir: pathPhysical,
              marker: genRunMarkerOpen({ run, teardownWired: true }),
            });
            const dirStuck = genTempDir({ slug: 'residue-msg-stuck' });

            // the seal trick, proven by pruneRun.integration.jest.test.ts
            pathSealed = path.join(dirStuck, 'sealed');
            fs.mkdirSync(pathSealed, { recursive: true });
            fs.writeFileSync(path.join(pathSealed, 'child.txt'), 'x', 'utf8');
            fs.chmodSync(pathSealed, 0o500);

            return await getAllLinesSpokenAsync(
              async () => await teardownAutoprune({ runner: 'jest' }),
            );
          } finally {
            // 🔴 unseal, THEN remove — and remove the marker too. a residue
            // teardown deliberately LEAVES its marker `partial` for the next run,
            // which is right in prod and one leaked file per run here
            if (pathSealed) {
              fs.chmodSync(pathSealed, 0o700);
              fs.rmSync(path.dirname(pathSealed), {
                recursive: true,
                force: true,
              });
            }
            delRunMarker({ tmpDir: pathPhysical, run });
          }
        });

        // guard the guard: were the seal ineffective (a root user, an exotic
        // filesystem), the render below would be EMPTY and the snapshot would
        // record an empty string as though it were the message
        expect(spoken.join('\n')).toContain('could not reclaim');

        expect(
          asRenderStable({ lines: spoken, pathPhysical, run }),
        ).toMatchSnapshot();

        // 🔴 this scene seals exactly ONE dir, so it is the count at which a
        // hardcoded plural is visibly wrong: a header that says `every temp dir`
        // and a fix line that says `remove them`, over a single path. that form is
        // invisible to a sweep that hunts the `(s)` suffix, since this site carries
        // none
        //
        // .why = *search the DEFECT, never its most legible symptom.* the defect is
        //        a count and a pronoun that disagree; `(s)` is only the tell it
        //        leaves at the sites that admitted to it
        expect(spoken.join('\n')).toContain('could not reclaim 1 temp dir');
        expect(spoken.join('\n')).toContain('remove it by hand');
        expect(spoken.join('\n')).not.toContain('remove them by hand');
      });
    });
  });

  given('[case9] the age gate meets an entry it cannot remove', () => {
    when('[t0] it reports its residue', () => {
      then('🔴 the age-gate residue report reads as here', () => {
        // .note = driven through the RENDERER with a fixed audit rather than
        //         through a sealed directory. the render is pure, so every
        //         character here is chosen — no churn. that the audit is
        //         populated by a real refusal is
        //         pruneStale.integration.jest.test.ts's question, never this one
        //
        //         but the LITERALS must still carry a shape the product emits. a
        //         bare `/tmp/test-fns/stuck-dir` — no timestamp, no run stamp, no
        //         hex suffix — would show a reviewer a residue line no gate pass
        //         could produce. residue is, by construction, an entry of the
        //         contained dir that resisted removal, and every such entry
        //         carries `<ts>.<slug>.<hex>`: *a fixture may hold a value the
        //         product forbids, and the snapshot will then certify an
        //         impossible render while it looks perfectly healthy*
        //
        // .note = 🔴 EVERY volatile-shaped segment is masked — root, timestamp and
        //         hex — so the export reads:
        //
        //           <tmpDir>/<ts>.stuck-dir.<hex>
        //
        //         a mask over the ROOT alone is the half step: a hand-written
        //         `/tmp/test-fns/scope` shares the real contained root's shape and
        //         so reads as a stranger's live directory — correct, and partial,
        //         because `2026-01-19T12-00-00.000Z` and `a1b2c3d4` have that same
        //         property. they are invented, they are shaped exactly like real
        //         values, and from the `.snap` alone no reader can tell.
        //
        //         the slug stays bare, and it is the one segment that should. it
        //         carries what the CASE is about (`stuck-dir`, `busy-dir`), it is
        //         chosen rather than sampled, and every peer render in this file
        //         leaves its own slug visible for the same reason.
        //
        //         the shape argument above holds under the wider mask: three
        //         dot-separated segments in `<ts>.<slug>.<hex>` order is exactly
        //         what a reviewer needs to see, and a mask preserves it while a
        //         bare literal merely asserts it. *a placeholder is legible as a
        //         placeholder; an invented literal is legible as a fact.*
        //
        //         the other half — that a REAL refusal populates a real audit with a
        //         real path — is clamped where it belongs, by a real `chmod 0o500`
        //         at `pruneStale.integration.jest.test.ts:314-334`
        const { pathPhysical } = getOneTempDirRoot();
        const spoken = getAllLinesSpoken(() => {
          reportStaleResidue({
            audit: {
              dirsReclaimed: [],
              markersReclaimed: [],
              residue: [
                {
                  path: path.join(
                    pathPhysical,
                    '2026-01-19T12-00-00.000Z.stuck-dir.a1b2c3d4',
                  ),
                  errno: 'EACCES',
                },
                {
                  path: path.join(
                    pathPhysical,
                    '2026-01-19T12-00-00.000Z.busy-dir.e5f6a7b8',
                  ),
                  errno: 'EBUSY',
                },
              ],
              namesUnreadable: [],
            },
          });
        });

        expect(
          asTerminalText(spoken)
            .split(pathPhysical)
            .join('<tmpDir>')
            .replace(/\d{4}-\d{2}-\d{2}T[\d-]{8}\.\d{3}Z/g, '<ts>')
            .replace(/\.[a-f0-9]{8}(?=$|\W)/gm, '.<hex>'),
        ).toMatchSnapshot();

        // the functional half — two residues plus the fix line, and EXACTLY one
        // of the three marked as the last (`rule.require.snapshots`: use BOTH)
        const glyphed = getAllLinesGlyphed({ text: spoken.join('\n') });
        expect(glyphed).toHaveLength(3);
        expect(glyphed.filter((line) => line.includes('└─'))).toHaveLength(1);
        expect(glyphed[2]).toContain('└─ fix:');
      });
    });
  });

  given('[case10] a temp-dir name the age gate cannot parse', () => {
    when('[t0] it reports what it preserved', () => {
      then('🔴 the unreadable-name notice reads as here', () => {
        // .why = this is the ONE residue class no mechanism ever reclaims: no
        //        run's id claims it, and no age check can read its timestamp. the
        //        notice is the only guard between it and immortality
        //
        // .note = the two NAMES are OFF-PATTERN on purpose, and that is what makes
        //         them faithful — unlike `[case9]`'s residue paths, which carry
        //         `<ts>.<slug>.<hex>`. an unreadable name is DEFINED by its failure
        //         to parse, so a well-formed literal here would be the impossible
        //         one. the shape a fixture owes is the shape of the population it
        //         stands for, never the shape of the happy path
        //
        // .note = the `tmpDir` is DERIVED and masked, for `[case9]`'s reason — it
        //         is the one interpolation in this render that names a real
        //         directory rather than an entry within it, and a hand-written
        //         `/tmp/test-fns/scope` reads from the `.snap` alone as a live path
        const { pathPhysical } = getOneTempDirRoot();
        const spoken = getAllLinesSpoken(() => {
          reportUnreadableNames({
            audit: {
              dirsReclaimed: [],
              markersReclaimed: [],
              residue: [],
              namesUnreadable: ['not-a-temp-dir-name', 'also.not.one'],
            },
            tmpDir: pathPhysical,
          });
        });

        expect(
          asTerminalText(spoken).split(pathPhysical).join('<tmpDir>'),
        ).toMatchSnapshot();

        // the functional half. flip this render's `├─` to `└─` and a lone snapshot
        // rewrites itself green on a dev machine — so it is the render that most
        // owes an assertion that bites
        const glyphed = getAllLinesGlyphed({ text: spoken.join('\n') });
        expect(glyphed).toHaveLength(3);
        expect(glyphed.filter((line) => line.includes('└─'))).toHaveLength(1);
        expect(glyphed[2]).toContain('└─ fix:');

        // the COUNT in the header must equal the names beneath it — a header that
        // says 2 over 3 lines sends a human to hunt an entry we never named
        // .note = the noun AGREES with that count — never `2 temp-dir name(s)`,
        //         the lazy suffix `rule.forbid.snapshot-visual-blemishes` forbids;
        //         the singular render is clamped at `asCountAgreement`
        expect(spoken.join('\n')).toContain('2 temp-dir names');
      });
    });
  });

  given('[case11] a temp root the age gate cannot even open', () => {
    when('[t0] the gate fails outright rather than partly', () => {
      then(
        '🔴 it says the gate itself is down, and reads as here',
        async () => {
          // .why = every other message here reports an entry the gate DECLINED. this
          //        one reports that the gate never ran at all — the difference
          //        between "one dir survived" and "every dir will survive, forever"
          const pathRoot = genTempDir({ slug: 'gate-down-root' });
          const spoken: string[] = [];
          const errorBefore = console.error;

          // 🔴 this repo DOGFOODS autoprune, so its own `setupAutoprune` has already
          // stamped the sweep key on this process's env. `pruneStaleOnce` reads that
          // stamp and returns at once — correct in production, and it would make this
          // case assert against a gate that never ran. so the case OWNS the key for
          // its duration rather than inherits whatever the harness left
          const sweptBefore = process.env[GATE_SWEPT_ENV_KEY];
          delete process.env[GATE_SWEPT_ENV_KEY];

          try {
            fs.chmodSync(pathRoot, 0o000);
            resetPruneThrottle();
            console.error = (...args: unknown[]): void => {
              spoken.push(args.map(String).join(' '));
            };

            // .note = `pruneStaleOnce` fires WITHOUT a block by design — it is the
            //         unhooked consumer's reclaim and must not stall the genTempDir
            //         call that triggers it. so the report lands on a later tick,
            //         and this polls for it rather than guesses a sleep
            await pruneStaleOnce({ tmpDir: pathRoot });
            for (let tick = 0; tick < 200 && spoken.length === 0; tick += 1)
              await new Promise((settle) => setTimeout(settle, 5));
          } finally {
            console.error = errorBefore;
            fs.chmodSync(pathRoot, 0o700);
            fs.rmSync(pathRoot, { recursive: true, force: true });
            resetPruneThrottle();
            if (sweptBefore !== undefined)
              process.env[GATE_SWEPT_ENV_KEY] = sweptBefore;
          }

          // guard the guard: run as root, the chmod refuses no one and the gate
          // succeeds — which would snapshot an empty string as though it were a
          // message. this fails loud instead
          expect(spoken.join('\n')).toContain('failed to run');

          // 🔴 this is the ONE export in this file whose text is not wholly ours.
          // its `cause:` line is `String(error)` over a real fs rejection, and that
          // string has THREE parts with three different owners:
          //
          //   Error: EACCES: permission denied, scandir '<tmpDir>'
          //          ^^^^^^  ^^^^^^^^^^^^^^^^^  ^^^^^^^  ^^^^^^^^
          //          errno   libuv's strerror   syscall  ours
          //          STABLE  VOLATILE           STABLE   masked
          //
          // the errno and the syscall are node's public `NodeJS.ErrnoException`
          // surface and do not move. `permission denied` is libuv's `uv_strerror`
          // prose — platform- and version-coupled, and the one part an upstream
          // could reword without a defect on our side.
          //
          // 🔴 to snapshot all three UNMASKED and defend it in prose — *"a red diff
          // with the errno and the shape intact and only the prose moved is an
          // upstream reword — accept the new text."* — puts a HUMAN JUDGMENT CALL
          // in the CI path: a libuv reword then reddens this export for every
          // consumer of this repo's pipeline, for a non-defect, and clears only
          // once someone reads a comment. a rule that says to mask a volatile
          // field is not answered by a note that says to forgive it.
          //
          // the split is what satisfies both: the two STABLE parts are asserted as
          // fragments (below), where an upstream reword cannot reach them; the
          // volatile prose is masked in the SNAPSHOT, which exists to carry the
          // SHAPE. the product still prints the real text to the human — the mask
          // is a property of the record, never of the message
          expect(spoken.join('\n')).toContain('EACCES');
          expect(spoken.join('\n')).toContain('scandir');

          expect(
            asStrerrorMasked(
              asTerminalText(spoken).split(pathRoot).join('<tmpDir>'),
            ),
          ).toMatchSnapshot();
        },
      );
    });
  });

  given('[case12] a run whose stamp never reached the workers', () => {
    when('[t0] the broken-chain guard fires', () => {
      then(
        // 🔴 the WHY rides in the test NAME, because the name IS the snapshot
        // key — the one line of ours a snapshot reviewer reads. a reviewer meets
        // this single final newline as a blemish and files it, and an answer
        // parked in a comment or a `.taken` file sits where they never look. see
        // the acceptance-grain twin (`[case14]`) for the full record.
        '🔴 the report a maintainer reads is shaped as here — ONE closing newline, never two, since a throw is the last word the process speaks and has no successor to be held apart from',
        () => {
          // 🔴 the FOURTH critipath this file's own header claims to render. absent
          // this export that claim is prose no gate grades, which is the shape this
          // whole behavior exists to end: `toContain` fragments prove the words
          // present and leave the SHAPE a maintainer reads rendered nowhere
          //
          // .why it earns a snapshot more than most = this report ships to every
          //      consumer and fires years out, on a runner upgrade, at a human who
          //      has never read this repo. it is a hand-off document, and the whole
          //      of its value is legibility
          const tmpDir = genTempDir({ slug: 'msg-mintchain-broken' });
          fs.mkdirSync(
            path.join(
              tmpDir,
              computeTempDirName({ slug: 'orphan', run: null }),
            ),
          );

          const error = ((): Error => {
            try {
              assertMintChainHeld({
                tmpDir,
                run: 'rbadc0de1',
                since: new Date(Date.now() - 60 * 1000),
                runner: 'jest',
              });
            } catch (caught) {
              if (!(caught instanceof Error)) throw caught;
              return caught;
            }
            // guard the guard: an absent throw would snapshot a message that never
            // rendered, and the export would seal a fiction
            throw new Error('the broken-chain guard did not fire');
          })();

          // 🔴 the report is a TREESTRUCT the message itself carries, never
          // `helpful-errors` metadata.
          //
          // .why NOT metadata = a metadata dump renders through `ERROR_EXPAND`,
          //      read once at module load — so a consumer's env var decides the
          //      shape, and the ONE message a human meets at the worst moment is
          //      the one rendered in a shape no other message here uses. held in
          //      the message, the export is ours end to end and no env var can
          //      churn it
          expect(error.message).toContain('   ├─ run: ');
          expect(error.message).toContain('   └─ fix: ');

          // .note = `<version>` for BOTH lines, never `<node>` for one and
          //         `<version>` for the other. this render is snapped at two
          //         grains — here, and at `autoprune.acceptance` `[case14]` —
          //         and two tokens for one concept leave a reviewer who diffs the
          //         `.snap` files with `node: <node>` beside `node: <version>`,
          //         unable to tell drift from convention. the LABEL already says
          //         WHICH version it is, so
          //         the token needs only to say *a version*
          //         (`rule.forbid.ambiguous-labels`)
          const rendered = error.message
            .split(process.version)
            .join('<version>')
            .replace(/jest@[\d.]+/g, 'jest@<version>')
            .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
            .replace(/\.[a-f0-9]{8}(?=$|\D)/g, '.<hex>')
            // never end flush against jest's delimiter — see `asTerminalText`
            .replace(/\n?$/, '\n');

          expect(rendered).toMatchSnapshot();

          // 🔴 a THROWN message ends with ONE newline; a `sayReport` block ends with
          // TWO. that is the EMITTER, never a capture artifact — `sayReport` closes
          // each block with a blank line so two stacked reports do not run together,
          // while an uncaught throw is the last word the process speaks and so has
          // no successor to separate from.
          //
          // .note = careful readers read this difference as a blemish, and a fact
          //         careful readers get wrong is a fact the artifact fails to
          //         state. a prose note here does not reach them — a snapshot
          //         reviewer opens the `.snap`, never the `.ts`. so the reason
          //         rides the TEST NAME, which IS the snapshot KEY: the one line
          //         of ours that appears in the file they read.
          //
          //         the clamp stays here and in its mirror at `[case3]`, so a
          //         change that unifies the two shapes must delete an assertion
          //         that says why they differ.
          expect(rendered.endsWith('above.\n')).toEqual(true);
          expect(rendered.endsWith('\n\n')).toEqual(false);

          // the functional half — the report's whole value is that it sends a
          // maintainer to the handoff that broke, so both versions must survive
          //
          // .note = these two read the LABEL as well as the token, and that is
          //         what keeps them meaningful once one token serves both lines.
          //         a bare `<version>` would hold even if the node line vanished
          //         and the runner line stayed, since the mask fires on both —
          //         so the token alone does not name which line it came from
          expect(rendered).toContain('node: <version>');
          expect(rendered).toContain('runner: jest@<version>');
        },
      );
    });
  });

  given('[case13] a prior run that left SEVERAL dirs behind', () => {
    when('[t0] the next run reports its arrears', () => {
      // 🔴 the SCALE, which an arrears render built on a tmpDir that holds no dirs
      // of the dead run cannot exercise: its count renders as `0`, so the number
      // that matters goes ungraded. two catalog critipaths assert it reaches the
      // human — `case=12` [t3] (`toContain(String(dirsMadeByRun))`) and `case=11`
      // [t1a], whose whole dated-ledger census depends on it
      //
      // .why it carries weight = "1 prior test run never reclaimed its temp dirs"
      //      reads identically at 3 dirs and at 12,000. the wish's own origin is
      //      12,369 dirs that accrued one silent run at a time, so a report that
      //      omits the scale reproduces the defect it exists to end
      // .note = both ids must be HEX — `r[a-f0-9]{8}`. a mnemonic such as
      //         `rscale001` / `rpeer0001` meets `case=14`'s mint guard, which
      //         refuses it at the first mkdir rather than let it through to become
      //         a dir the age gate could never parse. that guard exists precisely
      //         so an unparseable name cannot reach disk
      const RUN_DEAD = 'rdec0de01';
      const RUN_PEER = 'rfeed0001';
      const COUNT_DIRS = 3;

      then('🔴 it names the SCALE, and the render reads as here', () => {
        const tmpDir = genTempDir({ slug: 'msg-arrears-scale' });
        for (let index = 0; index < COUNT_DIRS; index++)
          fs.mkdirSync(
            path.join(
              tmpDir,
              computeTempDirName({ slug: `scale-${index}`, run: RUN_DEAD }),
            ),
          );
        setRunMarker({
          tmpDir,
          marker: {
            run: RUN_DEAD,
            pid: PID_UNANSWERABLE,
            startedAt: STARTED_AT,
            state: 'open',
            reportedAt: null,
            residue: [],
            teardownWired: true,
          },
        });

        const spoken = getAllLinesSpoken(() => {
          reportRunArrears({
            tmpDir,
            run: 'rc0de0001',
            maxAgeMs: 1000,
            now: NOW,
          });
        });

        expect(asTerminalText(spoken)).toMatchSnapshot();
        expect(spoken.join('\n')).toContain(
          `${COUNT_DIRS} temp dirs still on disk`,
        );
      });

      then(
        'and it counts OUR dead run only, never a live peer beside it',
        () => {
          // 🔴 a count is as reapable-by-mistake as a delete. the whole design rests
          // on ownership by the NAME, and a tally that swept the dir would tell a
          // human their dead run left 8 dirs when 5 of them belong to a colleague's
          // suite in flight — the same false attribution that made `case=10`'s first
          // guard fire on a healthy run beside a peer
          const tmpDir = genTempDir({ slug: 'msg-arrears-scale-peer' });
          for (let index = 0; index < COUNT_DIRS; index++)
            fs.mkdirSync(
              path.join(
                tmpDir,
                computeTempDirName({ slug: `ours-${index}`, run: RUN_DEAD }),
              ),
            );
          // the peer's, which must be invisible to this tally
          for (let index = 0; index < 5; index++)
            fs.mkdirSync(
              path.join(
                tmpDir,
                computeTempDirName({ slug: `theirs-${index}`, run: RUN_PEER }),
              ),
            );
          setRunMarker({
            tmpDir,
            marker: {
              run: RUN_DEAD,
              pid: PID_UNANSWERABLE,
              startedAt: STARTED_AT,
              state: 'open',
              reportedAt: null,
              residue: [],
              teardownWired: true,
            },
          });

          const spoken = getAllLinesSpoken(() => {
            reportRunArrears({
              tmpDir,
              run: 'rc0de0001',
              maxAgeMs: 1000,
              now: NOW,
            });
          });

          expect(spoken.join('\n')).toContain(
            `${COUNT_DIRS} temp dirs still on disk`,
          );
          expect(spoken.join('\n')).not.toContain('8 temp dirs');
          expect(spoken.join('\n')).not.toContain(RUN_PEER);
        },
      );
    });
  });

  given('[case14] the HAPPY path — a run that reclaims cleanly', () => {
    // 🔴 every other case here is a failure or an edge: thirteen cases grade WHAT
    // this behavior says when a state is wrong, and none of them grades that it
    // says NO WORD when all is well.
    //
    // silence is a contract like any other, and it is the one a consumer meets on
    // every green run — so it is the highest-traffic render in the whole behavior,
    // and the easiest to leave unheld. a stray `console.error` at any of the nine
    // emission sites would print on EVERY run of EVERY consumer's suite, forever,
    // and every other export in this file would stay green
    // (`rule.require.contract-snapshot-exhaustiveness` — the positive path is a
    // variant, and an exhaustive record owes it)
    //
    // .note = 🔴 SNAPPED **and** asserted, never asserted alone. the case against a
    //         snapshot here — *"an empty snapshot is indistinguishable from a
    //         snapshot of a render that failed to happen"* — is a real objection
    //         whose remedy is not omission: this repo answers it at `[case17]
    //         [t1]`, where the empty render IS on the record so *"a change that
    //         made a later run speak again lands as a diff rather than a judgement
    //         call"*.
    //
    //         two rationales for one situation, in one repo, is exactly the drift
    //         the snapshot rubric exists to end. the KEYED shape settles it: the
    //         render is snapped as `{ spoken, countDirsLeft }`, so an empty
    //         `spoken` beside a `0` is plainly distinct from a record that never
    //         happened — and the functional half rides IN the snapshot rather than
    //         beside it, which is what makes the silence attributable
    //
    //         the `toEqual([])` rows stay too. a snapshot alone is rewritten green
    //         by the very run that should have failed it
    when('[t0] the teardown reclaims every dir it made', () => {
      then('🔴 it says NO WORD — a green run is a silent run', async () => {
        const { pathPhysical } = getOneTempDirRoot();
        const run = genRunId();

        // a real run: an open marker, and dirs of its own to take
        setRunMarker({
          tmpDir: pathPhysical,
          marker: genRunMarkerOpen({ run, teardownWired: true }),
        });
        for (let index = 0; index < 3; index++)
          fs.mkdirSync(
            path.join(
              pathPhysical,
              computeTempDirName({ slug: `happy-${index}`, run }),
            ),
            { recursive: true },
          );

        const spoken = await withEnv(
          // .note = the hold key is REMOVED rather than left inherited — a machine
          //         with it set would take the hold branch, print, and this export
          //         would report a defect that is the developer's shell
          { [RUN_ID_ENV_KEY]: run, [KEEP_ENV_KEY]: null },
          async () =>
            await getAllLinesSpokenAsync(
              async () => await teardownAutoprune({ runner: 'jest' }),
            ),
        );

        // guard the guard: silence is trivially achievable by a teardown that did
        // no work at all, so the FUNCTIONAL half rides INSIDE the record — the
        // dirs and the marker are gone, which is the only state that earns it
        const namesLeft = fs
          .readdirSync(pathPhysical)
          .filter((name) => name.includes(run));

        // 🔴 the render, on the record. `countDirsMade` is what makes the two
        // zeros attributable: an empty `spoken` beside `made: 3, left: 0` is a
        // teardown that did the work and said no word, which no `{}` could claim
        expect({
          spoken,
          countDirsMade: 3,
          namesLeft,
        }).toMatchSnapshot();

        expect(spoken).toEqual([]);
        expect(namesLeft).toEqual([]);
      });
    });
  });

  given('[caseZ] the message family, graded as ONE surface', () => {
    when(
      '[t0] every export this behavior has ever rendered is read at once',
      () => {
        // 🔴 a COUNT over the whole family, never a convention held per site. a
        // convention held per site splits the family — the blank-line separator
        // across nine emitters, the terminal newline across fourteen exports, the
        // `run` label across three renders — and a repair made only at the site a
        // reviewer quoted leaves every other site adrift.
        //
        // .why the SNAPSHOTS are the subject = they are the complete record of
        //      every message this behavior speaks. a per-emitter assertion grades
        //      what its author remembered to grade; the `.snap` files grade what a
        //      consumer actually reads, and a NEW message joins this clamp with no
        //      edit at all
        //
        // .note = it reads the snapshot as TEXT rather than through jest's
        //         serializer, deliberately. the defect class is what a human sees
        //         in a diff, so the bytes in the file are the honest subject
        //
        // 🔴 it grades the ACCEPTANCE snapshot ONLY, and that exclusion is the
        //    whole reason this clamp can be trusted. a run cannot honestly grade a
        //    file it is itself rewriting: under `--resnap` jest writes the new
        //    `.snap` during the same run, so a clamp over THIS suite's own
        //    snapshot races the writer and passes on whatever it happened to read
        //    first. proven on this very clamp: revert the product to the bare
        //    `run ` form, run with `--resnap`, and it reports GREEN.
        //
        //    *a clamp that grades an artifact its own run mutates is a clamp that
        //    grades a timing accident.* so the file-grade covers the one snapshot
        //    this suite never writes, and the live render below covers the rest.
        const readAcceptanceExports = (): string =>
          fs.readFileSync(
            path.join(
              __dirname,
              '__snapshots__',
              'autoprune.acceptance.jest.test.ts.snap',
            ),
            'utf-8',
          );

        // the LIVE half — race-free by construction, since it renders the message
        // here rather than read a record of one. `reportRunArrears` is the emitter
        // that owns the `run` label, so it is the one this pair must exercise
        const renderArrearsLive = (): string => {
          const tmpDir = genTempDir({ slug: 'msg-family-live' });
          plantDirsOfRun({ tmpDir, run: 'rfa0000a1', count: 2 });
          setRunMarker({
            tmpDir,
            marker: {
              run: 'rfa0000a1',
              pid: PID_UNANSWERABLE,
              startedAt: STARTED_AT,
              state: 'open',
              reportedAt: null,
              residue: [],
              teardownWired: true,
            },
          });
          return getAllLinesSpoken(() => {
            reportRunArrears({
              tmpDir,
              run: 'rc0de0001',
              maxAgeMs: 1000,
              now: NOW,
            });
          }).join('\n');
        };

        const readAllExports = (): string =>
          [readAcceptanceExports(), renderArrearsLive()].join('\n');

        then(
          '🔴 one concept wears ONE label — `run:`, never a bare `run`',
          () => {
            const text = readAllExports();

            // guard the guard: a clamp over an empty read passes vacuously, so a
            // wrong scope converts into a silent approval
            expect(text).toContain('run: ');

            // the bare form, which `reportRunArrears` must never regress to
            expect(text).not.toMatch(/├─ run [a-z0-9<]/);
          },
        );

        then('🔴 and every tree label carries its colon', () => {
          const text = readAllExports();

          // every `├─`/`└─` line that opens a labelled field must read
          // `label: value`. a line with no colon at all is a title or a bare path,
          // which is legal — so the grade covers only lines that name a KNOWN
          // field of this family
          //
          // .note = the lookahead admits a QUALIFIED label — `fix (jest):` and
          //         `fix (vitest):` are one field split by runner, so the colon
          //         sits after the qualifier rather than after the word. to forbid
          //         that shape reddens five legitimate lines, which is the clamp
          //         itself over-reaching: *a rule that
          //         grades a family must admit every form the family already
          //         uses, or it grades its own author's memory instead*
          //
          // .note = `\b` keeps `run` from a match inside `runner`, so the two
          //         labels are graded as the distinct fields they are
          const labels = [
            'cause',
            'fix',
            'at',
            'run',
            'node',
            'runner',
            'orphan',
            'unparseable',
            'scope',
            'quiet',
          ];
          for (const label of labels)
            expect(text).not.toMatch(new RegExp(`[├└]─ ${label}\\b(?!:| \\()`));
        });
      },
    );
  });
});
