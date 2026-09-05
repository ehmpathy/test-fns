import { UnexpectedCodePathError } from 'helpful-errors';

import * as fs from 'node:fs';
import * as path from 'node:path';
// .note = RELATIVE, never the @src alias. this module sits on the globalSetup +
//         globalTeardown path, which jest loads OUTSIDE its moduleNameMapper
import type { RunMarker } from '../../domain.objects/RunMarker';
import {
  asErrnoCode,
  ERRNOS_ENTRY_ABSENT,
} from '../../infra/isomorph.fs/asErrnoCode';
import { RUN_STAMP_PATTERN } from './getOneRunId';

// .note = re-exported so every extant importer of `runMarker` keeps one import for
//         the type AND its readers. the DECLARATION lives in domain.objects/, per
//         this repo's PascalCase type-led convention; this file holds the operations
export type { RunMarker };

/**
 * the filename prefix that marks a run marker
 *
 * .why = it must sit OUTSIDE the fixture name pattern, so no run-scoped reclaim
 *        reads a marker as a candidate and deletes its own evidence mid-run
 */
const RUN_MARKER_PREFIX = 'run.';

/** the filename suffix that marks a run marker */
const RUN_MARKER_SUFFIX = '.marker.json';

/**
 * .what = tells whether a filename is a run marker
 * .why = the age gate sweeps markers in a pass of its own, and must not sweep
 *        the readme.md / .gitignore that share the same root
 */
export const isRunMarkerName = (input: { name: string }): boolean =>
  input.name.startsWith(RUN_MARKER_PREFIX) &&
  input.name.endsWith(RUN_MARKER_SUFFIX);

/**
 * .what = computes the path of one run's marker
 * .why = each run owns exactly one marker, addressed by its id
 *
 * .note = a marker is a FILE, never a directory — the age gate's dir sweep
 *         filters on isDirectory(), so a file is skipped there by construction
 *         rather than by a rule someone must remember
 */
const getOneRunMarkerPath = (input: { tmpDir: string; run: string }): string =>
  path.join(
    input.tmpDir,
    `${RUN_MARKER_PREFIX}${input.run}${RUN_MARKER_SUFFIX}`,
  );

/**
 * .what = writes a run's marker, whole
 * .why = each state must be on disk BEFORE the work it describes, so a process
 *        that dies mid-work leaves the truthful record rather than a stale one
 *
 * .note = 🔴 it REFUSES a run id no mint could produce. a marker path and a dir
 *         name are the only two ways a run id reaches disk, and the dir name is
 *         guarded at its own mint (`computeTempDirName` asserts its output parses
 *         back). guard one pole and leave the other open, and a fixture may write
 *         an id like `rhalfwire` — unmintable, and invisible precisely because a
 *         marker never passes through the mint — then render it into a snapshot a
 *         reviewer reads as product output
 */
export const setRunMarker = (input: {
  tmpDir: string;
  marker: RunMarker;
}): void => {
  if (!RUN_STAMP_PATTERN.test(input.marker.run))
    UnexpectedCodePathError.throw(
      'test-fns: asked to write a run marker whose run id no mint could produce',
      {
        run: input.marker.run,
        hint: 'a run id must match r[a-f0-9]{8}',
      },
    );

  fs.mkdirSync(input.tmpDir, { recursive: true });
  fs.writeFileSync(
    getOneRunMarkerPath({ tmpDir: input.tmpDir, run: input.marker.run }),
    JSON.stringify(input.marker, null, 2),
    'utf8',
  );
};

/**
 * .what = reads one run's marker
 * .why = the teardown settles its own marker
 *
 * .note = it reads through the SAME guarded read as getAllRunMarkers, so an absent
 *         marker and an unreadable one are one verdict rather than two code paths.
 *         an `existsSync` + an unguarded read is a check-then-act pair that answers
 *         the question twice and still throws when the answer changes between them
 *
 * .note = the pair IS reachable, though only for our own marker: the age gate's
 *         marker sweep reclaims a marker older than the window, so a run that
 *         outlives its own configured window can have its live marker swept by a
 *         peer's setup. an unguarded read would then fail a green suite AT teardown
 *
 * @returns the marker, or null when there is none we can read
 */
export const getOneRunMarker = (input: {
  tmpDir: string;
  run: string;
}): RunMarker | null =>
  asRunMarker({
    content: getOneFileContent({ path: getOneRunMarkerPath(input) }).content,
  });

/**
 * .what = reads every run marker in a temp root
 * .why = the arrears check asks of ALL markers which runs never settled
 *
 * .note = a marker we cannot READ or parse is yielded as null, never dropped — a
 *         silently skipped marker is a casualty no one is ever told about
 *
 * .note = 🔴 the read is guarded, and it is the ONE read in this behavior that
 *         must be. every marker here but our own belongs to ANOTHER RUN, and a
 *         peer's teardown removes its own marker the moment it finishes — so
 *         between this readdir and this read, a file can genuinely vanish. an
 *         unguarded read would throw ENOENT out of `globalSetup`, which kills the
 *         whole run before a single test executes.
 *
 *         that would make a peer's *successful* finish destroy a live run — the one
 *         failure mode this design keeps off the table everywhere else, since every
 *         other path fails toward LEAK and never toward LOSS
 */
/**
 * the one fault value that names a marker whose BYTES arrived and are wrong
 *
 * .why = every OTHER fault this reader can report is an errno from the os — the file
 *        was not handed over at all. that split decides what a human can DO: a
 *        permission is widenable, a torn write is not. so the arrears report branches
 *        on it, and the word must be one constant rather than a literal at each site
 *        (`rule.require.ubiqlang`)
 */
export const FAULT_TORN_WRITE = 'unparseable';

export const getAllRunMarkers = (input: {
  tmpDir: string;
}): Array<{
  marker: RunMarker | null;
  name: string;
  /**
   * why this marker could not be judged, or null when it was judged fine
   *
   * .why = 🔴 "could not be read" is ONE answer with several causes — a vanished
   *        file, a permission, an i/o fault, a torn write. a human told only the
   *        name is sent to remove a file by hand whatever the cause. the fault
   *        travels so the report can name it
   *
   * .note = a VANISHED marker carries no fault and no marker: it is a benign race,
   *         and there is no residue left to tell anyone about
   */
  fault: string | null;
}> => {
  if (!fs.existsSync(input.tmpDir)) return [];
  return fs
    .readdirSync(input.tmpDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => isRunMarkerName({ name: entry.name }))
    .map((entry) => {
      const read = getOneFileContent({
        path: path.join(input.tmpDir, entry.name),
      });
      const marker = asRunMarker({ content: read.content });

      // a read that succeeded and a parse that did not is its own fault class —
      // a torn write, never a permission — and it needs its own word
      const fault = ((): string | null => {
        if (read.fault !== null) return read.fault;
        if (read.content !== null && marker === null) return FAULT_TORN_WRITE;
        return null;
      })();

      return { name: entry.name, marker, fault };
    });
};

/**
 * .what = reads a file, and NAMES the fault when it cannot
 * .why = 🔴 it must not throw — see `getAllRunMarkers`, whose note explains that a
 *        throw here turns a peer's SUCCESSFUL finish into a killed run. and it must
 *        not swallow either, which is `rule.forbid.failhide`. so it does neither: it
 *        catches, and it hands the errno back for a human to read
 *
 *        the distinction the fault preserves:
 *          - ENOENT  → the marker VANISHED between our readdir and this read. benign,
 *                      routine, and there is no longer an entry to tell anyone about,
 *                      so it reports NO fault
 *          - any other → a real problem (a permission, an i/o fault, a bad fd). the
 *                      code travels to the arrears report, so the human is told
 *                      `EACCES: run.x.marker.json` rather than a bare "unreadable"
 *
 *        a swallowed EACCES read as a benign race was the defect. the cure is to
 *        name it, never to throw it out of a global setup
 */
const getOneFileContent = (input: {
  path: string;
}): { content: string | null; fault: string | null } => {
  try {
    return { content: fs.readFileSync(input.path, 'utf8'), fault: null };
  } catch (error) {
    const errno = asErrnoCode({ error });
    if (ERRNOS_ENTRY_ABSENT.includes(errno ?? ''))
      return { content: null, fault: null };
    return { content: null, fault: errno ?? 'UNKNOWN' };
  }
};

/**
 * .what = removes one run's marker
 * .why = idempotent; a marker already gone is not an error
 */
export const delRunMarker = (input: { tmpDir: string; run: string }): void => {
  fs.rmSync(getOneRunMarkerPath(input), { force: true });
};

/**
 * .what = casts marker file content into a RunMarker
 * .why = a half-written marker (its process died mid-write) must read as
 *        unparseable rather than as a valid record with absent fields
 *
 * .note = `content` is nullable, since a marker another process owns may vanish
 *         between a readdir and a read. an absent file and an unparseable one
 *         are the same verdict here — neither is a marker we can judge
 *
 * @returns the marker, or null when the content is not a whole one
 */
const asRunMarker = (input: { content: string | null }): RunMarker | null => {
  const parsed = asOneJsonObject({ content: input.content });
  if (!parsed) return null;
  if (!isRunMarker(parsed)) return null;

  // rebuilt field by field rather than cast, so an unknown key a future version
  // writes cannot ride along into a record every reader treats as ours
  return {
    run: parsed.run,
    pid: parsed.pid,
    startedAt: parsed.startedAt,
    state: parsed.state,
    reportedAt: parsed.reportedAt,
    residue: parsed.residue,
    teardownWired: parsed.teardownWired,
  };
};

/**
 * .what = reads content as a json object, or null when it is neither
 * .why = a torn write leaves partial json, so the parse must be guarded — and an
 *        absent file, an unparseable one, and a json scalar are ONE verdict here:
 *        no marker we can judge
 */
const asOneJsonObject = (input: { content: string | null }): object | null => {
  const content = input.content;
  if (content === null) return null;

  const parsed = ((): unknown => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  })();
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed;
};

/**
 * .what = tells whether a json object carries every field of a whole RunMarker
 * .why = 🔴 narrowed via `in`, never an as-cast. this file is written by ANOTHER
 *        process — and possibly by an older version of this library — so its shape
 *        must be CHECKED rather than asserted (rule.forbid.as-cast).
 *        getOneRunnerVersion reads a foreign manifest the same way
 *
 * .note = it is a predicate of its own rather than a run of checks inside the cast,
 *         so the cast reads as three steps — parse, verify, rebuild — instead of one
 *         block whose shape questions and its construction are interleaved
 */
const isRunMarker = (parsed: object): parsed is RunMarker => {
  if (!('run' in parsed) || typeof parsed.run !== 'string') return false;
  if (!('pid' in parsed) || typeof parsed.pid !== 'number') return false;
  if (!('startedAt' in parsed) || typeof parsed.startedAt !== 'string')
    return false;
  if (!('state' in parsed) || !isRunMarkerState(parsed.state)) return false;
  if (!('reportedAt' in parsed)) return false;
  if (parsed.reportedAt !== null && typeof parsed.reportedAt !== 'string')
    return false;
  if (!('residue' in parsed) || !isResidueList(parsed.residue)) return false;
  if (!('teardownWired' in parsed) || typeof parsed.teardownWired !== 'boolean')
    return false;
  return true;
};

/**
 * .what = tells whether a value is a whole list of residue entries
 * .why = 🔴 the residue was once checked for its ARRAY-NESS alone, so an entry with
 *        no errno rode through a validator whose stated job is to reject a partial
 *        record. it is the ONE field a human is sent to ACT on — the arrears report
 *        prints `${errno}: ${path}` from it — so an unchecked element reaches them
 *        as `undefined: undefined`, which addresses them nowhere
 */
const isResidueList = (value: unknown): value is RunMarker['residue'] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      !!entry &&
      typeof entry === 'object' &&
      'path' in entry &&
      typeof entry.path === 'string' &&
      'errno' in entry &&
      typeof entry.errno === 'string',
  );

/**
 * .what = tells whether a value is one of the three marker states
 * .why = an unknown state must read as unparseable, never coerce to a known one
 */
const isRunMarkerState = (value: unknown): value is RunMarker['state'] =>
  value === 'open' || value === 'partial' || value === 'held';

/**
 * .what = builds a fresh `open` marker for a run that is about to begin
 * .why = written ahead of the tests, so a process killed mid-suite leaves it
 */
export const genRunMarkerOpen = (input: {
  run: string;
  /** REQUIRED — see RunMarker.teardownWired; a default here would fabricate evidence */
  teardownWired: boolean;
}): RunMarker => {
  if (!input.run)
    UnexpectedCodePathError.throw('cannot mark a run with no id', {
      run: input.run,
    });
  return {
    run: input.run,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    state: 'open',
    reportedAt: null,
    residue: [],
    teardownWired: input.teardownWired,
  };
};
