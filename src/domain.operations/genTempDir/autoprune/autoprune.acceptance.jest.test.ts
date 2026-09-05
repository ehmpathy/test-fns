/**
 * .what = the regression clamp for the defect this behavior repairs: genTempDir
 *         allocated and never reclaimed, so every run leaked its fixture dirs
 * .why = the clamp must BITE — red under the un-fixed defect, green under the fix
 *        (`rule.require.clamp-edge-cases`). so it counts the dirs a real run makes
 *        and the dirs that same run leaves, and asserts the second is zero
 *
 * .note = it runs in a CHILD PROCESS, and that carries three loads at once:
 *         1. the run id lives in `process.env`, so a same-process exercise would
 *            clobber the OUTER run's id and strand the outer run's own dirs
 *         2. a global hook loads outside the runner's moduleNameMapper, so only a
 *            child that requires from `dist/` exercises the COMPILED artifact
 *            rather than the sources we happen to hold
 *
 *         3. the child is NESTED inside our own run, which is the exact shape that
 *            proves a nested teardown cannot reap its parent's live dirs
 *
 * .note = 🔴 every ACTION resolves through the `exports` MAP, never a deep dist path
 *         — `rule.require.acceptance.blackbox`. the child requires `.` for the
 *         allocation and `./autoprune.setup.jest` / `./autoprune.teardown.jest` for
 *         the hooks, exactly as a consumer's runner config does. a deep path such as
 *         `dist/domain.operations/genTempDir/autoprune/setupAutoprune.js` is SEALED by
 *         the exports map — a clamp that reaches for one walks a road closed to the
 *         very people it claims to walk it for, and skips both `isTeardownWired` and
 *         `warnIfUnhooked`, which only the contract wrapper calls
 *
 *         the seam itself is separately clamped by
 *         `src/contract/autoprune.exports.acceptance.jest.test.ts`
 *         — and *a peer test that covers the seam does not make THIS test blackbox*
 *
 * .note = SETUP and VERIFY may still read internals (the rule permits both); only the
 *         ACTION must cross the contract. so the count below goes through the public
 *         `isTempDir`, and no internal parser is imported at all
 *
 * .note = it is PEER-SAFE by the same property the behavior itself rests on: it
 *         counts only dirs stamped by the child's own run id, so the outer suite's
 *         live dirs cannot perturb it and it cannot perturb them
 */
import { given, then, useThen, when } from '@src/contract';
import { KEEP_ENV_KEY } from '@src/domain.operations/genTempDir/autoprune/teardownAutoprune';
import {
  GATE_SWEPT_ENV_KEY,
  RUN_ID_ENV_KEY,
} from '@src/domain.operations/genTempDir/getOneRunId';
import { MAX_AGE_ENV_KEY } from '@src/domain.operations/genTempDir/pruneStale';
import { getGitRoot } from '@src/infra/isomorph.fs/getGitRoot';

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** how many dirs the child allocates before its teardown fires */
const DIRS_TO_ALLOCATE = 3;

/** the token the child wraps its verdict in, so log noise cannot be parsed as one */
const VERDICT_TOKEN = '<<J1>>';

/**
 * .what = renders a child's verdict record as an ordered list of `key: type`
 * .why = every `then` that grades a verdict by NAME is blind to the two drifts that
 *        cost a consumer most: a field ADDED (no assertion covers it) and a field
 *        RENAMED (`countLeft` → `countKept`, whereupon `outcome.countLeft` reads
 *        `undefined` and the sole red names the wrong cause). the shape record
 *        catches both, and it is the clamp `[case6] [t0]` and `[t1]` share
 *
 * .note = an ARRAY of `key: type` rather than an object, for the reason
 *         `autoprune.exports…` `[case2] [t2]` records: jest's `pretty-format`
 *         SORTS object keys, so an object would grade the key SET and silently
 *         re-hide a reorder
 */
const asShape = (record: Record<string, unknown>): string[] =>
  Object.entries(record).map(([key, value]) => `${key}: ${typeof value}`);

/**
 * the age window the held-run child is pinned to — one day, the library default
 *
 * .why = the hold message RENDERS this number, so an inherited value would put a
 *        figure in the snapshot that no test chose. pinned here, the render is a
 *        function of this file rather than of the machine it runs on
 */
const MAX_AGE_MS_PINNED = 86_400_000;

/**
 * the three contract entry points a consumer's runner config names, and the absolute
 * dist file each resolves to
 */
interface ContractPaths {
  /** `test-fns` — the allocation surface a consumer's tests call */
  root: string;
  /** `test-fns/autoprune.setup.jest` — their `globalSetup` value */
  setupJest: string;
  /** `test-fns/autoprune.teardown.jest` — their `globalTeardown` value */
  teardownJest: string;
  /**
   * `test-fns/autoprune.setup.vitest` — their whole `globalSetup` value
   *
   * .why = ONE subpath, never two. vitest takes a single key whose module exports
   *        both halves, so this is the entire vitest contract — and it was the
   *        runner journey no acceptance test drove
   */
  setupVitest: string;
}

/**
 * the value a consumer's jest config holds in its `globalTeardown` slot
 *
 * .why = the setup hook reads that slot to decide whether it is half-wired
 *        (`isTeardownWired`). a child that passed a bare `true` would exercise a
 *        shape jest never produces; this is the literal string a consumer writes
 */
const TEARDOWN_SLOT_WIRED = 'test-fns/autoprune.teardown.jest';

/**
 * remove every entry one run stamped — its dirs AND its marker
 *
 * .why = 🔴 one case in this file (`[case7]`) makes residue ON PURPOSE: a child that
 *        exits with no teardown, so the NEXT child has an unsettled marker to report.
 *        that residue is a FIXTURE, and no production mechanism will take it back —
 *        the reclaim is run-scoped (the run is gone) and the arrears check REPORTS
 *        and never reaps, by design. so it falls to the age gate, a day out.
 *
 *        left there, this file's own suite leaks 3 entries per invocation and the
 *        behavior's acid test (`tree .temp/genTempDir.symlink | tail -2` reads
 *        `1 directory, 2 files`) goes red — a test for a leak, itself a leak.
 *
 * .note = it matches by RUN ID, never by slug or by an mtime window, so it carries
 *         the same peer-safety property the behavior itself rests on: a concurrent
 *         suite's entries are unreachable by construction rather than by a filter we
 *         got right (`rule.prefer.prevent-over-correct`)
 */
/**
 * .what = masks libuv's `strerror` prose, and it alone, out of a rendered errno line
 * .why = a node errno string is `${code}: ${strerror}, ${syscall} '${path}'`. the code
 *        and the syscall are node's public `ErrnoException` surface and do not move;
 *        the strerror text is libuv's, so an upstream reword would redden a snapshot
 *        that carried it — for a non-defect, on every consumer's pipeline
 *
 * .note = it is PRECISE by construction, never by a hand-picked call-site list: the
 *         pattern requires the `, ` that only node's errno format has, so it is a
 *         no-op over OUR OWN errno lines (`${entry.errno}: ${entry.path}`, no comma).
 *         that is why it can ride every render here rather than one
 *
 * .note = the SAME mask, in the same shape, as the integration twin's
 *         `asStrerrorMasked`. one line rendered two ways across two grains is its own
 *         defect — a reviewer who diffs the pair must see one fact, never two
 *
 * .note = the product is untouched — the human still reads libuv's real words. this
 *         is a property of the RECORD, never of the message
 */
const asStrerrorMasked = (text: string): string =>
  text.replace(/([A-Z]+[0-9]*): [^,\n]+, /g, '$1: <strerror>, ');

/**
 * .what = fails if a render still carries a byte that CHURNS between runs
 * .why = 🔴 every journey here masks by hand, and the mask sets DIVERGED: the
 *        residue journeys ([case10], [case15]) mask a dir's timestamp and hex
 *        suffix, while the arrears-only ones ([case7], [case9], [case13]) do not.
 *        that divergence is correct TODAY — an arrears-only report names counts
 *        and a run, never a path, so it has no dir name to mask.
 *
 *        but "correct today" is a fact about the message, recorded in no place
 *        the message can see. add one path line to the arrears report — which
 *        [case15] shows is already a live shape for the `partial` variant — and
 *        three snapshots go volatile, red on every run, for a non-defect. **a
 *        mask set held in step by a reviewer's memory alone falls out of step the
 *        first time nobody is looking.**
 *
 * .note = it is a CLAMP rather than a wider mask, and the difference is the whole
 *         point. a blanket mask over the arrears journeys would hide the very
 *         change that needs a human — it would render a new path line as `<ts>`
 *         and pass. this goes RED instead, at the one moment someone is in a
 *         position to mask it deliberately (rule.prefer.prevent-over-correct)
 *
 * .note = it grades the render AFTER masking, so it says no word about what a
 *         message may contain — only about what a RECORD of one may
 */
const expectNoVolatileBytes = (text: string): void => {
  // a raw wall-clock stamp — in a dir name, a marker's `began`, or prose
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T[\d:.-]+Z/);

  // a raw run id, which is minted fresh on every single run
  expect(text).not.toMatch(/\br[a-f0-9]{8}\b/);

  // a raw pid, which the os hands out differently every time
  expect(text).not.toMatch(/pid \d+/);
};

/**
 * .what = a run id, rendered as a token a snapshot can hold
 * .why = a verdict RECORD carries its run id as a bare field, where
 *        `expectNoVolatileBytes` cannot reach it — that helper grades a rendered
 *        string. a record needs the same guarantee, per field
 *
 * .note = it ASSERTS the input was a run id before it masks. a mask that
 *         silently no-ops is worse than absent: it reads as hermetic while it
 *         writes a live id into the record, and the file's own grammar
 *         (`RUN_STAMP_PATTERN`) is what says whether a value is one
 */
const asStableRun = (run: string): string => {
  expect(run).toMatch(/^r[a-f0-9]{8}$/i);
  return '<run>';
};

/**
 * .what = asks the OS whether a pid still answers, from the test's own side
 * .why = 🔴 it is deliberately NOT `isProcessGone`, and the duplication is the
 *        point. `[case17]`'s whole claim is that the arrears check discriminates by
 *        process liveness — so a verification that called the very predicate under
 *        clamp would agree with it BY CONSTRUCTION, and a regression that made that
 *        predicate answer "gone" for every pid would flip the product and the check
 *        together. an independent probe is what lets the bite probe bite
 *
 * .note = signal 0 asks for existence with no signal delivered, exactly as a human
 *         would at a shell. EPERM means it exists and we may not signal it, so it
 *         answers ALIVE — the same verdict `isProcessGone` reaches by its own road
 */
const isPidAlive = (input: { pid: number }): boolean => {
  try {
    process.kill(input.pid, 0);
    return true;
  } catch (error) {
    if (typeof error !== 'object' || error === null) return false;
    if (!('code' in error)) return false;
    return error.code === 'EPERM';
  }
};

/**
 * .what = reads one run's marker off disk, as a later run's setup would
 * .why = `[case17]` grades WHICH markers the arrears check names, and the verdict
 *        turns on three fields of each — `state`, `pid`, `reportedAt`. a test that
 *        read only stderr could say which run was named and never say why, so a
 *        regression in the predicate and a regression in the render would land as
 *        one indistinguishable red
 *
 * .note = SETUP and VERIFY may read internals; only the ACTION must cross the
 *         contract (this file's header). the read is a raw `JSON.parse` rather than
 *         `getOneRunMarker`, for the same reason `isPidAlive` is not `isProcessGone`
 */
const readRunMarker = (input: {
  root: string;
  run: string;
}): {
  run: string;
  pid: number;
  startedAt: string;
  state: string;
  reportedAt: string | null;
} => {
  const parsed: {
    run: string;
    pid: number;
    startedAt: string;
    state: string;
    reportedAt: string | null;
  } = JSON.parse(
    fs.readFileSync(
      path.join(input.root, `run.${input.run}.marker.json`),
      'utf8',
    ),
  );
  return parsed;
};

const reclaimRunFixture = (input: { root: string; run: string }): void => {
  for (const name of fs.readdirSync(input.root)) {
    const isOurs =
      name.includes(`.${input.run}.`) ||
      name === `run.${input.run}.marker.json`;
    if (!isOurs) continue;
    fs.rmSync(path.join(input.root, name), { recursive: true, force: true });
  }
};

/** every throwaway repo this file makes */
const reposThrowaway: string[] = [];

/**
 * .what = a throwaway git repo, so a child derives a CONTAINED ROOT OF ITS OWN
 * .why = 🔴 an unhooked consumer is a DIFFERENT REPO, and until now this file
 *        simulated one by a scrub of env keys alone. that sufficed while the
 *        unhooked notice keyed on the env — and it stopped to suffice the moment
 *        `isOwnRunMinted` began to read the DISK, because our children are literal
 *        descendants of a live wired run that shares their scope. under
 *        `--runInBand` (which `test:acceptance:jest` passes) the runner's own pid
 *        IS their parent's, so they read as our broken chain rather than as a
 *        foreign unhooked repo, and every unhooked case went silent at once.
 *
 *        the env scrub answers "what does this process know". this answers "whose
 *        scope is it in" — and a fixture for a foreign repo owes both
 *
 * .note = the root derives from the git root's basename, so a `git init` under
 *         os.tmpdir() is the whole isolation. no env override, no internal reach —
 *         the same public derivation a consumer gets, pointed somewhere disposable
 */
const genRepoThrowaway = (input: { slug: string }): string => {
  const repo = fs.mkdtempSync(
    path.join(os.tmpdir(), `test-fns-${input.slug}-`),
  );
  execFileSync('git', ['init', '--quiet'], { cwd: repo, encoding: 'utf8' });
  reposThrowaway.push(repo);
  return repo;
};

/**
 * .what = removes every throwaway repo AND the scope root it derived
 * .why = this file's own acid test is that it leaves no residue. a scope root under
 *        /tmp/test-fns is residue like any other, and it is ours alone — no age gate
 *        of any consumer's will ever reach a repo that no longer exists
 */
const reclaimReposThrowaway = (): void => {
  for (const repo of reposThrowaway) {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(path.join('/tmp/test-fns', path.basename(repo)), {
      recursive: true,
      force: true,
    });
  }
  reposThrowaway.length = 0;
};

/**
 * .what = the env a child inherits when it must stand in for a FRESH consumer
 * .why = 🔴 this repo DOGFOODS autoprune, so the process that drives these cases
 *        has ALREADY been through a `setupAutoprune` — its env carries this run's
 *        id AND this run's sweep stamp. a child that inherits either one is not
 *        the consumer the case claims to demonstrate: it is a nested run of ours
 *
 * .note = both keys drop TOGETHER, and that is the whole point of the helper.
 *         the run id and the sweep stamp are two distinct facts that merely
 *         coincide, so every call site must drop two keys — and a site that drops
 *         one alone is a fixture that silently stops to test its own claim. one
 *         helper is one place to teach, rather than fifteen
 */
const genChildEnvFresh = (): NodeJS.ProcessEnv => ({
  ...process.env,
  [RUN_ID_ENV_KEY]: undefined,
  [GATE_SWEPT_ENV_KEY]: undefined,
});

/**
 * the prelude every child shares — the contract requires, and the count that
 * uses ONLY public exports
 *
 * .why = `rule.require.acceptance.blackbox`: the ACTION must cross the contract
 *        boundary. resolution goes through `package.json` `exports`, so a subpath
 *        we seal is a subpath this clamp cannot reach either — which is the whole
 *        property the rule protects
 *
 * .note = the count matches by NAME rather than by an internal parser. `isTempDir`
 *         is public and admits a bare name, and a run stamp is its own dot-delimited
 *         segment — so `.<run>.` cannot match a slug that merely contains the id
 */
const genChildPrelude = (input: { contract: ContractPaths }): string => `
const path = require('node:path');
const fs = require('node:fs');

const { genTempDir, getOneTempDirRoot, isTempDir } = require(${JSON.stringify(input.contract.root)});

// count ONLY the dirs this run's own id stamps — a peer's dirs are never counted
const countOurs = (root, run) =>
  fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => isTempDir({ path: entry.name }))
    .filter((entry) => entry.name.includes('.' + run + '.')).length;
`;

/**
 * .what = the child program, as a consumer's runner would drive it
 * .why = it requires from `dist/` through the `exports` map, never from src and
 *        never past the map — so it exercises the compiled artifact a consumer
 *        installs, by the same subpaths a consumer writes
 */
const genChildProgram = (input: { contract: ContractPaths }): string => `
${genChildPrelude({ contract: input.contract })}

// the two hooks, resolved exactly as a runner config names them
const setupHook = require(${JSON.stringify(input.contract.setupJest)}).default;
const teardownHook = require(${JSON.stringify(input.contract.teardownJest)}).default;

(async () => {
  const runInherited = process.env.TEST_FNS_RUN ?? null;

  // the MINT — jest calls this with the globalConfig, so we hand it the same shape
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });

  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();

  // the ALLOCATION, as a consumer's tests would call it
  for (let i = 0; i < ${DIRS_TO_ALLOCATE}; i += 1)
    genTempDir({ slug: 'j1-clamp-' + i });

  const countMade = countOurs(pathPhysical, run);

  // the RECLAIM, as a runner's globalTeardown would call it
  await teardownHook();

  const countLeft = countOurs(pathPhysical, run);

  process.stdout.write(
    ${JSON.stringify(VERDICT_TOKEN)} +
      JSON.stringify({ run, runInherited, countMade, countLeft, pathPhysical }),
  );
})();
`;

/**
 * .what = the child program for the two OUTCOME variants the wish names but J1's
 *         happy child cannot reach: a run whose tests THREW, and a run that
 *         allocated zero dirs (what a zero-match `--scope` looks like from here)
 * .why = 🔴 two of the wish's eight acceptance bullets — *"the guarantee survives a
 *        FAILED test"* and *"a SCOPEd run"* — had no clamp at all. J1 drives a
 *        clean, unscoped child, so it is evidence about exactly one outcome
 *
 * .note = the throw is caught INSIDE the child, which is what a runner does: a
 *         failed test file does not abort the run, it fails it. so the teardown is
 *         reached with the same certainty a runner reaches it — the property under
 *         clamp is that the reclaim does not read the verdict
 */
const genChildProgramOutcome = (input: {
  contract: ContractPaths;
  dirsToAllocate: number;
  throws: boolean;
}): string => `
${genChildPrelude({ contract: input.contract })}

const setupHook = require(${JSON.stringify(input.contract.setupJest)}).default;
const teardownHook = require(${JSON.stringify(input.contract.teardownJest)}).default;

(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();

  // the "test phase" — it may allocate, and it may fail
  let failed = false;
  try {
    for (let i = 0; i < ${input.dirsToAllocate}; i += 1)
      genTempDir({ slug: 'j2-outcome-' + i });
    if (${input.throws}) throw new Error('a test failed, as tests do');
  } catch (error) {
    failed = true;
  }

  const countMade = countOurs(pathPhysical, run);
  await teardownHook();
  const countLeft = countOurs(pathPhysical, run);
  const namesLeft = fs
    .readdirSync(pathPhysical)
    .filter((name) => name.includes(run));

  process.stdout.write(
    ${JSON.stringify(VERDICT_TOKEN)} +
      JSON.stringify({ run, failed, countMade, countLeft, namesLeft }),
  );
})();
`;

/**
 * .what = the child program for an UNHOOKED consumer — the state of every repo on
 *         release day. it never mints, it only allocates
 * .why = 🔴 `case=7` is the vision's *"default state of the world on release day"*
 *        and its EMISSION was clamped nowhere. the render has a snapshot and the
 *        guards have unit tests, so a notice that reached no terminal would have
 *        left every one of them green
 *
 * .note = it reports the dir NAMES it made, never a run id, because that absence is
 *         the whole point: an unhooked run stamps no id, so no reclaim can key on
 *         one. the parent must reclaim by name or this clamp leaks — the same duty
 *         `[case4]`'s hold run bears, for the same reason
 */
const genChildProgramUnhooked = (input: {
  contract: ContractPaths;
  dirsToAllocate: number;
}): string => `
${genChildPrelude({ contract: input.contract })}

(async () => {
  // 🔴 NO require of either hook subpath. that absence IS the case under clamp
  const { pathPhysical } = getOneTempDirRoot();

  const names = [];
  for (let i = 0; i < ${input.dirsToAllocate}; i += 1)
    names.push(path.basename(genTempDir({ slug: 'j5-unhooked-' + i })));

  process.stdout.write(
    ${JSON.stringify(VERDICT_TOKEN)} +
      JSON.stringify({ names, pathPhysical, run: process.env.TEST_FNS_RUN ?? null }),
  );
})();
`;

describe('autoprune (J1 — the clamp that bites)', () => {
  const gitRoot = getGitRoot();
  const dirPathDist = path.join(gitRoot, 'dist');

  /**
   * .what = looks up the dist file each contract subpath points at, by a read of
   *         this package's own `exports` map
   * .why = 🔴 `rule.require.acceptance.blackbox` — the ACTION must cross the contract
   *        boundary. we hold no self-link in `node_modules`, so a bare
   *        `require('test-fns')` cannot load from a child; the map read is what makes
   *        the child's requires equivalent to a consumer's, and it FAILS LOUD on a
   *        subpath we seal rather than fall back to a deep path
   *
   * .note = it deliberately re-reads the manifest rather than import a constant. the
   *         map is edited by hand, by a release tool, and by a template regenerator
   *         alike — so it is FOREIGN input here, exactly as it is in
   *         `autoprune.exports.acceptance.jest.test.ts`
   */
  const getAllContractPaths = (): ContractPaths => {
    if (!fs.existsSync(dirPathDist))
      throw new Error(
        `dist/ absent at ${dirPathDist}. run \`npm run build\` first — this clamp is blackbox against the compiled artifact.`,
      );

    const parsed: unknown = JSON.parse(
      fs.readFileSync(path.join(gitRoot, 'package.json'), 'utf8'),
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('exports' in parsed) ||
      typeof parsed.exports !== 'object' ||
      parsed.exports === null
    )
      throw new Error(
        'package.json declares no exports map — a consumer could require not one of our entry points',
      );
    const exportsMap: Record<string, unknown> = { ...parsed.exports };

    const at = (subpath: string): string => {
      const declared = exportsMap[subpath];
      if (typeof declared !== 'string')
        throw new Error(
          `the exports map does not declare "${subpath}". an exports map SEALS what it omits, so a consumer cannot require it — and neither can this clamp.`,
        );
      const target = path.join(gitRoot, declared);
      if (!fs.existsSync(target))
        throw new Error(
          `"${subpath}" points at ${target}, which the build did not emit.`,
        );
      return target;
    };

    return {
      root: at('.'),
      setupJest: at('./autoprune.setup.jest'),
      teardownJest: at('./autoprune.teardown.jest'),
      setupVitest: at('./autoprune.setup.vitest'),
    };
  };

  given(
    '[case1] a wired run that allocates temp dirs, nested in our own',
    () => {
      when(
        '[t0] the run completes its full setup → allocate → teardown',
        () => {
          const outcome = useThen(
            'the child exits clean and renders a verdict',
            (): {
              run: string;
              runInherited: string | null;
              countMade: number;
              countLeft: number;
              pathPhysical: string;
            } => {
              // fail LOUD rather than skip — an absent artifact is unacceptable, and a
              // clamp that quietly passes without it clamps not one defect.
              // `getAllContractPaths` throws on an absent dist AND on a sealed subpath
              const contract = getAllContractPaths();

              const stdout = execFileSync(
                process.execPath,
                ['-e', genChildProgram({ contract })],
                { cwd: gitRoot, encoding: 'utf8', stdio: 'pipe' },
              );

              const at = stdout.indexOf(VERDICT_TOKEN);
              if (at === -1)
                throw new Error(
                  `the child rendered no verdict. stdout: ${stdout}`,
                );

              return JSON.parse(stdout.slice(at + VERDICT_TOKEN.length));
            },
          );

          then('it stamped every dir it made with its own run id', () => {
            // .why = this goes red if the STAMP breaks — the mint, the env chain, or
            //        the read at the allocation. it guards `case=10`'s cause
            expect(outcome.run).toMatch(/^r[a-f0-9]{8}$/);
            expect(outcome.countMade).toEqual(DIRS_TO_ALLOCATE);
          });

          then(
            '🔴 it left ZERO of them behind — the defect under repair',
            () => {
              // .why = this goes red if the RECLAIM breaks, and it is red by
              //        construction against any build with no teardown at all:
              //        there, countLeft equals countMade
              expect(outcome.countLeft).toEqual(0);
            },
          );

          then(
            'it settled its marker, so it left zero entries of ANY kind',
            () => {
              // .why = the acceptance says "zero new dirs". a marker file left behind
              //        would satisfy that on a technicality while it leaked one file
              //        per run — the hazard that made the marker sweep a requirement
              const namesLeft = fs
                .readdirSync(outcome.pathPhysical)
                .filter((name) => name.includes(outcome.run));
              expect(namesLeft).toEqual([]);
            },
          );

          then(
            '🔴 it minted a FRESH id rather than reuse the one it inherited',
            () => {
              // .why = a child inherits our env. were the id reused, the CHILD's teardown
              //        would reap the PARENT's live dirs — LOSS, the one failure mode
              //        this design keeps off the table everywhere else
              expect(outcome.runInherited).toEqual(process.env.TEST_FNS_RUN);
              expect(outcome.run).not.toEqual(outcome.runInherited);
            },
          );

          then('our own run survived the nested teardown untouched', () => {
            // the outer run is still live, so its own marker MUST still be here
            const runOuter = process.env.TEST_FNS_RUN ?? 'absent';
            const namesOurs = fs
              .readdirSync(outcome.pathPhysical)
              .filter((name) => name.includes(runOuter));
            expect(namesOurs.length).toBeGreaterThan(0);
          });

          then('🔴 and the SHAPE of the verdict it renders is as here', () => {
            // 🔴 every assertion above reads a field BY NAME, so each is blind to
            // a rename in the child: `countLeft` → `countKept` makes
            // `outcome.countLeft` read `undefined`, and the only red is
            // `expect(undefined).toEqual(0)` — a failure that names the wrong
            // cause and sends the reader to the reclaim rather than the rename.
            //
            // an ADDED field is worse: no assertion mentions it, so it ships with
            // no diff line at all.
            //
            // .note = the shape only — the VALUES are graded by the `then`s above,
            //         which state each contract in its own words. a snapshot that
            //         duplicated them would make every value change a two-file edit
            //         and teach the blind resnap this branch exists to argue against.
            expect(
              Object.entries(outcome as unknown as Record<string, unknown>).map(
                ([key, value]) => `${key}: ${typeof value}`,
              ),
            ).toMatchSnapshot();
          });
        },
      );
    },
  );

  /**
   * .what = drives the child through the two OUTCOMES the wish names and J1 cannot
   *         reach — a run that FAILED, and a run that allocated ZERO
   * .why = the reclaim must not read the verdict, and must not depend on what the
   *        tests happened to do. both are wish acceptance bullets; neither had a clamp
   */
  const getOneOutcome = (input: {
    dirsToAllocate: number;
    throws: boolean;
  }): {
    run: string;
    failed: boolean;
    countMade: number;
    countLeft: number;
    namesLeft: string[];
  } => {
    const contract = getAllContractPaths();

    const stdout = execFileSync(
      process.execPath,
      [
        '-e',
        genChildProgramOutcome({
          contract,
          dirsToAllocate: input.dirsToAllocate,
          throws: input.throws,
        }),
      ],
      { cwd: gitRoot, encoding: 'utf8', stdio: 'pipe' },
    );

    const at = stdout.indexOf(VERDICT_TOKEN);
    if (at === -1)
      throw new Error(`the child rendered no verdict. stdout: ${stdout}`);
    return JSON.parse(stdout.slice(at + VERDICT_TOKEN.length));
  };

  given('[case2] a run whose tests FAILED', () => {
    when('[t0] the teardown fires after the failure', () => {
      const outcome = useThen('the child renders a verdict', () =>
        getOneOutcome({ dirsToAllocate: DIRS_TO_ALLOCATE, throws: true }),
      );

      then('guard the guard: the run really did fail, and did allocate', () => {
        // .why = were either false, "it reclaimed anyway" would hold vacuously —
        //        a clean run with zero dirs passes the assertions below for free
        expect(outcome.failed).toEqual(true);
        expect(outcome.countMade).toEqual(DIRS_TO_ALLOCATE);
      });

      then('🔴 it reclaimed every dir regardless — the wish acceptance', () => {
        // .why = "the guarantee survives a FAILED test". the teardown never reads
        //        the exit code, and this is the assertion that pins it
        expect(outcome.countLeft).toEqual(0);
      });

      then('it left zero entries of ANY kind, marker included', () => {
        expect(outcome.namesLeft).toEqual([]);
      });

      then('and the VERDICT the child renders is shaped as here', () => {
        // 🔴 the four assertions above read four fields by name. not one of them
        // sees the RECORD — so a field renamed, added, or dropped from the
        // child's verdict lands as `Received: undefined` against whichever
        // assertion happens to touch it, and points at the reclaim rather than
        // at the rename. bite probe 6 walked exactly that: `countLeft` →
        // `countKept` reported `Expected: 0, Received: undefined`
        //
        // 🔴 .why `run` is MASKED = the field renders a freshly minted id, so an
        //        unmasked record is non-hermetic and reddens on the very next run.
        //        a claim that *"every field here is a count, a boolean, or an
        //        empty list"* holds only until someone reads the render: **a claim
        //        about a render, stated ahead of the render, is a guess that reads
        //        as a rationale** (`rule.require.hermetic-tests`)
        //
        // .note = masked to a TOKEN rather than dropped, so the field's presence
        //         and its position stay under clamp — a verdict that stopped
        //         carrying its run id must still redden here
        expect({ ...outcome, run: asStableRun(outcome.run) }).toMatchSnapshot();
      });
    });
  });

  given('[case3] a run that allocated ZERO dirs — a zero-match scope', () => {
    when('[t0] the teardown fires with no dir of its own', () => {
      const outcome = useThen('the child renders a verdict', () =>
        getOneOutcome({ dirsToAllocate: 0, throws: false }),
      );

      then('guard the guard: it really did allocate zero', () => {
        expect(outcome.countMade).toEqual(0);
      });

      then('🔴 the teardown STILL ran and settled the marker it minted', () => {
        // .why = "the guarantee survives a SCOPEd run". a scope that matches no
        //        test file loads no test file — so an `afterAll`-shaped teardown
        //        would never fire, and the marker minted at setup would survive as
        //        a permanent leak. `globalTeardown` is config rather than a test,
        //        so no filter reaches it. this is the assertion that pins why the
        //        vision moved the reclaim off `setupFilesAfterEnv`
        expect(outcome.namesLeft).toEqual([]);
        expect(outcome.countLeft).toEqual(0);
      });

      then('and the VERDICT the child renders is shaped as here', () => {
        // .why = the ZERO-allocation pole of `[case2]`'s record, and the pair is
        //        the point: the two snapshots sit adjacent in one `.snap`, so a
        //        reviewer reads *"a failed run made N and kept 0"* beside *"a
        //        scoped run made 0 and kept 0"* — and a change that collapsed
        //        the two paths into one would show as two identical records
        expect({ ...outcome, run: asStableRun(outcome.run) }).toMatchSnapshot();
      });
    });
  });

  given('[case4] what a real run WRITES TO STDERR, end to end', () => {
    // .why = 🔴 the RENDER of every message is clamped — 13 snapshots in
    //        `autoprune.messages.integration…`. the EMISSION is clamped nowhere.
    //        every extant assertion on the header is either a RENDER check (it
    //        grades a returned string) or a NEGATIVE one (`not.toContain`); not one
    //        reads the real stderr of a real run. so a message could render
    //        perfectly and never reach a human — an unreachable call site, a
    //        swallowed stream, a guard that never fires — and all 13 snapshots
    //        would stay green through it
    //
    // .note = the evidence above is stated as a PROPERTY of the assertions, never
    //         as a tally of files ("four prod files and one snapshot, and NO test
    //         file"). a count of grep hits drifts with every edit, and a stale
    //         count in a `.why` undermines the clamp it argues for — the argument
    //         rests on what the assertions DO, never on how many there are
    //
    // .note = the sharpest part is that this file ALREADY drove the real emission
    //         path and threw the evidence away. `stdio: 'pipe'` captures stderr;
    //         every case above reads `stdout` alone. *the costly half of this clamp
    //         — a real child, a real dist, the real hooks — was already paid for.*
    //
    // .why here = the render lives at integration grain because the renderers are
    //        internal. whether that render REACHES a consumer is a property of the
    //        compiled artifact under a runner, which is the acceptance grain
    //        (`rule.require.test-coverage-by-grain`)
    // .note = 🔴 it yields an OBJECT, never a bare string. `useThen` hands back a
    //         deferred PROXY, so a bare-string return read as `String(spokenOut)`
    //         yields `"[object Object]"` — and `[t0]`'s
    //         `not.toContain('🧹 test-fns')` passes against that, vacuously. *a
    //         negative assertion is the one shape that goes green when its subject
    //         never arrived*, which is why `[t1]`'s positive twin is what catches
    //         it. every proxy read in this repo goes through a property
    //         (`scene.line`, `outcome.countLeft`), and this one is no exception
    // .note = 🔴 the HOLD run is the one child in this file that deliberately leaves
    //         residue — that IS the hatch. so this suite must reclaim it by hand, or
    //         the clamp for the leak-stopper becomes a leak: unreclaimed, `[t1]`
    //         turns the acid test's `1 directory, 2 files` into `7 directories, 4
    //         files`, which one command catches
    //
    //         *a test that exercises an opt-out of a guarantee inherits the duty that
    //         guarantee bore.* the hold hatch has no test-side reclaim story by design
    //         — the age gate is its only bound, at 24h — which is fine for a human at
    //         a keyboard and unacceptable inside our own green suite
    const runsHeld: { run: string; pathPhysical: string }[] = [];
    afterAll(() => {
      for (const held of runsHeld)
        for (const name of fs.readdirSync(held.pathPhysical))
          if (name.includes(held.run))
            fs.rmSync(path.join(held.pathPhysical, name), {
              recursive: true,
              force: true,
            });
    });

    const getOneStderr = (input: {
      keep: string;
    }): { spoken: string; spokenStable: string } => {
      const contract = getAllContractPaths();

      // .note = spawnSync, never execFileSync — the latter RETURNS stdout, so the
      //         stream every one of these messages travels on is unreachable from
      //         its return value. that asymmetry is why the evidence was dropped
      const child = spawnSync(
        process.execPath,
        ['-e', genChildProgram({ contract })],
        {
          cwd: gitRoot,
          encoding: 'utf8',
          // .note = the hatch is set by the KEY ITSELF, never by a literal copy of
          //         it. a literal here would keep this clamp green through a rename
          //         — the child would simply never see the hatch, and `[t1]` would
          //         then assert the silence `[t0]` asserts, twice
          //
          // .note = 🔴 the age window is PINNED, not inherited. the child takes
          //         `{...process.env}`, and the hold message renders
          //         `getOneMaxAgeMs()` — which reads TEST_FNS_MAX_AGE_MS from
          //         exactly that env. so an ambient value would flow in and the
          //         snapshot would render a number this test never chose
          //
          //         and it is the one variable most likely to be set, because
          //         *this very message tells the reader to set it*: "widen that
          //         window with TEST_FNS_MAX_AGE_MS". a human who follows our own
          //         advice would turn our suite red. the integration twin
          //         (`autoprune.messages…` `[case7]`) already pins it; this clamp
          //         renders the same text and owes the same guarantee
          env: {
            ...process.env,
            [KEEP_ENV_KEY]: input.keep,
            [MAX_AGE_ENV_KEY]: String(MAX_AGE_MS_PINNED),
          },
        },
      );
      if (child.status !== 0)
        throw new Error(
          `the child exited ${String(child.status)}. stderr: ${child.stderr}`,
        );

      // read the child's own verdict — it carries the run id and root this render
      // interpolates, so both the reclaim below and the mask are driven by facts
      // the child reported, never re-parsed out of the message under assertion
      const at = child.stdout.indexOf(VERDICT_TOKEN);
      if (at === -1)
        throw new Error(
          `the child rendered no verdict. stdout: ${child.stdout}`,
        );
      const verdict: { run: string; pathPhysical: string } = JSON.parse(
        child.stdout.slice(at + VERDICT_TOKEN.length),
      );

      // a HELD run leaves residue by design — register it, so this suite reclaims
      // what it deliberately kept rather than leak from its own clamp
      if (input.keep)
        runsHeld.push({
          run: verdict.run,
          pathPhysical: verdict.pathPhysical,
        });

      return {
        spoken: child.stderr,
        // .note = the root and the run id are masked SEPARATELY, and no further —
        //         so every glyph, indent and blank line survives into the snapshot.
        //         those are the properties a fragment assertion cannot see, which
        //         is the whole reason this render exists beside the fragments
        spokenStable: asStrerrorMasked(child.stderr)
          .split(verdict.pathPhysical)
          .join('<tmpDir>')
          .split(verdict.run)
          .join('<run>'),
      };
    };

    when('[t0] the run is green and the hold hatch is OFF', () => {
      const outcome = useThen('the child exits clean', () =>
        getOneStderr({ keep: '' }),
      );

      then('guard the guard: stderr really was READ, never a proxy', () => {
        // .why = 🔴 the assertion below is a NEGATIVE, and a negative passes for
        //        free against a subject that never arrived. this line is what makes
        //        the next one mean anything — it pins that a real string was read
        expect(typeof outcome.spoken).toEqual('string');
      });

      then(
        '🔴 it says NO word — silence is the contract on a clean run',
        () => {
          // .why = a teardown that speaks on every green run is a teardown an annoyed
          //        human unwires — which is `case=7`'s own argument for why the
          //        unhooked notice speaks once per run rather than once per call. so
          //        silence on the happy path is load-bearing, and it was asserted
          //        nowhere: every extant assertion reads a JSON verdict on stdout
          expect(outcome.spoken).not.toContain('🧹 test-fns');
        },
      );
    });

    when('[t1] the same run, with the hold hatch ON', () => {
      const outcome = useThen('the child exits clean', () =>
        getOneStderr({ keep: '1' }),
      );

      then('🔴 the hold message REACHES a human, whole and unaltered', () => {
        // .why = this is the point of the case. `autoprune.messages…` `[case7]`
        //        snapshots this same text at INTEGRATION grain, from a direct call
        //        to the renderer. here the identical shape is read off a REAL
        //        child's stderr, through the compiled `dist/`, under the real
        //        teardown a runner drives. *a render no one receives is a render of
        //        fiction, and no snapshot of the renderer can tell you which.*
        //
        // .note = 🔴 a RENDER rather than a set of `toContain` fragments. the
        //         weaker form is precisely the shape the messages file's own header
        //         condemns: *"a fragment assertion is functional verification and it
        //         is not observability… a broken tree glyph, a doubled line, a lost
        //         blank passes a `toContain` suite green"*. to reach for it here is
        //         to weaken the very practice this branch exists to argue for, one
        //         file away from the argument. the EMISSION carries a render of its
        //         own, so the two can be read side by side in a diff
        //
        // .note = 🔴 the volatile guard rides EVERY stderr journey in this file,
        //         this call site among them. that is the exact decay
        //         `expectNoVolatileBytes`'s own doc names — *a mask set held in step
        //         by a reviewer's memory alone falls out of step the first time
        //         nobody is looking*. a guard applied by memory is a guard with
        //         a gap.
        expectNoVolatileBytes(outcome.spokenStable);
        expect(outcome.spokenStable).toMatchSnapshot();
      });

      then('and its first line agrees with the render, by the LIVE key', () => {
        // .why = the emission snapshot and the render snapshot live in separate
        //        files, so a change to one leaves the other stale and a reviewer
        //        must catch it by eye. this line makes the runner catch it — and it
        //        builds the expectation from `KEEP_ENV_KEY` rather than a literal,
        //        so a rename of the key fails here rather than drift silently
        expect(outcome.spokenStable).toContain(
          `🧹 test-fns: ${KEEP_ENV_KEY} is set, so this run KEPT ALL of its temp dirs.`,
        );
      });
    });
  });

  given('[case5] an UNHOOKED consumer — every repo on release day', () => {
    // .why = 🔴 the vision names this *"the default state of the world on release
    //        day"* and grades it a sharp critipath, and its EMISSION had no clamp.
    //        `warnIfUnhooked.jest.test.ts` drives the function directly and
    //        `autoprune.messages…` snapshots the render — so a notice that never
    //        reached a real terminal would have left both suites green
    //
    // .note = this case was written because a hand-probe of the path came back
    //         AMBIGUOUS: an unwired real config produced a genuine leak (83 dirs)
    //         and yet no notice text in the skill's stderr log. a runner re-routes
    //         a worker's `console.error` through its own reporter, so the hand-probe
    //         could not tell an absent emission from a re-routed one. *a question a
    //         manual walk cannot settle is a question that wants a clamp.*
    //
    // .note = an unhooked run leaves residue BY DEFINITION — that is the defect it
    //         reports, not a fault in this test. so the parent reclaims by NAME,
    //         since no run id exists to key on. it is the same duty `[case4]`'s
    //         hold run carries, for the same reason
    const dirsToReclaim: { pathPhysical: string; names: string[] }[] = [];
    afterAll(() => {
      for (const made of dirsToReclaim)
        for (const name of made.names)
          fs.rmSync(path.join(made.pathPhysical, name), {
            recursive: true,
            force: true,
          });
      reclaimReposThrowaway();
    });

    const getOneNotice = (input: {
      argvExtra: string[];
    }): { spoken: string; spokenStable: string } => {
      const contract = getAllContractPaths();
      const repoThrowaway = genRepoThrowaway({ slug: 'unhooked' });

      const child = spawnSync(
        process.execPath,
        // .note = 🔴 the `--` is load-bearing. without it NODE consumes `--config`
        //         as its own option and exits 9 with `bad option: --config`, so the
        //         flag never reaches `process.argv` for the branch under clamp to
        //         read. this failed on its first run and the error named the cause
        //         outright — which is what a real spawn buys over a hand-built argv
        [
          '-e',
          genChildProgramUnhooked({ contract, dirsToAllocate: 2 }),
          '--',
          ...input.argvExtra,
        ],
        {
          // 🔴 a THROWAWAY repo, never ours — see `genRepoThrowaway`. an unhooked
          // consumer is a different REPO, so the fixture owes a different SCOPE as
          // well as a scrubbed env; with ours, `isOwnRunMinted` reads our live
          // marker through the child's own parentage and the notice goes silent
          cwd: repoThrowaway,
          encoding: 'utf8',
          // .note = 🔴 THREE keys are scrubbed, and each would defeat the case in a
          //         different direction. the child takes `{...process.env}` from a
          //         worker of OUR run, which is fully wired — so without the scrub
          //         it would inherit our mint and read as HOOKED, and the notice it
          //         is here to prove would correctly stay silent
          //
          //         TEST_FNS_RUN  → inherited, the child reads as hooked, no notice
          //         TEST_FNS_KEEP → inherited from a shell would add a second
          //                         message to the stream under snapshot
          //         TEST_FNS_QUIET→ a consumer who suppressed it once would silence
          //                         this clamp forever, on their machine alone
          //
          // .note = JEST_WORKER_ID is set EXPLICITLY rather than inherited. the
          //         notice stays silent where no runner is detectable — correct, and
          //         it means this clamp would pass vacuously if the child were read
          //         as a bare node one-off. an explicit value states the premise out
          //         loud rather than leans on an accident of inheritance
          env: {
            ...genChildEnvFresh(),
            [KEEP_ENV_KEY]: undefined,
            TEST_FNS_QUIET: undefined,
            VITEST: undefined,
            JEST_WORKER_ID: '1',
            [MAX_AGE_ENV_KEY]: String(MAX_AGE_MS_PINNED),
          },
        },
      );
      if (child.status !== 0)
        throw new Error(
          `the child exited ${String(child.status)}. stderr: ${child.stderr}`,
        );

      const at = child.stdout.indexOf(VERDICT_TOKEN);
      if (at === -1)
        throw new Error(
          `the child rendered no verdict. stdout: ${child.stdout}`,
        );
      const verdict: {
        names: string[];
        pathPhysical: string;
        run: string | null;
      } = JSON.parse(child.stdout.slice(at + VERDICT_TOKEN.length));

      // guard the guard — a child that DID inherit a run id is a hooked child, and
      // every assertion below would then be about a case this is not
      if (verdict.run !== null)
        throw new Error(
          `the child inherited a run id (${verdict.run}), so it was HOOKED — the scrub failed.`,
        );

      dirsToReclaim.push({
        pathPhysical: verdict.pathPhysical,
        names: verdict.names,
      });

      return {
        spoken: child.stderr,
        spokenStable: asStrerrorMasked(child.stderr)
          .split(verdict.pathPhysical)
          .join('<tmpDir>'),
      };
    };

    when('[t0] the runner config wires neither hook', () => {
      const outcome = useThen('the child allocates and exits clean', () =>
        getOneNotice({ argvExtra: [] }),
      );

      then('guard the guard: stderr really was READ, never a proxy', () => {
        expect(typeof outcome.spoken).toEqual('string');
      });

      then('🔴 the notice REACHES a human, whole and unaltered', () => {
        // .why = the whole case. a render no one receives is a render of fiction,
        //        and no snapshot of the renderer can tell you which
        //
        // .note = 🔴 this call site and `[case4] [t1]` were the TWO stderr journeys
        //         in this file that snapshotted without the volatile guard the
        //         other nine carry. the notice is the message an unhooked consumer
        //         meets on release day — the highest-volume render we ship — so a
        //         churn byte here rewrites itself green on the widest surface of
        //         all. both are closed; the pair is the reason the guard now rides
        //         every `spokenStable` export rather than most of them
        expectNoVolatileBytes(outcome.spokenStable);
        expect(outcome.spokenStable).toMatchSnapshot();
      });

      then('it speaks ONCE, however many dirs the run makes', () => {
        // .why = the child allocates twice. a notice per call is a notice a human
        //        silences, which loses the guarantee it exists to restore — so
        //        once-per-run is load-bearing, and it is a property of the emission
        //        rather than of the renderer
        const spoke = outcome.spokenStable.split(
          '🧹 test-fns: temp dirs made by genTempDir are never reclaimed here.',
        ).length;
        expect(spoke - 1).toEqual(1);
      });
    });

    when('[t1] the runner was invoked with an explicit --config', () => {
      const outcome = useThen('the child allocates and exits clean', () =>
        getOneNotice({ argvExtra: ['--config', './jest.unit.config.ts'] }),
      );

      then('🔴 it names the CONFIG FILE at fault, not the family', () => {
        // .why = the vision demands *name the config file at fault*, because a repo
        //        may hold nine configs that share no base. that branch reads argv,
        //        and it replaced an env-based one that could never fire — so it is
        //        exactly the shape that wants an end-to-end clamp rather than a unit
        //        test over a hand-built argv array
        expect(outcome.spokenStable).toContain(
          '   ├─ at: ./jest.unit.config.ts',
        );
      });

      then('and the family fallback is NOT what it printed', () => {
        // .why = guard the guard. the assertion above would also pass if the notice
        //        happened to carry both, and the fallback is what the branch
        //        degrades to — so its absence is what proves argv was read
        expect(outcome.spokenStable).not.toContain(
          'this repo may hold several',
        );
      });

      then(
        'and what the --config consumer reads is shaped as here — the ONE variant this repo itself runs',
        () => {
          // 🔴 the two assertions above prove a span of text SURVIVED and a rival
          // span did not; neither speaks to the shape a human meets. `[t0]`'s
          // default variant is snapped whole, so without this the acceptance
          // grain records one of the two `at:` renders and asserts the other by
          // fragment — and the fragment is the one the repo's own nine configs
          // make the common case.
          //
          // .why at THIS grain, when the integration twin snaps both addresses =
          //      the `--config` branch reads ARGV, which exists only in a real
          //      spawned child. an in-process render over a hand-built argv array
          //      cannot drift the way a live `process.argv` can
          expectNoVolatileBytes(outcome.spokenStable);
          expect(outcome.spokenStable).toMatchSnapshot();
        },
      );
    });
  });

  given('[case6] a VITEST consumer — the other runner contract we ship', () => {
    when(
      '[t0] they wire the one key and run setup → allocate → teardown',
      () => {
        // 🔴 the behavior ships TWO runner contracts and only ONE was driven
        // end-to-end. the jest journey had this clamp from the start; the vitest
        // journey had an integration probe that imports from `src` and asserts the
        // id crosses the pool — which says no word about whether the COMPILED
        // adapter, reached by the subpath a consumer pastes, reclaims one dir
        //
        // .note = ONE require, not two. that asymmetry IS the vitest contract:
        //         a single `globalSetup` module exports both halves, which is why
        //         vitest cannot reach the half-wired state jest's two keys create
        const outcome = useThen(
          'the vitest child exits clean and renders a verdict',
          (): {
            run: string;
            countMade: number;
            countLeft: number;
            teardownWired: unknown;
            pathPhysical: string;
          } => {
            const contract = getAllContractPaths();

            const stdout = execFileSync(
              process.execPath,
              [
                '-e',
                `
${genChildPrelude({ contract })}

// the WHOLE vitest contract — one module, both halves, by the subpath a
// consumer writes into \`globalSetup: ['test-fns/autoprune.setup.vitest']\`
const adapter = require(${JSON.stringify(contract.setupVitest)});

(async () => {
  await adapter.setup();

  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();

  // read the marker the adapter minted, BEFORE the teardown discharges it —
  // the only moment its \`teardownWired\` is observable from outside
  const teardownWired = JSON.parse(
    fs.readFileSync(path.join(pathPhysical, 'run.' + run + '.marker.json'), 'utf8'),
  ).teardownWired;

  for (let i = 0; i < ${DIRS_TO_ALLOCATE}; i++)
    genTempDir({ slug: 'acc-vitest-' + i });
  const countMade = countOurs(pathPhysical, run);

  await adapter.teardown();

  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({
    run,
    countMade,
    countLeft: countOurs(pathPhysical, run),
    teardownWired,
    pathPhysical,
  }));
})();
`,
              ],
              { cwd: gitRoot, encoding: 'utf8', stdio: 'pipe' },
            );

            const at = stdout.indexOf(VERDICT_TOKEN);
            if (at === -1)
              throw new Error(
                `the child rendered no verdict. stdout: ${stdout}`,
              );
            return JSON.parse(stdout.slice(at + VERDICT_TOKEN.length));
          },
        );

        then('the vitest adapter stamped every dir it made', () => {
          expect(outcome.run).toMatch(/^r[a-f0-9]{8}$/);
          expect(outcome.countMade).toEqual(DIRS_TO_ALLOCATE);
        });

        then('🔴 and reclaimed every one of them', () => {
          // the wish's guarantee, proven for the runner it had never been proven for
          expect(outcome.countLeft).toEqual(0);
        });

        then('it left zero entries of ANY kind, marker included', () => {
          const namesLeft = fs
            .readdirSync(outcome.pathPhysical)
            .filter((name) => name.includes(outcome.run));
          expect(namesLeft).toEqual([]);
        });

        then(
          '🔴 its marker carried teardownWired=true, from the real adapter',
          () => {
            // .why = the vitest adapter hands `teardownWired: true` as a LITERAL,
            //        justified by "one module carries both halves". every test for
            //        it clamped that `setup`/`teardown` are exported functions —
            //        which is a clamp on the module's shape, never on whether the
            //        literal reaches `setupAutoprune`. a future edit that dropped it
            //        would leave a vitest consumer's marker read as half-wired, and
            //        the next run would tell them to add a key they already have
            expect(outcome.teardownWired).toEqual(true);
          },
        );

        then('and the VERDICT it renders is shaped as here', () => {
          // 🔴 every `then` above is FUNCTIONAL — it grades four values by name,
          // so it is blind to the two drifts that cost a consumer most:
          //   1. a field ADDED to the verdict record (no assertion covers it)
          //   2. a field RENAMED in the child (`countLeft` → `countKept`) —
          //      `outcome.countLeft` then reads `undefined`, and
          //      `expect(undefined).toEqual(0)` is the sole red, with a message
          //      that names the wrong cause
          //
          // this is the same gap `[case2]`'s module-shape export closed for the
          // hook surface, applied to the one journey that had no export at all.
          // the vitest contract is HALF the runners we ship; it is graded here
          // to the same standard as the jest half.
          expect({
            shape: asShape(outcome as unknown as Record<string, unknown>),
            run: outcome.run.replace(/^r[a-f0-9]{8}$/, '<run>'),
            countMade: outcome.countMade,
            countLeft: outcome.countLeft,
            teardownWired: outcome.teardownWired,
          }).toMatchSnapshot();
        });
      },
    );

    when('[t1] their suite FAILS, and the teardown runs anyway', () => {
      // 🔴 the wish demands the guarantee survive a run whose tests FAILED, and
      // the jest arm proves it at `[case2]`. the vitest arm proved only the
      // clean exit — so half the shipped runner contract had its most common
      // journey (a red suite is a LOOP; it carries the volume) unverified.
      //
      // .why it is not covered by transitivity = the property under test is
      //      "the adapter's teardown does not read the suite outcome". that is
      //      a claim about THIS adapter's control flow, and the jest arm's
      //      proof says one word about jest's `globalTeardown` and none about
      //      vitest's single-module `teardown` export
      const outcome = useThen(
        'the vitest child records a failure and still reclaims',
        (): {
          failed: boolean;
          countMade: number;
          countLeft: number;
          namesLeft: string[];
        } => {
          const contract = getAllContractPaths();

          const stdout = execFileSync(
            process.execPath,
            [
              '-e',
              `
${genChildPrelude({ contract })}

const adapter = require(${JSON.stringify(contract.setupVitest)});

(async () => {
  await adapter.setup();

  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();

  for (let i = 0; i < ${DIRS_TO_ALLOCATE}; i++)
    genTempDir({ slug: 'acc-vitest-red-' + i });
  const countMade = countOurs(pathPhysical, run);

  // a red suite, as the runner sees one: the tests threw, the runner
  // recorded it, and the runner calls teardown REGARDLESS. the throw is
  // caught here for the same reason the runner catches it — a teardown
  // that only runs on green is the defect this case exists to forbid
  let failed = false;
  try {
    throw new Error('a test in this vitest suite failed');
  } catch {
    failed = true;
  } finally {
    await adapter.teardown();
  }

  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({
    failed,
    countMade,
    countLeft: countOurs(pathPhysical, run),
    namesLeft: fs.readdirSync(pathPhysical).filter((name) => name.includes(run)),
  }));
})();
`,
            ],
            { cwd: gitRoot, encoding: 'utf8', stdio: 'pipe' },
          );

          const at = stdout.indexOf(VERDICT_TOKEN);
          if (at === -1)
            throw new Error(`the child rendered no verdict. stdout: ${stdout}`);
          return JSON.parse(stdout.slice(at + VERDICT_TOKEN.length));
        },
      );

      then('the suite really did fail', () => {
        // guard the guard: a child that silently skipped the throw would make
        // every assertion below pass while it proved the GREEN path twice
        expect(outcome.failed).toEqual(true);
        expect(outcome.countMade).toEqual(DIRS_TO_ALLOCATE);
      });

      then('🔴 and every dir it made was reclaimed regardless', () => {
        expect(outcome.countLeft).toEqual(0);
      });

      then('🔴 and it left zero entries of ANY kind, marker included', () => {
        // the marker is a FILE, so `countLeft` — which counts dirs — would read
        // 0 for a run that leaked its own marker. this is the entry-grain check
        expect(outcome.namesLeft).toEqual([]);
      });

      then('and the VERDICT it renders is shaped as here', () => {
        // .why THIS EXISTS = the three `then`s above are FUNCTIONAL, and its
        //      sibling `[t0]` carries exactly this clamp for exactly this
        //      reason. the RED journey shipped without it — so the negative
        //      path had a verdict record no snapshot graded, while the happy
        //      path beside it had one. *a coverage asymmetry between two arms
        //      of one case is the shape a gap hides in*, and this arm is the
        //      one a consumer meets more often: a red suite is a loop.
        //
        // .note = `namesLeft` is snapped as its LENGTH, never its contents —
        //         the contract is "zero entries", and the `toEqual([])` above
        //         states it exactly. a snapshot of the array itself would add
        //         no claim and would redden on any name this branch renames
        expect({
          shape: asShape(outcome as unknown as Record<string, unknown>),
          failed: outcome.failed,
          countMade: outcome.countMade,
          countLeft: outcome.countLeft,
          namesLeftCount: outcome.namesLeft.length,
        }).toMatchSnapshot();
      });
    });
  });

  given('[case7] a run PRE-EMPTED, then the next run starts', () => {
    when('[t0] the next run speaks its arrears to a real terminal', () => {
      // 🔴 the arrears report is `case=12`'s entire voice, and it is the one
      // message a human meets when a run is killed — the most common error
      // journey this behavior has. it was rendered at integration grain and
      // driven end-to-end nowhere, so a regression that deleted the emission
      // call site, or moved the guard that fires it, would leave all fifteen
      // render snapshots green
      //
      // *a render no one receives is a render of fiction* — this file's own
      // stated standard, which until now it applied to two messages out of nine
      const outcome = useThen(
        'the pre-empted run leaves a marker, and the next run speaks',
        (): { spokenStable: string; run: string } => {
          const contract = getAllContractPaths();

          // run A — setup and allocate, then exit with NO teardown. this is a
          // pre-empt as the kernel delivers it: the marker is left `open`
          const runA = execFileSync(
            process.execPath,
            [
              '-e',
              `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  genTempDir({ slug: 'acc-arrears-orphaned' });
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({
    run: process.env.TEST_FNS_RUN,
    pathPhysical: getOneTempDirRoot().pathPhysical,
  }));
})();
`,
            ],
            { cwd: gitRoot, encoding: 'utf8', stdio: 'pipe' },
          );
          const atA = runA.indexOf(VERDICT_TOKEN);
          if (atA === -1)
            throw new Error(`run A rendered no verdict. stdout: ${runA}`);
          const scene: { run: string; pathPhysical: string } = JSON.parse(
            runA.slice(atA + VERDICT_TOKEN.length),
          );

          // run B — a plain setup. its arrears check must find A's open marker,
          // whose process is now gone, and SAY SO on stderr
          //
          // .note = it names its OWN run on stdout as well. that is not part of the
          //         journey under test — it is what lets the reclaim below take back
          //         B's marker too, which B leaves `open` for the same reason A does
          const runB = spawnSync(
            process.execPath,
            [
              '-e',
              `
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run: process.env.TEST_FNS_RUN }));
})();
`,
            ],
            {
              cwd: gitRoot,
              encoding: 'utf8',
              env: genChildEnvFresh(),
            },
          );
          if (runB.status !== 0)
            throw new Error(`run B exited ${runB.status}: ${runB.stderr}`);
          const atB = runB.stdout.indexOf(VERDICT_TOKEN);
          if (atB === -1)
            throw new Error(`run B named no run. stdout: ${runB.stdout}`);
          const runIdB: string = JSON.parse(
            runB.stdout.slice(atB + VERDICT_TOKEN.length),
          ).run;

          // 🔴 the stderr is captured; the residue has no reader left. take it back
          // NOW rather than leave it to an age gate a day out — see
          // `reclaimRunFixture`. this is the one case in the file that makes
          // residue on purpose, so it is the one case that owes its own reclaim
          reclaimRunFixture({ root: scene.pathPhysical, run: scene.run });
          reclaimRunFixture({ root: scene.pathPhysical, run: runIdB });

          return {
            run: scene.run,
            spokenStable: runB.stderr
              .split(scene.pathPhysical)
              .join('<tmpDir>')
              .split(scene.run)
              .join('<runA>')
              .replace(/pid \d+/g, 'pid <pid>')
              .replace(/began \d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'began <ts>')
              .replace(/\br[a-f0-9]{8}\b/g, '<run>'),
          };
        },
      );

      then('🔴 the arrears report REACHED a real terminal', () => {
        // the emission, not the render — the half no snapshot of the renderer
        // can prove
        expect(outcome.spokenStable).toContain('never reclaimed');
        expect(outcome.spokenStable).toContain('<runA>');
      });

      then('it named the SCALE of the residue, not only the run', () => {
        // 🔴 the count two catalog critipaths assert reaches a human — `case=12`
        // [t3] and `case=11` [t1a], whose dated-ledger census rests on it. run A
        // allocated exactly one dir and no reclaim has taken it, so the render
        // must say so — and say it in the SINGULAR, which is the agreement case
        // a `(s)` suffix gets wrong and every integration fixture reads as `0`
        expect(outcome.spokenStable).toContain('1 temp dir still on disk');
      });

      then('it named the pre-emption class, not a guess', () => {
        expect(outcome.spokenStable).toContain('a class of pre-emption');
        // and it must NOT accuse a config that was never at fault — run A's
        // config declared its teardown, so the half-wired branch is wrong here
        expect(outcome.spokenStable).not.toContain('NO globalTeardown wired');
      });

      then('and what a human reads is shaped as here', () => {
        expectNoVolatileBytes(outcome.spokenStable);
        expect(outcome.spokenStable).toMatchSnapshot();
      });
    });
  });

  given('[case8] a config wired TEARDOWN-ONLY — the mirror half-wire', () => {
    when('[t0] the teardown hook runs with no setup before it', () => {
      // 🔴 `./autoprune.teardown.jest` is a PUBLIC contract endpoint, and it was
      // never invoked STANDALONE through the compiled artifact by any acceptance
      // test. every case that called it required `./autoprune.setup.jest` on the
      // adjacent line first, so the config a human writes who pastes one key and
      // forgets the other was driven nowhere
      //
      // its render IS a demoed critipath — `autoprune.messages…` `[case6]` snaps
      // "the autoprune TEARDOWN ran, but its SETUP did not" — but that drives
      // `teardownAutoprune()` directly against `src/`, in-process. so the message
      // was proven CORRECT and never proven RECEIVED, which is this file's own
      // standard: *a render no one receives is a render of fiction*
      //
      // .note = the REVERSE half-wire (setup wired, teardown key absent) is
      //         already end-to-end via `autoprune.exports…` `[case4]`'s
      //         'teardown-absent' child. only this direction was open — and a
      //         half-wire has two directions, each with its own message and its
      //         own fix line
      const outcome = useThen(
        'the teardown-only child runs and speaks',
        (): { spokenStable: string; status: number } => {
          const contract = getAllContractPaths();

          // 🔴 the child requires the TEARDOWN subpath and no other. a require of
          // the setup here — even unused — would mint a run id as a side effect
          // and erase the very state under test
          const child = spawnSync(
            process.execPath,
            [
              '-e',
              `
const teardownHook = require(${JSON.stringify(contract.teardownJest)}).default;
(async () => { await teardownHook(); })();
`,
            ],
            {
              cwd: gitRoot,
              encoding: 'utf8',
              // .note = the run id is stripped from the inherited env, because THIS
              //         suite is itself a wired run. an inherited id would make the
              //         child look setup-wired and the case would pass vacuously
              env: genChildEnvFresh(),
            },
          );

          return {
            status: child.status ?? -1,
            spokenStable: asStrerrorMasked(child.stderr),
          };
        },
      );

      then('🔴 the half-wired notice REACHED a real terminal', () => {
        expect(outcome.spokenStable).toContain(
          'the autoprune TEARDOWN ran, but its SETUP did not',
        );
      });

      then('it names WHICH half is wired, then the term', () => {
        // the clause order the three half-wired messages share, so a human reads
        // one defect rather than three
        expect(outcome.spokenStable).toContain(
          'the autoprune teardown is wired, its setup is not — a half-wired config',
        );
      });

      then('and the fix it teaches is the PASTEABLE key it lacks', () => {
        // this message describes THIS run's own config, so it hands over the exact
        // key — never the prose form `reportRunArrears` uses for a foreign config
        expect(outcome.spokenStable).toContain(
          "globalSetup: 'test-fns/autoprune.setup.jest'",
        );
      });

      then(
        '🔴 and it names the CONFIG at fault, as its two siblings do',
        () => {
          // 🔴 this member of the family shipped with NO `at:` line while two rounds
          // of repair asserted the family consistent — so a human met a cause and a
          // fix with no address, and a repo may hold nine configs. every other
          // assertion in this `when` passed green over that gap. *a family checked
          // field-by-field is checked only for the fields someone thought to name.*
          expect(outcome.spokenStable).toContain('├─ at: ');
        },
      );

      then('it did NOT die — a half-wire is loud, never fatal', () => {
        // the same contract `[case6] [t2]`'s hold message keeps: a misconfiguration
        // that leaks is not worth a broken pipeline
        expect(outcome.status).toEqual(0);
      });

      then('and what a human reads is shaped as here', () => {
        // 🔴 the fragments above prove a span of text SURVIVED; not one of them
        // speaks to the shape a human meets — the tree glyphs, the line breaks,
        // the order. every journey in this file owes that snapshot, so a gap here
        // is a journey whose rendered form no assertion holds
        //
        // .why at THIS grain, when the render is already snapped at integration =
        //      a drift that lives only in the spawned path — an ANSI code, a
        //      stdio buffer artifact, a HelpfulError that formats differently
        //      out-of-process — is invisible to an in-process render snapshot
        //      and slips straight through `toContain`
        expect(outcome.spokenStable).toMatchSnapshot();
      });
    });
  });

  given('[case9] a VITEST consumer who meets a pre-empted run', () => {
    when('[t0] the vitest setup speaks its arrears to a real terminal', () => {
      // 🔴 the fourth instance of one personal failure: a surface with TWO poles,
      // clamped at one. `[case7]` drives the arrears report end-to-end for JEST;
      // `[case6]` drives the vitest journey but captures only STDOUT, so no vitest
      // message was ever proven to reach a terminal at all
      //
      // the risk is concrete rather than theoretical. `setup.vitest.ts` calls the
      // same `setupAutoprune`, so the RENDER is shared — but the emission is not:
      // a vitest pool that swallowed stderr, or an adapter that caught and dropped
      // the report, would leave every render snapshot green and every vitest
      // consumer silently unwarned about residue on their own disk
      //
      // *a render no one receives is a render of fiction* — this file's standard,
      // applied to the runner it had never been applied to
      const outcome = useThen(
        'a pre-empted vitest run leaves a marker, and the next one speaks',
        (): { spokenStable: string; run: string } => {
          const contract = getAllContractPaths();

          // run A — the vitest adapter's setup, one dir, then exit with NO
          // `teardown()`. the marker is left `open`, as a kernel pre-empt leaves it
          const runA = execFileSync(
            process.execPath,
            [
              '-e',
              `
${genChildPrelude({ contract })}
const adapter = require(${JSON.stringify(contract.setupVitest)});
(async () => {
  await adapter.setup();
  genTempDir({ slug: 'acc-vitest-arrears' });
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({
    run: process.env.TEST_FNS_RUN,
    pathPhysical: getOneTempDirRoot().pathPhysical,
  }));
})();
`,
            ],
            { cwd: gitRoot, encoding: 'utf8', stdio: 'pipe' },
          );
          const atA = runA.indexOf(VERDICT_TOKEN);
          if (atA === -1)
            throw new Error(
              `vitest run A rendered no verdict. stdout: ${runA}`,
            );
          const scene: { run: string; pathPhysical: string } = JSON.parse(
            runA.slice(atA + VERDICT_TOKEN.length),
          );

          // run B — a plain vitest setup, with the inherited id STRIPPED so it
          // mints its own. its arrears check must find A's open marker and say so
          const runB = spawnSync(
            process.execPath,
            [
              '-e',
              `
const adapter = require(${JSON.stringify(contract.setupVitest)});
(async () => {
  await adapter.setup();
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run: process.env.TEST_FNS_RUN }));
})();
`,
            ],
            {
              cwd: gitRoot,
              encoding: 'utf8',
              env: genChildEnvFresh(),
            },
          );
          if (runB.status !== 0)
            throw new Error(
              `vitest run B exited ${runB.status}: ${runB.stderr}`,
            );
          const atB = runB.stdout.indexOf(VERDICT_TOKEN);
          if (atB === -1)
            throw new Error(
              `vitest run B named no run. stdout: ${runB.stdout}`,
            );
          const runIdB: string = JSON.parse(
            runB.stdout.slice(atB + VERDICT_TOKEN.length),
          ).run;

          // the stderr is captured and the residue has no reader left — take it
          // back now, per `[case7]`'s precedent
          reclaimRunFixture({ root: scene.pathPhysical, run: scene.run });
          reclaimRunFixture({ root: scene.pathPhysical, run: runIdB });

          return {
            run: scene.run,
            spokenStable: runB.stderr
              .split(scene.pathPhysical)
              .join('<tmpDir>')
              .split(scene.run)
              .join('<runA>')
              .replace(/pid \d+/g, 'pid <pid>')
              .replace(/began \d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'began <ts>')
              .replace(/\br[a-f0-9]{8}\b/g, '<run>'),
          };
        },
      );

      then('🔴 the arrears report reached a real VITEST terminal', () => {
        expect(outcome.spokenStable).toContain('never reclaimed');
        expect(outcome.spokenStable).toContain('<runA>');
      });

      then('it named the SCALE there too, in the singular', () => {
        // run A allocated exactly one dir and no reclaim has taken it
        expect(outcome.spokenStable).toContain('1 temp dir still on disk');
      });

      then(
        '🔴 and it never accuses a vitest config of a half-wire it cannot have',
        () => {
          // .why = vitest's ONE key carries both halves, so `teardownWired` is a
          //        literal `true` in that adapter — a vitest consumer can NEVER be
          //        half-wired. a report that told them to "add the autoprune
          //        teardown to that runner config" would name a key their runner
          //        does not accept, which is a fix that cannot be applied
          expect(outcome.spokenStable).toContain('a class of pre-emption');
          expect(outcome.spokenStable).not.toContain('NO globalTeardown wired');
        },
      );

      then('and what a human reads is shaped as here', () => {
        // the shape, not merely the spans — see `[case8]`'s note. this one is
        // the VITEST terminal, so it is also the only place the two runners'
        // rendered arrears can be diffed side by side against `[case7]`'s snap
        expectNoVolatileBytes(outcome.spokenStable);
        expect(outcome.spokenStable).toMatchSnapshot();
      });
    });
  });

  given('[case10] a run whose teardown meets a dir it CANNOT remove', () => {
    when('[t0] the reclaim reports its residue to a real terminal', () => {
      // 🔴 `case=9`'s entire voice — unremovable residue fails LOUD rather than
      // silently partial, which is the precise defect this whole behavior repairs.
      // it was rendered at integration grain (`autoprune.messages` [case8]) and
      // driven end-to-end nowhere, so a regression that dropped the emission — a
      // swallowed catch, a report moved behind a branch that never fires — would
      // leave the render snapshot green and every consumer silently partial
      //
      // .how the residue is made = the seal trick, already proven by
      //      `pruneRun.integration.jest.test.ts` and `teardownAutoprune.residue`:
      //      chmod 0o500 a POPULATED dir, so its own removal is refused EACCES.
      //      the child unseals in a `finally`, so a red assertion here cannot
      //      strand an unreclaimable dir on the machine
      //
      // .note = the seal does NOT hold for root, which ignores mode bits. the
      //         child therefore PROBES it and reports the answer, so a root
      //         environment fails with a sentence that names the cause rather
      //         than with four assertions that read as a product defect
      const outcome = useThen(
        'the sealed dir resists, and the teardown says so',
        (): { spokenStable: string; sealHolds: boolean; status: number } => {
          const contract = getAllContractPaths();

          const child = spawnSync(
            process.execPath,
            [
              '-e',
              `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
const teardownHook = require(${JSON.stringify(contract.teardownJest)}).default;

(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();

  const dirFree = genTempDir({ slug: 'acc-residue-free' });
  const dirStuck = genTempDir({ slug: 'acc-residue-stuck' });

  // seal a POPULATED child of the stuck dir, so the recursive remove is refused
  const sealed = path.join(dirStuck, 'sealed');
  fs.mkdirSync(sealed, { recursive: true });
  fs.writeFileSync(path.join(sealed, 'child.txt'), 'x', 'utf8');
  fs.chmodSync(sealed, 0o500);

  // does the seal actually bite here? root ignores mode bits
  const sealHolds = (() => {
    try {
      fs.rmSync(path.join(sealed, 'child.txt'));
      return false;
    } catch (thrown) {
      return true;
    }
  })();

  try {
    await teardownHook();
  } finally {
    // unseal and take back everything this case made, sealed dir included
    fs.chmodSync(sealed, 0o700);
    fs.rmSync(dirStuck, { recursive: true, force: true });
    fs.rmSync(dirFree, { recursive: true, force: true });
    for (const name of fs.readdirSync(pathPhysical))
      if (name === 'run.' + run + '.marker.json')
        fs.rmSync(path.join(pathPhysical, name), { force: true });
  }

  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ sealHolds, pathPhysical }));
})();
`,
            ],
            { cwd: gitRoot, encoding: 'utf8' },
          );

          const at = child.stdout.indexOf(VERDICT_TOKEN);
          if (at === -1)
            throw new Error(
              `the child rendered no verdict. status: ${child.status}, stderr: ${child.stderr}`,
            );
          const scene: { sealHolds: boolean; pathPhysical: string } =
            JSON.parse(child.stdout.slice(at + VERDICT_TOKEN.length));

          return {
            sealHolds: scene.sealHolds,
            status: child.status ?? -1,
            spokenStable: asStrerrorMasked(child.stderr)
              .split(scene.pathPhysical)
              .join('<tmpDir>')
              .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
              .replace(/\br[a-f0-9]{8}\b/g, '<run>')
              .replace(/\.[a-f0-9]{8}(?=$|\D)/g, '.<hex>'),
          };
        },
      );

      then('the seal held, so the case tests what it claims to', () => {
        // fail on the SETUP rather than on the product, when the setup is what broke
        expect(outcome.sealHolds).toEqual(true);
      });

      then('🔴 the residue report REACHED a real terminal', () => {
        expect(outcome.spokenStable).toContain('could not reclaim');
      });

      then('it named the errno and the path, never a bare count', () => {
        // a human who reads this must know whether to chmod, unmount, or ask —
        // which is what `asErrno` exists for
        expect(outcome.spokenStable).toContain('EACCES');
        expect(outcome.spokenStable).toContain('acc-residue-stuck');
      });

      then('and it did NOT report the dir it DID reclaim', () => {
        // 🔴 the reclaim must run to completion FIRST and report only what
        // resisted. a report that named every dir would drown the one that
        // matters, and a reclaim that stopped at the first EACCES would leak
        // every dir behind it
        expect(outcome.spokenStable).not.toContain('acc-residue-free');
      });

      then('it did NOT die — loud, never fatal', () => {
        // the contract settled at open question 3: a leak bounded by the age gate
        // is not worth a broken pipeline
        expect(outcome.status).toEqual(0);
      });

      then('and what a human reads is shaped as here', () => {
        // the shape, not merely the spans — see `[case8]`'s note. this render is
        // the one a human meets at the WORST moment (their teardown could not
        // finish), so its legibility is load-bearing rather than cosmetic
        expectNoVolatileBytes(outcome.spokenStable);
        expect(outcome.spokenStable).toMatchSnapshot();
      });
    });
  });

  given('[case11] a contained root the AGE GATE cannot fully clear', () => {
    when(
      '[t0] a real setup runs its gate pass and speaks what it found',
      () => {
        // 🔴 the age gate is the FLOOR four catalog cells stand on — the interrupt
        // (case=4), the unhooked consumer (case=7), the hold hatch (case=6), and a
        // repo whose last run was months ago. it rides `setupAutoprune`, so every
        // hooked run fires it, and its two reports were snapshotted at integration
        // grain only. every acceptance child so far met an EMPTY audit, and both
        // reports early-return on `length === 0` — so their non-empty branches had
        // never crossed a process boundary at all
        //
        // both are driven here in ONE child because both fire from the SAME gate
        // pass. a human meets them together or not at all
        //
        // .note = the THIRD gate message — the gate itself failed to run — is NOT
        //      driven here, and it does not need to be: it has its own
        //      case, `[case16]`. it cannot join this child because it needs the
        //      contained ROOT sealed, and every other case in this file writes
        //      beneath that root. `[case16]` resolves that by giving its child a
        //      root of its own rather than by weakening the seal
        const outcome = useThen(
          'the gate meets one unreadable name and one sealed dir',
          (): { spokenStable: string; sealHolds: boolean; status: number } => {
            const contract = getAllContractPaths();

            const child = spawnSync(
              process.execPath,
              [
                '-e',
                `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
const teardownHook = require(${JSON.stringify(contract.teardownJest)}).default;

// the root, WITHOUT a mint — getOneTempDirRoot derives it, so the plants land
// where a real gate pass will look
const { pathPhysical } = getOneTempDirRoot();
fs.mkdirSync(pathPhysical, { recursive: true });

// 1. a name the gate cannot read, so it can judge no age from it
const nameUnreadable = 'acc-gate-unreadable-name';
fs.mkdirSync(path.join(pathPhysical, nameUnreadable), { recursive: true });

// 2. an AGED dir, sealed, so the gate tries to reap it and is refused
const stampAged = new Date(Date.now() - 48 * 60 * 60 * 1000)
  .toISOString()
  .replace(/:/g, '-');
const dirAged = path.join(pathPhysical, stampAged + '.acc-gate-stale.a1b2c3d4');
const sealed = path.join(dirAged, 'sealed');
fs.mkdirSync(sealed, { recursive: true });
fs.writeFileSync(path.join(sealed, 'child.txt'), 'x', 'utf8');
fs.chmodSync(sealed, 0o500);

const sealHolds = (() => {
  try {
    fs.rmSync(path.join(sealed, 'child.txt'));
    return false;
  } catch (thrown) {
    return true;
  }
})();

(async () => {
  try {
    await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
    await teardownHook();
  } finally {
    fs.chmodSync(sealed, 0o700);
    fs.rmSync(dirAged, { recursive: true, force: true });
    fs.rmSync(path.join(pathPhysical, nameUnreadable), { recursive: true, force: true });
  }

  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ sealHolds, pathPhysical }));
})();
`,
              ],
              {
                cwd: gitRoot,
                encoding: 'utf8',
                env: genChildEnvFresh(),
              },
            );

            const at = child.stdout.indexOf(VERDICT_TOKEN);
            if (at === -1)
              throw new Error(
                `the child rendered no verdict. status: ${child.status}, stderr: ${child.stderr}`,
              );
            const scene: { sealHolds: boolean; pathPhysical: string } =
              JSON.parse(child.stdout.slice(at + VERDICT_TOKEN.length));

            return {
              sealHolds: scene.sealHolds,
              status: child.status ?? -1,
              spokenStable: asStrerrorMasked(child.stderr)
                .split(scene.pathPhysical)
                .join('<tmpDir>')
                .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
                .replace(/\br[a-f0-9]{8}\b/g, '<run>'),
            };
          },
        );

        then('the seal held, so the case tests what it claims to', () => {
          expect(outcome.sealHolds).toEqual(true);
        });

        then(
          '🔴 the gate said WHICH name it could not read, at a real terminal',
          () => {
            // .why = an unreadable name is preserved forever — it has no judgeable
            //        age — so a gate that preserved it SILENTLY would grow a
            //        permanent, invisible population. the whole point of the report
            //        is to make that population visible
            expect(outcome.spokenStable).toContain('acc-gate-unreadable-name');
          },
        );

        then('🔴 and it said which AGED dir resisted, with its errno', () => {
          expect(outcome.spokenStable).toContain('acc-gate-stale');
          expect(outcome.spokenStable).toContain('EACCES');
        });

        then(
          'it did NOT die — the gate is a backstop, never a gate on the run',
          () => {
            // a run must not fail because a dir from some OTHER run resisted. the age
            // gate reclaims what it can and reports the rest
            expect(outcome.status).toEqual(0);
          },
        );

        then('🔴 the two findings are SEPARATED, never run together', () => {
          // 🔴 this is the boundary the composite export exists to grade, and it
          // is asserted here rather than left for a reader to infer from the
          // export's shape. a reviewer read the two-message export as *"two
          // messages packed into one snapshot"* and proposed a split — a fair
          // read of an export whose subject was stated only in prose.
          //
          // the split is DECLINED, and for a reason rather than a preference:
          // these two reports fire from ONE gate pass, so a human meets them
          // together or not at all. split into two exports, each renders alone
          // and the SEAM between them — the one property no other case in this
          // file can show — is graded by no test. *two reports that stack is
          // the subject here, never the two reports themselves.*
          //
          // so the reviewer's real concern (the boundary is obscured) is taken
          // in the form that keeps the subject: the seam becomes a checked
          // promise. exactly ONE blank line, never zero (a run-on) and never two
          // (a gap). a round that changes `sayReport`'s separator must now
          // delete an assertion that says what the separator is for.
          expect(outcome.spokenStable).toContain(
            'widen access to it.\n\n🧹 test-fns:',
          );
          expect(outcome.spokenStable).not.toContain('\n\n\n');
        });

        then('and what a human reads is shaped as here', () => {
          // the shape, not merely the spans — see `[case8]`'s note. this is the
          // only render where TWO independent reports land from one gate pass,
          // so the snapshot is the sole check that they read as two findings
          // rather than one run-on
          expectNoVolatileBytes(outcome.spokenStable);
          expect(outcome.spokenStable).toMatchSnapshot();
        });
      },
    );
  });

  given('[case12] a run marker TORN mid-write, which no run can parse', () => {
    when('[t0] the next run says what it could not judge', () => {
      // 🔴 the last arrears message with no acceptance grain. the population it
      // names is the one BOTH reclaims skip — the dir sweep filters files, and
      // the arrears check cannot parse it — so this notice is the only guard
      // between a torn marker and a permanent, invisible resident
      //
      // it was proven at integration grain directly against `reportRunArrears`,
      // which is the renderer. that leaves the EMISSION unproven: a regression
      // that moved the guard at `reportRunArrears.ts:38`, or dropped the call
      // from the setup path, would leave the render snapshot green and the
      // human silent — *a render no one receives is a render of fiction*
      //
      // .note = the torn marker is written by hand rather than through
      //         `setRunMarker`, and it must be. `setRunMarker` refuses to write
      //         a record that cannot be read back, which is exactly the guard
      //         that keeps this state out of our own reach — so the only honest
      //         way to reach it is the way a kernel does, with a raw partial
      //         write to the real contained root
      const outcome = useThen(
        'a torn marker sits in the root, and a real setup meets it',
        (): { spokenStable: string; status: number; nameTorn: string } => {
          const contract = getAllContractPaths();
          const nameTorn = 'run.rdeadfa11.marker.json';

          const child = spawnSync(
            process.execPath,
            [
              '-e',
              `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
const teardownHook = require(${JSON.stringify(contract.teardownJest)}).default;

// the root, WITHOUT a mint — so the plant lands where a real arrears check looks
const { pathPhysical } = getOneTempDirRoot();
fs.mkdirSync(pathPhysical, { recursive: true });

// a write torn mid-flight: the json opens and never closes, exactly as a
// process killed between \`writeFileSync\`'s syscalls would leave it
const pathTorn = path.join(pathPhysical, ${JSON.stringify(nameTorn)});
fs.writeFileSync(pathTorn, '{"run":"rdeadfa1', 'utf8');

(async () => {
  try {
    await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
    await teardownHook();
  } finally {
    // 🔴 this case MAKES an unparseable resident on purpose, so it owes its own
    // removal. left behind, it would be named by every later run in this file —
    // and the age gate's marker sweep would not take it for a day
    fs.rmSync(pathTorn, { force: true });
  }

  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ pathPhysical }));
})();
`,
            ],
            {
              cwd: gitRoot,
              encoding: 'utf8',
              env: genChildEnvFresh(),
            },
          );

          const at = child.stdout.indexOf(VERDICT_TOKEN);
          if (at === -1)
            throw new Error(
              `the child rendered no verdict. status: ${child.status}, stderr: ${child.stderr}`,
            );
          const scene: { pathPhysical: string } = JSON.parse(
            child.stdout.slice(at + VERDICT_TOKEN.length),
          );

          return {
            nameTorn,
            status: child.status ?? -1,
            spokenStable: asStrerrorMasked(child.stderr)
              .split(scene.pathPhysical)
              .join('<tmpDir>')
              .replace(/\br[a-f0-9]{8}\b/g, '<run>'),
          };
        },
      );

      then('🔴 the unreadable-marker notice REACHED a real terminal', () => {
        // the emission, not the render — the half no snapshot of the renderer
        // can prove
        expect(outcome.spokenStable).toContain('could not be read');
      });

      then('it named WHICH marker, never merely that one exists', () => {
        // .why = the fix is "remove it by hand". a human cannot apply that fix
        //        against a count — they need the name, and the directory it
        //        sits in
        expect(outcome.spokenStable).toContain('marker.json');
        expect(outcome.spokenStable).toContain('<tmpDir>');
      });

      then('and it named the fix, not merely the symptom', () => {
        expect(outcome.spokenStable).toContain('fix:');
        expect(outcome.spokenStable).toContain('by hand');
      });

      then(
        '🔴 and it did NOT offer an action that cannot work for THIS cause',
        () => {
          // the fix line branches on the fault class, and this journey plants a
          // TORN write — bytes that arrived and are wrong. a chmod over a truncated
          // file leaves it exactly as unparseable, so *"widen access"* names a move
          // that cannot succeed here. it is offered to the EACCES half alone, whose
          // bytes are intact and merely withheld
          //
          // .note = asserted at ACCEPTANCE grain and not at the renderer's alone.
          //         the branch is chosen from `audit.namesUnreadable`, which a real
          //         setup builds from a real `readFileSync` over a real torn file —
          //         so only this grain proves the fault a live read reports lands
          //         on the branch the renderer expects
          expect(outcome.spokenStable).not.toContain('widen access');
          expect(outcome.spokenStable).toContain('no access change can mend');
        },
      );

      then('it did NOT die — a torn marker is a notice, never a gate', () => {
        // a run must not fail because some OTHER run's marker was torn. the
        // report is independent of this run's own fate
        expect(outcome.status).toEqual(0);
      });

      then('and what a human reads is shaped as here', () => {
        expectNoVolatileBytes(outcome.spokenStable);
        expect(outcome.spokenStable).toMatchSnapshot();
      });
    });
  });

  given('[case13] a prior run wired SETUP-ONLY, met by the next run', () => {
    when('[t0] the next run names that cause at a real terminal', () => {
      // 🔴 the halfwired-cause sentence was proven only in the NEGATIVE at this
      // grain: `[case7]` and `[case9]` each assert
      // `not.toContain('NO globalTeardown wired')`, and no journey ever made it
      // appear. **a negative assertion is not a substitute for a positive one** —
      // the sentence could have been deleted from `reportRunArrears` outright and
      // both of those assertions would have gone greener, not redder
      //
      // it is also the one arrears cause we hold hard EVIDENCE for (the run's own
      // setup read its config and saw no teardown beside it), so it is the one a
      // human can act on directly — which makes its silence the costliest
      const outcome = useThen(
        'a setup-only run leaves a marker, and the next run diagnoses it',
        (): { spokenStable: string; status: number } => {
          const contract = getAllContractPaths();

          // run A — setup with an EMPTY globalConfig, so `teardownWired` is false.
          // this is the half-wire jest's two-key surface makes reachable, and the
          // state `[case8]` proves from the teardown side. here it is proven from
          // the side that matters more: a LATER run's diagnosis of it
          const runA = execFileSync(
            process.execPath,
            [
              '-e',
              `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
(async () => {
  await setupHook({});
  genTempDir({ slug: 'acc-halfwire-arrears' });
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({
    run: process.env.TEST_FNS_RUN,
    pathPhysical: getOneTempDirRoot().pathPhysical,
  }));
})();
`,
            ],
            { cwd: gitRoot, encoding: 'utf8', stdio: 'pipe' },
          );
          const atA = runA.indexOf(VERDICT_TOKEN);
          if (atA === -1)
            throw new Error(`run A rendered no verdict. stdout: ${runA}`);
          const scene: { run: string; pathPhysical: string } = JSON.parse(
            runA.slice(atA + VERDICT_TOKEN.length),
          );

          // run B — a properly wired run, which must find A's marker and name the
          // cause it holds evidence for
          const runB = spawnSync(
            process.execPath,
            [
              '-e',
              `
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run: process.env.TEST_FNS_RUN }));
})();
`,
            ],
            {
              cwd: gitRoot,
              encoding: 'utf8',
              env: genChildEnvFresh(),
            },
          );
          if (runB.status !== 0)
            throw new Error(`run B exited ${runB.status}: ${runB.stderr}`);
          const atB = runB.stdout.indexOf(VERDICT_TOKEN);
          if (atB === -1)
            throw new Error(`run B named no run. stdout: ${runB.stdout}`);
          const runIdB: string = JSON.parse(
            runB.stdout.slice(atB + VERDICT_TOKEN.length),
          ).run;

          // both runs left residue on purpose — take it back here rather than
          // leave it to an age gate a day out, as `[case7]` does
          reclaimRunFixture({ root: scene.pathPhysical, run: scene.run });
          reclaimRunFixture({ root: scene.pathPhysical, run: runIdB });

          return {
            status: runB.status ?? -1,
            spokenStable: runB.stderr
              .split(scene.pathPhysical)
              .join('<tmpDir>')
              .split(scene.run)
              .join('<runA>')
              .replace(/pid \d+/g, 'pid <pid>')
              .replace(/began \d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'began <ts>')
              .replace(/\br[a-f0-9]{8}\b/g, '<run>'),
          };
        },
      );

      then(
        '🔴 it named the half-wired cause OUTRIGHT — the POSITIVE proof',
        () => {
          // the assertion this whole case exists for. `[case7]` and `[case9]` can
          // only say this sentence is absent; this is the one place it is PRESENT
          expect(outcome.spokenStable).toContain('NO globalTeardown wired');
          expect(outcome.spokenStable).toContain('half-wired');
        },
      );

      then('and it did NOT fall back to the vague class of cause', () => {
        // .why = the two branches are exclusive. we hold real evidence here — the
        //        run's own config — so to also offer "a class of pre-emption"
        //        would hand the human back the guesswork the evidence removed
        expect(outcome.spokenStable).not.toContain('a class of pre-emption');
      });

      then('and it named the fix, which is a config key they can paste', () => {
        expect(outcome.spokenStable).toContain('fix:');
        expect(outcome.spokenStable).toContain('teardown');
      });

      then(
        'it did NOT die — a prior half-wire is a notice, never a gate',
        () => {
          expect(outcome.status).toEqual(0);
        },
      );

      then('and what a human reads is shaped as here', () => {
        expectNoVolatileBytes(outcome.spokenStable);
        expect(outcome.spokenStable).toMatchSnapshot();
      });
    });
  });

  given('[case14] a run whose MINT CHAIN broke, met by the next run', () => {
    when('[t0] the broken chain is caught, and the next run says so', () => {
      // 🔴 TWO messages no acceptance journey reached, and they share one child
      // because they are one event seen from two runs:
      //
      //   run A — `assertMintChainHeld` throws. this is the guard against the
      //           worst failure this whole behavior can have: the stamp stops
      //           reaching the workers, every dir lands unstamped, the reclaim
      //           matches zero, and THE SUITE STAYS GREEN while the leak
      //           resumes. it was snapshotted only by a direct in-process call,
      //           so a regression in the real handoff — the exact regression it
      //           exists to catch — would have left every test green
      //
      //   run B — "its teardown BEGAN but did not finish". the `partial`
      //           state's no-residue reading, proven nowhere past a direct call
      //           to `reportRunArrears`. `[case7]` and `[case9]` only ever
      //           produce `open` (the teardown never began at all)
      //
      // .how the break is made = by DELETING the run id from the env before the
      //      allocation, then restoring it. that is not a simulation of the
      //      break — it IS the break, in the one place a runner upgrade would
      //      produce it: a worker that never received the stamp. the dir is made
      //      by the real allocator, through the contract, and lands unstamped
      //
      // .note = run A must allocate ZERO stamped dirs, or the guard returns
      //         early on its own second term (`countMatched > 0`). so run B's
      //         render reads `0 temp dirs still on disk` — which is the honest
      //         number and not an omission: the dir this run made is on disk,
      //         and the whole point is that no reader can attribute it to the run
      //
      // .note = run A's stderr must carry the MalfunctionError ALONE. the unhooked
      //         notice stacked above it is a defect rather than a "second detector",
      //         and `case=10`'s demo forbids it in as many words. see the
      //         `not.toContain` below, and `isSomeRunLive` for the guard that keeps
      //         the two apart
      const outcome = useThen(
        'the chain breaks, run A throws, and run B reports the arrears',
        (): {
          spokenA: string;
          spokenRawA: string;
          statusA: number;
          spokenB: string;
          statusB: number;
        } => {
          const contract = getAllContractPaths();

          // run A — a properly wired run whose stamp never reaches the allocation
          const runA = spawnSync(
            process.execPath,
            [
              '-e',
              `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
const teardownHook = require(${JSON.stringify(contract.teardownJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();

  // 🔴 the break itself — the worker allocates with no stamp in its env
  delete process.env.TEST_FNS_RUN;
  const dirOrphan = genTempDir({ slug: 'acc-chain-broken' });
  process.env.TEST_FNS_RUN = run;

  // named BEFORE the teardown, because the teardown is not going to return
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run, pathPhysical, dirOrphan }));

  await teardownHook();
})();
`,
            ],
            {
              cwd: gitRoot,
              encoding: 'utf8',
              env: genChildEnvFresh(),
            },
          );
          const atA = runA.stdout.indexOf(VERDICT_TOKEN);
          if (atA === -1)
            throw new Error(
              `run A rendered no verdict. status: ${runA.status}, stderr: ${runA.stderr}`,
            );
          const scene: {
            run: string;
            pathPhysical: string;
            dirOrphan: string;
          } = JSON.parse(runA.stdout.slice(atA + VERDICT_TOKEN.length));

          // run B — a plain wired setup, which must find A's `partial` marker
          const runB = spawnSync(
            process.execPath,
            [
              '-e',
              `
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run: process.env.TEST_FNS_RUN }));
})();
`,
            ],
            {
              cwd: gitRoot,
              encoding: 'utf8',
              env: genChildEnvFresh(),
            },
          );
          const atB = runB.stdout.indexOf(VERDICT_TOKEN);
          if (atB === -1)
            throw new Error(
              `run B named no run. status: ${runB.status}, stderr: ${runB.stderr}`,
            );
          const runIdB: string = JSON.parse(
            runB.stdout.slice(atB + VERDICT_TOKEN.length),
          ).run;

          // the orphan carries NO run id, so `reclaimRunFixture` cannot reach it
          // — the very property that made it evidence makes it ours to remove
          fs.rmSync(scene.dirOrphan, { recursive: true, force: true });
          reclaimRunFixture({ root: scene.pathPhysical, run: scene.run });
          reclaimRunFixture({ root: scene.pathPhysical, run: runIdB });

          const asStable = (text: string): string =>
            text
              .split(scene.pathPhysical)
              .join('<tmpDir>')
              .split(scene.run)
              .join('<runA>')
              .replace(/pid \d+/g, 'pid <pid>')
              .replace(/began \d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'began <ts>')
              .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
              .replace(/\br[a-f0-9]{8}\b/g, '<run>')
              .replace(/\.[a-f0-9]{8}(?=$|\D)/g, '.<hex>')
              // both VERSIONS are masked, and the shape around each is kept —
              // `"versionRunner": "jest@<version>"` still proves the runner is
              // named, which is the report's whole value, while the digits that
              // churn on every dependency bump stay out of the snapshot
              .replace(/v\d+\.\d+\.\d+[\w.-]*/g, '<version>')
              .replace(/@\d+\.\d+\.\d+[\w.-]*/g, '@<version>');

          /**
           * .what = the part of a thrown error a human reads and acts on
           * .why = node wraps OUR message in framing that is entirely its own and
           *        entirely churn: a throw-site path with a line number, the
           *        source line, a caret, then the stack. every one of those moves
           *        on a dependency bump while the message says the same thing.
           *
           *        so both are dropped, and what stays is the header, the
           *        metadata, and the hint — the only part whose wording we own,
           *        and the only part a snapshot can hold a promise about
           *
           * .note = 🔴 the terminal newline is RESTORED, and that is a repair of
           *         this transformer rather than a decoration of the record. the
           *         split consumes the `\n` that ends the message — it is the
           *         first character of the `\n    at ` delimiter — so a record
           *         that drops it disagrees with the terminal by one byte, and
           *         jest's final `"` lands glued to the last `}`. careful readers
           *         read that glued delimiter as product output, which is what a
           *         record a reader cannot parse costs. every other export in this
           *         file, and the integration twin of THIS message, end with the
           *         newline — so an odd one out is the artifact, never the product
           */
          const asHumanFacing = (text: string): string =>
            `${(text.split('\n    at ')[0] ?? '')
              .replace(
                /^[^\n]*node_modules[^\n]*:\d+\n[^\n]*\n[^\n]*\^\n\n/m,
                '',
              )
              // 🔴 node's OWN `${err.name}: ` prefix, which it prepends to any
              //    uncaught throw. it is the same kind of framing as the stack and
              //    the throw-site line above — node's, never ours — and this
              //    transformer's whole declared subject is *the part whose wording
              //    we own*. kept, it renders as
              //    `MalfunctionError: 💥 MalfunctionError:` — which careful readers
              //    read as our own duplicated label, and which makes this grain
              //    disagree with its integration twin on one identical message.
              //
              //    .note = the duplication a HUMAN sees is real and is NOT hidden by
              //            this — `[t?] the raw stderr` below pins it outright. the
              //            cause is upstream: `helpful-errors` builds the class name
              //            into the message (`HelpfulError.js:29-35`) and node
              //            prepends it again. it is flagged to `ehmpathy/helpful-errors`,
              //            where one fix serves every repo in the ecosystem
              .replace(/^[A-Za-z]+Error: (?=💥)/, '')}\n`;

          return {
            statusA: runA.status ?? -1,
            spokenA: asStable(asHumanFacing(runA.stderr)),
            spokenRawA: asStable(runA.stderr),
            statusB: runB.status ?? -1,
            spokenB: asStable(runB.stderr),
          };
        },
      );

      then('🔴 the broken chain REACHED a real terminal', () => {
        // the emission through the compiled artifact, not the render — the half
        // an in-process snapshot of the thrower cannot prove
        expect(outcome.spokenA).toContain(
          'the temp-dir run stamp never reached the workers',
        );
      });

      then(
        '🔴 and the DUPLICATED class prefix a human sees is on record',
        () => {
          // .why = the snapshot above records the part whose words we OWN, with
          //        node's own prefix and stack stripped. that is the right subject
          //        for a record of our message — and it would let a real,
          //        human-visible blemish go unrecorded if this did not exist.
          //
          //        so the raw stderr is graded here, outright: a human whose build
          //        hits a broken chain reads the class name TWICE, once from
          //        `helpful-errors` (which builds it into the message at
          //        `HelpfulError.js:29-35`) and once from node's uncaught printer.
          //
          // .note = it is `toContain`, so it does NOT redden when the upstream fix
          //         lands — it reddens if the SHAPE changes in a way we did not
          //         expect. the duplication itself is flagged to
          //         `ehmpathy/helpful-errors`, the one place it can be fixed for
          //         every repo at once rather than patched over here
          expect(outcome.spokenRawA).toContain(
            'MalfunctionError: 💥 MalfunctionError:',
          );
        },
      );

      then('it named the ORPHAN it found, and the count it matched', () => {
        // a maintainer needs both terms of the predicate, or the report is a
        // bare accusation they cannot check
        //
        // .note = the labels are the HUMAN ones (`orphan:`, `matched N of`),
        //         because the report is a treestruct a human reads rather than a
        //         metadata dump they decode. the facts are the same five either
        //         way; only the surface differs
        expect(outcome.spokenA).toContain('orphan: ');
        expect(outcome.spokenA).toContain('acc-chain-broken');
        expect(outcome.spokenA).toContain('matched 0 of its own dirs');
      });

      then('and the VERSIONS a maintainer must look at', () => {
        // the guard's whole value is that it names the upgrade to suspect
        expect(outcome.spokenA).toContain('node: ');
        expect(outcome.spokenA).toContain('runner: jest@');
      });

      then(
        '🔴 and it reads in the SAME FAMILY as every other report here',
        () => {
          // .why = this is the one message a human meets at the worst moment — the
          //        run is over and the reclaim has been silently matching zero. a
          //        raw JSON dump here makes a reader re-orient at exactly the wrong
          //        time, so it carries the same treestruct, the same `cause:`, and
          //        the same `fix:` as the eight notices beside it
          //        (rule.require.treestruct-output)
          expect(outcome.spokenA).toContain('   ├─ ');
          expect(outcome.spokenA).toContain('   └─ fix: ');
          expect(outcome.spokenA).toContain('cause: ');

          // .note = and it does NOT wear 🧹. that badge is the SPEAKER — the
          //         reclaim subsystem — and it means "a notice your run survives"
          //         everywhere else in this behavior; this one means the run is
          //         over. one label, one sense
          expect(outcome.spokenA).toContain('💥');
          expect(outcome.spokenA).not.toContain('🧹');
        },
      );

      then('🔴 and the RECORD of it ends as the terminal does', () => {
        // .why = a snapshot is rewritten in place on a local run, so it renders
        //        whatever the transformer produces and reports green either way.
        //        this assertion is what gives that convention teeth: it goes red
        //        on a truncation that drops the terminal newline. the record must
        //        agree with the terminal byte for byte, or a reader cannot tell
        //        our text from the harness boundary that wraps it
        expect(outcome.spokenA.endsWith('\n')).toEqual(true);
        expect(outcome.spokenA.startsWith('\n')).toEqual(false);

        // 🔴 ONE newline, never two — and that is the EMITTER's answer rather
        // than a capture artifact. a `sayReport` block closes with a blank line
        // so two stacked reports do not run together; a THROW is the last word
        // the process speaks, so it has no successor to be separated from.
        //
        // .note = careful readers read this difference as a blemish, and an answer
        //         filed in the INTEGRATION file alone does not reach them — that is
        //         not the file they have open. *a reason recorded where the reader
        //         is not is a reason that gets re-filed.* so the mirror of the
        //         integration clamp lives here too, at the grain whose export a
        //         reviewer actually opens
        expect(outcome.spokenA.endsWith('\n\n')).toEqual(false);
      });

      then('🔴 it DIED — this one is fatal, unlike every other notice', () => {
        // .why = every other message in this behavior is loud-but-exit-zero,
        //        because a bounded leak is not worth a broken pipeline. this one
        //        is the exception and must stay one: a broken chain means the
        //        reclaim silently matches zero from here on, so a green exit
        //        would restore the exact silence the behavior exists to end
        expect(outcome.statusA).not.toEqual(0);
      });

      then('🔴 and it did NOT also blame the consumer for OUR defect', () => {
        // 🔴 the assertion this journey EARNED. a worker with no stamp in its
        // env is indistinguishable BY ENV from an unhooked consumer, so an
        // env-only detector fires `warnIfUnhooked` here too and stacks both
        // messages in one render — a product defect, never a "second detector".
        //
        // `case=10`'s demo says so in as many words: *"to hand kai case=7's
        // message here would be actively harmful: it tells kai to add config kai
        // has already added, and blames kai for our defect. the two cells share a
        // symptom and must never share a message."*
        //
        // `isSomeRunLive` is what holds them apart — the disk CAN tell the two
        // apart even where the env cannot, because a marker is written only by our
        // own setup. so the notice is withheld and the correct report stands alone
        expect(outcome.spokenA).not.toContain('are never reclaimed here');
        expect(outcome.spokenA).not.toContain('globalSetup:');
      });

      then(
        // 🔴 the WHY rides in the test NAME, and that placement is the fix.
        // careful readers file this single trailing newline as a blemish, and an
        // answer in a comment or a `.taken` file does not reach them — neither is
        // the artifact a snapshot reviewer opens. they read the `.snap`, and a
        // jest snapshot key IS the test name, so a reason written here is the
        // only one that reaches them.
        //
        // *a reason recorded where the reader is not is a reason that gets
        // re-filed.*
        'and what run A leaves a human is shaped as here — ONE trailing newline, never two, since a throw is the last word the process speaks and has no successor to be separated from',
        () => {
          expectNoVolatileBytes(outcome.spokenA);
          expect(outcome.spokenA).toMatchSnapshot();
        },
      );

      then(
        '🔴 the NEXT run named the `partial` state — BEGAN, did not finish',
        () => {
          // the second message this case exists for. run A's teardown wrote
          // `partial` AHEAD of the reclaim and then threw out of the guard — so
          // it began and never finished, and this is the only journey in the
          // suite that reaches that reading
          expect(outcome.spokenB).toContain(
            'its teardown BEGAN but did not finish',
          );
        },
      );

      then('and it did NOT claim the teardown never ran', () => {
        // .why = the whole reason `partial` is written ahead of the work. the
        //        `open` sentence would send this adopter to audit a config that
        //        was never at fault, while the cause sat in a runner upgrade
        expect(outcome.spokenB).not.toContain('its teardown never ran');
      });

      then('and what run B leaves a human is shaped as here', () => {
        expectNoVolatileBytes(outcome.spokenB);
        expect(outcome.spokenB).toMatchSnapshot();
      });

      then('run B did NOT die — to report arrears is never a gate', () => {
        expect(outcome.statusB).toEqual(0);
      });
    });
  });

  given('[case15] a run PRE-EMPTED after its teardown met residue', () => {
    when('[t0] the next run speaks the residue that run could not', () => {
      // 🔴 the THIRD reading of `partial`, and the one that carries the payload:
      // a teardown that BEGAN, met a dir it could not remove, wrote the residue
      // into its marker — and then the run ended. the human who needed that
      // report may never have seen run A's terminal at all (a CI job that
      // scrolled, a window closed), so the marker is the durable copy and the
      // NEXT run is who delivers it.
      //
      // it was proven only by a direct call to `reportRunArrears` with a
      // hand-built marker. so no test checked that a REAL teardown writes a
      // marker a REAL later run can read the residue out of — which is the whole
      // handoff, and it spans two processes and a file
      //
      // .how = the same seal trick `[case10]` uses, with one difference that
      //        matters: the sealed dir stays sealed until run B has spoken, so
      //        run B's `still on disk` count is the truth rather than a number
      //        our own cleanup already invalidated
      const outcome = useThen(
        'run A leaves residue in its marker, and run B reads it out',
        (): { spokenStable: string; sealHolds: boolean; status: number } => {
          const contract = getAllContractPaths();

          // run A — allocates two, seals one, runs its teardown, exits 0 with the
          // marker left `partial` and carrying the residue
          const runA = spawnSync(
            process.execPath,
            [
              '-e',
              `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
const teardownHook = require(${JSON.stringify(contract.teardownJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();

  genTempDir({ slug: 'acc-arrears-residue-free' });
  const dirStuck = genTempDir({ slug: 'acc-arrears-residue-stuck' });

  const sealed = path.join(dirStuck, 'sealed');
  fs.mkdirSync(sealed, { recursive: true });
  fs.writeFileSync(path.join(sealed, 'child.txt'), 'x', 'utf8');
  fs.chmodSync(sealed, 0o500);

  // does the seal bite here? root ignores mode bits
  const sealHolds = (() => {
    try {
      fs.rmSync(path.join(sealed, 'child.txt'));
      return false;
    } catch (thrown) {
      return true;
    }
  })();

  await teardownHook();

  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run, pathPhysical, sealed, sealHolds }));
})();
`,
            ],
            {
              cwd: gitRoot,
              encoding: 'utf8',
              env: genChildEnvFresh(),
            },
          );
          const atA = runA.stdout.indexOf(VERDICT_TOKEN);
          if (atA === -1)
            throw new Error(
              `run A rendered no verdict. status: ${runA.status}, stderr: ${runA.stderr}`,
            );
          const scene: {
            run: string;
            pathPhysical: string;
            sealed: string;
            sealHolds: boolean;
          } = JSON.parse(runA.stdout.slice(atA + VERDICT_TOKEN.length));

          let runIdB: string | null = null;
          try {
            const runB = spawnSync(
              process.execPath,
              [
                '-e',
                `
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run: process.env.TEST_FNS_RUN }));
})();
`,
              ],
              {
                cwd: gitRoot,
                encoding: 'utf8',
                env: genChildEnvFresh(),
              },
            );
            const atB = runB.stdout.indexOf(VERDICT_TOKEN);
            if (atB === -1)
              throw new Error(
                `run B named no run. status: ${runB.status}, stderr: ${runB.stderr}`,
              );
            runIdB = JSON.parse(
              runB.stdout.slice(atB + VERDICT_TOKEN.length),
            ).run;

            return {
              sealHolds: scene.sealHolds,
              status: runB.status ?? -1,
              spokenStable: runB.stderr
                .split(scene.pathPhysical)
                .join('<tmpDir>')
                .split(scene.run)
                .join('<runA>')
                .replace(/pid \d+/g, 'pid <pid>')
                .replace(/began \d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'began <ts>')
                .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
                .replace(/\br[a-f0-9]{8}\b/g, '<run>')
                .replace(/\.[a-f0-9]{8}(?=$|\D)/g, '.<hex>'),
            };
          } finally {
            // unseal LAST, so no act of our own cleanup can change what run B
            // saw — then take back both runs' entries, as `[case7]` does
            fs.chmodSync(scene.sealed, 0o700);
            reclaimRunFixture({ root: scene.pathPhysical, run: scene.run });
            if (runIdB)
              reclaimRunFixture({ root: scene.pathPhysical, run: runIdB });
          }
        },
      );

      then('the seal held, so the case tests what it claims to', () => {
        expect(outcome.sealHolds).toEqual(true);
      });

      then(
        '🔴 the NEXT run spoke the residue run A could not live to deliver',
        () => {
          expect(outcome.spokenStable).toContain(
            'its teardown BEGAN and met residue it could not remove',
          );
          expect(outcome.spokenStable).toContain('EACCES');
          expect(outcome.spokenStable).toContain('acc-arrears-residue-stuck');
        },
      );

      then('and it counted the dir still on disk, in the singular', () => {
        // the free dir was reclaimed and the sealed one was not, so the count
        // must read one — and that is the agreement case a `(s)` suffix gets wrong
        expect(outcome.spokenStable).toContain('1 temp dir still on disk');
      });

      then('and it did NOT report the dir run A DID reclaim', () => {
        expect(outcome.spokenStable).not.toContain('acc-arrears-residue-free');
      });

      then('it did NOT die — loud, never fatal', () => {
        expect(outcome.status).toEqual(0);
      });

      then('and what a human reads is shaped as here', () => {
        expectNoVolatileBytes(outcome.spokenStable);
        expect(outcome.spokenStable).toMatchSnapshot();
      });
    });
  });

  given('[case16] a contained root the AGE GATE cannot even READ', () => {
    when('[t0] an unhooked consumer allocates against it', () => {
      // 🔴 the last message in this behavior with no acceptance grain, and the
      // one that reports the WORST state: the age gate itself is down. for an
      // unhooked consumer that gate is their ONLY reclaim, so a gate that fails
      // in silence is the 12,369-dir accrual resumed under a green suite —
      // precisely the failure this whole behavior exists to end.
      //
      // .why it is unreachable from every other child = it needs the contained
      //      ROOT unreadable, and every other case in this file writes beneath
      //      that root. `[case11]` recorded that as a deferral; this case settles
      //      it the other way — not by weakening the seal, but by giving the
      //      child A ROOT OF ITS OWN.
      //
      // .how = the root derives from the git root's basename, so a child whose
      //        cwd is a THROWAWAY git repo derives a throwaway contained root.
      //        no env override, no internal reach — the same public derivation a
      //        consumer gets, pointed somewhere disposable
      //
      // .why the seal is 0o300 and not 0o000 = the fault we mean to reproduce is
      //      an unreadable root, not an unusable one. write+execute stays, so the
      //      allocation itself still succeeds and the gate is the only thing that
      //      fails — which is exactly the shape of a permissions change on a
      //      shared /tmp, and it keeps the case honest about WHICH step broke
      //
      // .note = it drives `genTempDir` rather than a hook, and that is the
      //         faithful journey: `setupAutoprune` AWAITS the gate, so a sealed
      //         root there throws rather than reports. this message belongs to
      //         `pruneStaleOnce`, the unhooked path — the readers who own it
      const outcome = useThen(
        'the gate cannot read the root, and says so before it gives up',
        (): { spokenStable: string; sealHolds: boolean; status: number } => {
          const contract = getAllContractPaths();

          // a throwaway git repo, so the child derives a contained root that no
          // other case in this file can be standing in
          const repoThrowaway = genRepoThrowaway({ slug: 'acc-gate' });

          let rootChild: string | null = null;
          try {
            const child = spawnSync(
              process.execPath,
              [
                '-e',
                `
${genChildPrelude({ contract })}

(async () => {
  const { pathPhysical } = getOneTempDirRoot();
  fs.mkdirSync(pathPhysical, { recursive: true });

  // seal the root for READ, and only for read
  fs.chmodSync(pathPhysical, 0o300);
  const sealHolds = (() => {
    try {
      fs.readdirSync(pathPhysical);
      return false;
    } catch (thrown) {
      return true;
    }
  })();

  // 🔴 a READINESS PROBE on the gate's own report, never a wall-clock guess.
  //    the gate is deliberately NOT awaited (it must never block the allocation
  //    that triggered it), so its report lands on a later tick — and a fixed
  //    sleep is a race in both directions: too short on a loaded box and the
  //    parent reads a TRUNCATED stderr and reddens for a non-defect; too long
  //    and every run on every machine pays for the worst case.
  //
  //    .note = it watches for the gate's OWN words, never for "any stderr". an
  //            unhooked child speaks the unhooked notice FIRST, synchronously,
  //            inside the very genTempDir call below — so a bare "something was
  //            written" probe would fire on that and cut the gate off mid-report.
  //            the precise signal is the only correct one here
  let spokenSoFar = '';
  const writeReal = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    spokenSoFar += String(chunk);
    return writeReal(chunk, ...rest);
  };

  try {
    // the allocation an unhooked consumer makes — which is what fires the gate
    genTempDir({ slug: 'acc-gate-down' });

    // wait exactly as long as it takes, and no longer
    const until = Date.now() + 10000;
    while (!spokenSoFar.includes('age gate failed to run') && Date.now() < until)
      await new Promise((wake) => setTimeout(wake, 10));

    // .why = a timer that merely EXPIRED would let the case pass a truncated
    //        stderr to the parent, where it reads as a product defect. an
    //        exhausted probe is a fixture failure and must name itself as one
    if (!spokenSoFar.includes('age gate failed to run'))
      throw new Error(
        'the age gate spoke no word within 10s — the fixture, not the product',
      );
  } finally {
    process.stderr.write = writeReal;
    fs.chmodSync(pathPhysical, 0o700);
  }

  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ sealHolds, pathPhysical }));
})();
`,
              ],
              {
                // 🔴 the throwaway repo, NOT this one — the whole isolation
                cwd: repoThrowaway,
                encoding: 'utf8',
                env: genChildEnvFresh(),
              },
            );

            const at = child.stdout.indexOf(VERDICT_TOKEN);
            if (at === -1)
              throw new Error(
                `the child rendered no verdict. status: ${child.status}, stderr: ${child.stderr}`,
              );
            const scene: { sealHolds: boolean; pathPhysical: string } =
              JSON.parse(child.stdout.slice(at + VERDICT_TOKEN.length));
            rootChild = scene.pathPhysical;

            return {
              sealHolds: scene.sealHolds,
              status: child.status ?? -1,
              spokenStable: asStrerrorMasked(child.stderr)
                .split(scene.pathPhysical)
                .join('<tmpDir>')
                .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
                .replace(/\br[a-f0-9]{8}\b/g, '<run>'),
            };
          } finally {
            // the throwaway root AND the throwaway repo. the root is removed HERE
            // rather than left to `reclaimReposThrowaway` because this is the one
            // case that seals it — an unremovable root must not outlive the case
            // that sealed it, whatever else happens
            if (rootChild)
              fs.rmSync(path.dirname(rootChild), {
                recursive: true,
                force: true,
              });
            reclaimReposThrowaway();
          }
        },
      );

      then('the seal held, so the case tests what it claims to', () => {
        // root ignores mode bits, so fail on the SETUP rather than on the product
        expect(outcome.sealHolds).toEqual(true);
      });

      then('🔴 the gate said IT was down — at a real terminal', () => {
        expect(outcome.spokenStable).toContain('age gate failed to run');
        expect(outcome.spokenStable).toContain('<tmpDir>');
      });

      then('it named the CAUSE, so the reader knows it is permissions', () => {
        expect(outcome.spokenStable).toContain('EACCES');
      });

      then('and it named the FIX, not only the consequence', () => {
        // 🔴 this line read "temp dirs will accrue until this is repaired" for a
        // round — a consequence with no move attached, in the message for the
        // worst failure of all. the consequence survives on its own line because
        // the severity is real; the FIX is what makes it actionable
        expect(outcome.spokenStable).toContain('fix:');
        expect(outcome.spokenStable).toContain('restore access');
        expect(outcome.spokenStable).toContain('accrue');
      });

      then('it did NOT die — the allocation still succeeded', () => {
        // .why = the gate is a backstop. a consumer whose /tmp permissions moved
        //        must still be able to run their tests; they must simply be TOLD
        expect(outcome.status).toEqual(0);
      });

      then('and what a human reads is shaped as here', () => {
        expectNoVolatileBytes(outcome.spokenStable);
        expect(outcome.spokenStable).toMatchSnapshot();
      });
    });
  });

  /**
   * how many dirs each run of the friday walk allocates
   *
   * .why = 🔴 the vision's `case=11` stages 200 / 150 / 180 / 90 dirs across eleven
   *        simulated days, and those figures are NARRATIVE — the case file says so
   *        outright: *"sketch, not proof. the run ids and the counts are
   *        illustrative"*. to plant 200 here would set an INVENTED figure beside
   *        measured ones inside a snapshot a reviewer reads as product output,
   *        which is the exact shape the behavior's yield names as the way a false
   *        clamp spreads and hardens.
   *
   *        two is the smallest population that keeps every claim falsifiable: it
   *        renders a PLURAL count, so a reclaim that took one of two shows up in
   *        the render rather than on disk alone
   */
  const DIRS_PER_RUN = 2;

  /**
   * .what = counts the DIRS one run stamped, in one root
   * .why = the marker file `run.<id>.marker.json` also holds `.<id>.`, so a bare
   *        name filter counts it as a dir and every population reads one too high
   */
  const countDirsOfRun = (input: { root: string; run: string }): number =>
    fs
      .readdirSync(input.root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => entry.name.includes(`.${input.run}.`)).length;

  given(
    '[case17] five ownership classes in ONE room — the friday afternoon',
    () => {
      // 🔴 the catalog critipath `case=11`, which had no clamp of any kind. every
      // other case in this file puts ONE boundary in an empty room; the density
      // brief says defects cluster exactly where two boundaries meet, and this is
      // the only case that puts them in the same room at the same time.
      //
      // .scope = 🔴 the INTERACTION, never the theatre. the vision's walk is eight
      //      runs over eleven simulated days with 200/12/150/200/180/90 dirs, and
      //      it says of itself *"sketch, not proof … the counts are illustrative"*.
      //      what it ALONE adds over cases 1–16 is three claims about how the
      //      boundaries compose, and each is falsifiable at two dirs per run:
      //
      //        [t0] the arrears check discriminates by PROCESS LIVENESS, never by
      //             a clock — the vision's [t6], and the reason no age window can
      //             serve
      //        [t1] one residue earns exactly ONE report — the `reportedAt` bound,
      //             the vision's [t3] "D said no word"
      //        [t2] the age gate renders THREE verdicts in ONE pass — the
      //             vision's [t9]
      //
      //      the run counts are NOT reproduced. see `DIRS_PER_RUN`
      //
      // .note = every `when` gets a THROWAWAY ROOT of its own, by the same public
      //         derivation `[case16]` uses — a child whose cwd is a throwaway git
      //         repo derives a throwaway contained root. that is what makes "it
      //         named exactly one marker" and "the dir holds these three and no
      //         other" claims about a POPULATION this case owns, rather than about
      //         whatever the outer suite happened to leave beside it
      const envIsolated = (): NodeJS.ProcessEnv => ({
        // an inherited id would make each child read as ALREADY minted, and an
        // inherited sweep stamp would make its gate skip — the walk's whole cast
        // is runs that mint their own and sweep their own
        ...genChildEnvFresh(),
        [KEEP_ENV_KEY]: undefined,
        // the gate window is PINNED, never inherited — `[t2]` plants dirs against
        // it, so an ambient value would move the boundary the case measures
        [MAX_AGE_ENV_KEY]: String(MAX_AGE_MS_PINNED),
      });

      when(
        '[t0] a run is PRE-EMPTED beside a LIVE peer, their markers seconds apart',
        () => {
          // 🔴 the one assertion in the whole vision that an age-only rule fails.
          // `case=12` states the arrears check as *"bounded by a liveness window"*,
          // and this pair is where that mechanism breaks: BOTH markers are `open`,
          // BOTH are minutes old (seconds, here), and the next run owes one of them
          // a name and the other silence. no threshold passes between them.
          //
          // the vision reaches the state with a 12-minute-old corpse beside a
          // 14-minute-old live suite. PROXIMITY is what carries the claim, not the
          // twelve — so seconds apart is a STRICTER fixture than minutes apart, and
          // it costs the suite no wall clock at all
          const outcome = useThen(
            'the peer is minted and left alive, the other run is pre-empted, and a third run speaks',
            async (): Promise<{
              spokenStable: string;
              spokenPreStable: string;
              statusObserver: number;
              statePre: string;
              statePeer: string;
              reportedAtPre: string | null;
              reportedAtPeer: string | null;
              pidPreAlive: boolean;
              pidPeerAlive: boolean;
              gapMs: number;
              countDirsPre: number;
              countDirsPeer: number;
            }> => {
              const contract = getAllContractPaths();
              const repoThrowaway = genRepoThrowaway({ slug: 'friday-live' });
              const env = envIsolated();

              const peer = spawn(
                process.execPath,
                [
                  '-e',
                  `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();
  for (let i = 0; i < ${DIRS_PER_RUN}; i += 1)
    genTempDir({ slug: 'acc-friday-peer-' + i });
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run, pathPhysical }));

  // 🔴 it does NOT exit. a LIVE peer is a process that still ANSWERS, and that
  //    answer is the entire discriminator under clamp. the parent kills it in a
  //    finally, so a red assertion cannot strand it
  setInterval(() => undefined, 1000);
})();
`,
                ],
                {
                  cwd: repoThrowaway,
                  env,
                  stdio: ['ignore', 'pipe', 'pipe'],
                },
              );

              try {
                if (!peer.stdout || !peer.stderr)
                  throw new Error(
                    'the live peer exposed no pipes — the fixture, not the product',
                  );

                let spokenOutPeer = '';
                let spokenErrPeer = '';
                peer.stdout.setEncoding('utf8');
                peer.stdout.on('data', (chunk: string) => {
                  spokenOutPeer += chunk;
                });
                peer.stderr.setEncoding('utf8');
                peer.stderr.on('data', (chunk: string) => {
                  spokenErrPeer += chunk;
                });

                // 🔴 a READINESS PROBE on the peer's OWN verdict, never a sleep.
                //    the next run must not start until the peer's marker is on
                //    disk, and a fixed wait is a race in both directions — see
                //    `[case16]`, which settled this shape
                const until = Date.now() + 20000;
                while (
                  !spokenOutPeer.includes(VERDICT_TOKEN) &&
                  Date.now() < until
                )
                  await new Promise((wake) => setTimeout(wake, 10));
                if (!spokenOutPeer.includes(VERDICT_TOKEN))
                  throw new Error(
                    `the live peer never minted within 20s — the fixture, not the product. stderr: ${spokenErrPeer}`,
                  );

                const scenePeer: { run: string; pathPhysical: string } =
                  JSON.parse(
                    spokenOutPeer.slice(
                      spokenOutPeer.indexOf(VERDICT_TOKEN) +
                        VERDICT_TOKEN.length,
                    ),
                  );

                // 🔴 the peer starts FIRST, and the order carries weight. a peer
                // that started SECOND would meet the pre-empted marker at its own
                // setup, name it, and stamp it reported — and the observer below
                // would then have no word to say, for a reason unrelated to
                // liveness at all. the vision flags this exact trap
                const runPre = spawnSync(
                  process.execPath,
                  [
                    '-e',
                    `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();
  for (let i = 0; i < ${DIRS_PER_RUN}; i += 1)
    genTempDir({ slug: 'acc-friday-preempt-' + i });

  // NO teardown — the marker is left \`open\`, as a kernel pre-empt leaves it
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run, pathPhysical }));
})();
`,
                  ],
                  { cwd: repoThrowaway, encoding: 'utf8', env },
                );
                const atPre = runPre.stdout.indexOf(VERDICT_TOKEN);
                if (atPre === -1)
                  throw new Error(
                    `the pre-empted run rendered no verdict. status: ${runPre.status}, stderr: ${runPre.stderr}`,
                  );
                const scenePre: { run: string; pathPhysical: string } =
                  JSON.parse(runPre.stdout.slice(atPre + VERDICT_TOKEN.length));

                // the OBSERVER — a third run whose setup fires the arrears check
                // over both markers at once. it allocates none, so the counts
                // below belong to the two runs under judgement and to no other
                const observer = spawnSync(
                  process.execPath,
                  [
                    '-e',
                    `
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run: process.env.TEST_FNS_RUN }));
})();
`,
                  ],
                  { cwd: repoThrowaway, encoding: 'utf8', env },
                );
                const atObs = observer.stdout.indexOf(VERDICT_TOKEN);
                if (atObs === -1)
                  throw new Error(
                    `the observer named no run. status: ${observer.status}, stderr: ${observer.stderr}`,
                  );
                const runIdObserver: string = JSON.parse(
                  observer.stdout.slice(atObs + VERDICT_TOKEN.length),
                ).run;

                // read BEFORE the kill — the peer's liveness is the fact under
                // clamp, so it must be sampled while the peer is still what the
                // case claims it is
                const markerPre = readRunMarker({
                  root: scenePre.pathPhysical,
                  run: scenePre.run,
                });
                const markerPeer = readRunMarker({
                  root: scenePeer.pathPhysical,
                  run: scenePeer.run,
                });

                /**
                 * .what = masks one stderr of this scene, per segment
                 * .why = TWO runs speak here, and both are graded. a mask built
                 *        for one of them and re-typed for the other is how two
                 *        records of one scene drift apart
                 */
                const asStable = (text: string): string =>
                  asStrerrorMasked(text)
                    .split(scenePre.pathPhysical)
                    .join('<tmpDir>')
                    .split(scenePre.run)
                    .join('<runPre>')
                    .split(scenePeer.run)
                    .join('<runPeer>')
                    .split(runIdObserver)
                    .join('<runObserver>')
                    .replace(/pid \d+/g, 'pid <pid>')
                    .replace(/began \d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'began <ts>')
                    .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
                    .replace(/\br[a-f0-9]{8}\b/g, '<run>')
                    .replace(/\.[a-f0-9]{8}(?=$|\D)/g, '.<hex>');

                return {
                  statusObserver: observer.status ?? -1,
                  statePre: markerPre.state,
                  statePeer: markerPeer.state,
                  reportedAtPre: markerPre.reportedAt,
                  reportedAtPeer: markerPeer.reportedAt,
                  pidPreAlive: isPidAlive({ pid: markerPre.pid }),
                  pidPeerAlive: isPidAlive({ pid: markerPeer.pid }),
                  gapMs: Math.abs(
                    Date.parse(markerPre.startedAt) -
                      Date.parse(markerPeer.startedAt),
                  ),
                  countDirsPre: countDirsOfRun({
                    root: scenePre.pathPhysical,
                    run: scenePre.run,
                  }),
                  countDirsPeer: countDirsOfRun({
                    root: scenePeer.pathPhysical,
                    run: scenePeer.run,
                  }),
                  spokenStable: asStable(observer.stderr),
                  // 🔴 the PRE-EMPTED run's own setup, graded too — and it is the
                  // purer statement of the claim. at the instant it fires, the
                  // ONLY marker on disk is the live peer's: open, unreported,
                  // seconds old. every term of the arrears predicate but liveness
                  // says NAME IT, so its silence has exactly one possible cause
                  spokenPreStable: asStable(runPre.stderr),
                };
              } finally {
                // 🔴 the peer is killed here and NOWHERE else. a live child that
                // outlived a red assertion would hold the runner open and keep a
                // marker alive that the next invocation would then judge
                peer.kill('SIGKILL');
                // this walk leaves residue ON PURPOSE — a pre-empted run and a
                // killed peer — so it owes its own reclaim. the throwaway scope
                // root takes all of it at once
                reclaimReposThrowaway();
              }
            },
          );

          then(
            'guard the guard: BOTH markers are open, and SECONDS apart — no age can sort them',
            () => {
              // .why = the claim is their PROXIMITY, and it needs no threshold to
              //        state. an implementation bounded by any liveness window
              //        either names both of these or names neither, so this pair
              //        is what makes the two `then`s below mean anything at all
              expect(outcome.statePre).toEqual('open');
              expect(outcome.statePeer).toEqual('open');
              expect(outcome.gapMs).toBeLessThan(60_000);

              // and neither had been reported by anyone before the observer ran,
              // so the `reportedAt` term cannot be what sorts them here
              expect(outcome.reportedAtPeer).toEqual(null);
            },
          );

          then('🔴 it named the PRE-EMPTED run — whose process is GONE', () => {
            expect(outcome.pidPreAlive).toEqual(false);
            expect(outcome.spokenStable).toContain('<runPre>');
            expect(outcome.spokenStable).toContain('never reclaimed');
            expect(outcome.spokenStable).toContain('its teardown never ran');
            // the SCALE, so a human learns the size of what was left
            expect(outcome.spokenStable).toContain(
              `${DIRS_PER_RUN} temp dirs still on disk`,
            );
          });

          then(
            '🔴 and it said NO word about the LIVE peer, whose process still answers',
            () => {
              // 🔴 the single assertion that separates *a teardown that failed*
              // from *a run still at work*, and the only one in the vision that an
              // age-only rule fails. the peer's marker is open, unreported, and
              // seconds old — every term but liveness says NAME IT
              expect(outcome.pidPeerAlive).toEqual(true);
              expect(outcome.spokenStable).not.toContain('<runPeer>');

              // 🔴 and the PRE-EMPTED run's own setup, which is the cleanest
              // vantage there is: when it fired, the peer's marker was the only
              // one on disk and it was open, unreported and seconds old. so this
              // silence is caused by liveness or by no term at all — an
              // age-bounded check, or one that answered "gone" for every pid,
              // reddens right here
              expect(outcome.spokenPreStable).not.toContain('<runPeer>');
              expect(outcome.spokenPreStable).toEqual('');

              // .why = the mask is proven to LAND by the positive above, so this
              //        negative is not the free pass a negative usually is: were
              //        `<runPeer>` a token that never substitutes, `<runPre>`
              //        would not substitute either and the previous `then` is red
              //
              //        and ONE marker was named, never "at least one" — the report
              //        renders exactly one `run:` row per casualty
              expect(
                outcome.spokenStable.split('   ├─ run: ').length - 1,
              ).toEqual(1);
            },
          );

          then(
            '🔴 and it reaped not one dir — the check reports, it never reaps',
            () => {
              // .why = `case=4` forbids a reap by liveness guess. a liveness signal
              //        may decide what to REPORT and may never decide what to
              //        REMOVE, and that division of powers is what entitles this
              //        check to ask the question at all
              expect(outcome.countDirsPre).toEqual(DIRS_PER_RUN);
              expect(outcome.countDirsPeer).toEqual(DIRS_PER_RUN);
            },
          );

          then('it did NOT die — to report arrears is never a gate', () => {
            expect(outcome.statusObserver).toEqual(0);
          });

          then('and what a human reads is shaped as here', () => {
            expectNoVolatileBytes(outcome.spokenStable);
            expect(outcome.spokenStable).toMatchSnapshot();
          });
        },
      );

      when('[t1] one residue, and two later runs that meet it in turn', () => {
        // 🔴 the `reportedAt` bound, which no sterile demo can reach. the first two
        // terms of the arrears predicate — unsettled AND process gone — hold
        // CONTINUOUSLY for as long as the residue does, so a predicate with only
        // those two names the same casualty on every later run, forever.
        //
        // `case=12`'s own timeline carries a residue past exactly ONE later run,
        // where a bounded predicate and an unbounded one behave identically. only a
        // walk that carries one residue past a SECOND run tells them apart, and
        // that is the whole reason this composite exists
        const outcome = useThen(
          'a pre-empted run is met by a first run, then by a later clean one',
          (): {
            spokenFirst: string;
            spokenLater: string;
            statusFirst: number;
            statusLater: number;
            stateResidue: string;
            reportedAtAfterFirst: string | null;
            reportedAtAfterLater: string | null;
            pidResidueAlive: boolean;
            countDirsResidue: number;
          } => {
            const contract = getAllContractPaths();
            const repoThrowaway = genRepoThrowaway({ slug: 'friday-once' });
            const env = envIsolated();

            try {
              // the RESIDUE — a run pre-empted with its marker left `open`
              const runResidue = spawnSync(
                process.execPath,
                [
                  '-e',
                  `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();
  for (let i = 0; i < ${DIRS_PER_RUN}; i += 1)
    genTempDir({ slug: 'acc-friday-residue-' + i });
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run, pathPhysical }));
})();
`,
                ],
                { cwd: repoThrowaway, encoding: 'utf8', env },
              );
              const atR = runResidue.stdout.indexOf(VERDICT_TOKEN);
              if (atR === -1)
                throw new Error(
                  `the pre-empted run rendered no verdict. status: ${runResidue.status}, stderr: ${runResidue.stderr}`,
                );
              const scene: { run: string; pathPhysical: string } = JSON.parse(
                runResidue.stdout.slice(atR + VERDICT_TOKEN.length),
              );

              /**
               * .what = drives one CLEAN run — setup, an optional allocation, then
               *         its own teardown — and hands back what it spoke
               * .why = 🔴 both later runs must SETTLE their own markers, or the
               *        second of them would meet the FIRST one's open marker and
               *        name that instead. a walk whose own actors accrue arrears
               *        cannot say which silence it measured
               */
              const driveRunClean = (input: {
                slug: string;
                dirsToAllocate: number;
              }): { spoken: string; status: number } => {
                const child = spawnSync(
                  process.execPath,
                  [
                    '-e',
                    `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
const teardownHook = require(${JSON.stringify(contract.teardownJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  for (let i = 0; i < ${input.dirsToAllocate}; i += 1)
    genTempDir({ slug: ${JSON.stringify(input.slug)} + '-' + i });
  await teardownHook();
  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({ run: process.env.TEST_FNS_RUN }));
})();
`,
                  ],
                  { cwd: repoThrowaway, encoding: 'utf8', env },
                );
                if (child.stdout.indexOf(VERDICT_TOKEN) === -1)
                  throw new Error(
                    `a clean run rendered no verdict. status: ${child.status}, stderr: ${child.stderr}`,
                  );
                return { spoken: child.stderr, status: child.status ?? -1 };
              };

              // the FIRST run to see the residue — it must name it, once
              const runFirst = driveRunClean({
                slug: 'acc-friday-first',
                dirsToAllocate: 0,
              });
              const reportedAtAfterFirst = readRunMarker({
                root: scene.pathPhysical,
                run: scene.run,
              }).reportedAt;

              // a LATER clean run, whose own teardown fires — it must say no word
              const runLater = driveRunClean({
                slug: 'acc-friday-later',
                dirsToAllocate: DIRS_PER_RUN,
              });
              const markerAfterLater = readRunMarker({
                root: scene.pathPhysical,
                run: scene.run,
              });

              const asStable = (text: string): string =>
                asStrerrorMasked(text)
                  .split(scene.pathPhysical)
                  .join('<tmpDir>')
                  .split(scene.run)
                  .join('<runResidue>')
                  .replace(/pid \d+/g, 'pid <pid>')
                  .replace(/began \d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'began <ts>')
                  .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
                  .replace(/\br[a-f0-9]{8}\b/g, '<run>')
                  .replace(/\.[a-f0-9]{8}(?=$|\D)/g, '.<hex>');

              return {
                spokenFirst: asStable(runFirst.spoken),
                spokenLater: asStable(runLater.spoken),
                statusFirst: runFirst.status,
                statusLater: runLater.status,
                stateResidue: markerAfterLater.state,
                reportedAtAfterFirst,
                reportedAtAfterLater: markerAfterLater.reportedAt,
                pidResidueAlive: isPidAlive({ pid: markerAfterLater.pid }),
                countDirsResidue: countDirsOfRun({
                  root: scene.pathPhysical,
                  run: scene.run,
                }),
              };
            } finally {
              reclaimReposThrowaway();
            }
          },
        );

        then(
          'guard the guard: the residue is arrears STILL — unsettled, and its process gone',
          () => {
            // 🔴 the two terms that make the silence below a real claim. were the
            // marker settled, or its pid alive, the later run would be silent for
            // a reason unrelated to the bound under clamp — and this case would
            // pass against an implementation with no bound at all
            expect(outcome.stateResidue).toEqual('open');
            expect(outcome.pidResidueAlive).toEqual(false);
          },
        );

        then(
          '🔴 the FIRST run to see it named it — and STAMPED the marker reported',
          () => {
            expect(outcome.spokenFirst).toContain('<runResidue>');
            expect(outcome.spokenFirst).toContain('never reclaimed');
            // reported is not settled: the state stays `open`, and only the stamp
            // moved. that pair is what the bound is made of
            expect(outcome.reportedAtAfterFirst).not.toEqual(null);
          },
        );

        then(
          '🔴 and the LATER clean run said NO word about it — the reportedAt bound',
          () => {
            // 🔴 the assertion this `when` exists for. every other term of the
            // predicate still holds — open, gone, residue on disk — so an
            // implementation with no `reportedAt` term names it here and this is
            // red. a condition that never lapses is not a bound
            expect(outcome.spokenLater).not.toContain('<runResidue>');
            expect(outcome.spokenLater).not.toContain('never reclaimed');
            expect(outcome.spokenLater).toEqual('');

            // and the stamp did not move a second time — one residue, one report
            expect(outcome.reportedAtAfterLater).toEqual(
              outcome.reportedAtAfterFirst,
            );
          },
        );

        then("and no later run reaped it either — it is the gate's", () => {
          // the residue is minutes old and the window is a day, so the age gate
          // correctly spares it too. it survives BOTH sweeps, for two reasons
          expect(outcome.countDirsResidue).toEqual(DIRS_PER_RUN);
        });

        then('neither later run died', () => {
          expect(outcome.statusFirst).toEqual(0);
          expect(outcome.statusLater).toEqual(0);
        });

        then('and what the FIRST run leaves a human is shaped as here', () => {
          expectNoVolatileBytes(outcome.spokenFirst);
          expect(outcome.spokenFirst).toMatchSnapshot();
        });

        then(
          'and what the LATER run leaves a human is shaped as here — the silence, on the record',
          () => {
            // .why = an empty record looks like an absent one, and it is neither.
            //        it is the RENDER of a run that met a known residue and chose
            //        to say no word — so a change that made a later run speak
            //        again lands as a diff here rather than as a judgement call
            //        somewhere downstream
            //
            // .note = 🔴 KEYED, never a bare `""`. a bare empty export is
            //         indistinguishable from a snapshot of a render that never
            //         happened — the objection `[case14]` states in full, and
            //         answers with a keyed shape rather than with omission. this
            //         is the site `[case14]`'s note CITES as its precedent, and
            //         it was the one site that had not adopted the answer.
            //
            //         the three companions are the OTHER terms of the arrears
            //         predicate, and they are what make the silence a claim: an
            //         empty `spoken` beside `open`, a dead pid, and residue still
            //         on disk is a run that COULD have named it and chose not to.
            //         silence beside a settled marker or a live pid would be
            //         silence for an unrelated reason, which no `""` could tell
            //         apart (`[caseZ]` — repair the family, never the quoted site)
            expectNoVolatileBytes(outcome.spokenLater);
            expect({
              spoken: outcome.spokenLater,
              stateResidue: outcome.stateResidue,
              pidResidueAlive: outcome.pidResidueAlive,
              countDirsResidue: outcome.countDirsResidue,
              reportedAtMoved:
                outcome.reportedAtAfterLater !== outcome.reportedAtAfterFirst,
            }).toMatchSnapshot();
          },
        );
      });

      when('[t2] one age-gate pass, THREE verdicts over one dir', () => {
        // 🔴 the vision's [t9]. a sweep that collapses any two of the three
        // verdicts loses a population, deletes a stranger's data, or reaps by
        // *"looks abandoned"* — which is `case=4`'s forbidden liveness probe under
        // another name. `[case11]` drives the gate against ONE aged dir and one
        // unreadable name; it can say what the gate reports and cannot say what
        // the gate DECLINED to report, because it plants no dir the gate spares
        //
        // .the three, in one pass over one dir:
        //   take           — aged, unowned, removable
        //   spare + count  — aged, unowned, and REFUSED (the seal trick)
        //   spare, silent  — readable and not yet aged
        //
        // .note = a dir's age is read from the TIMESTAMP IN ITS NAME
        //         (`computeStaleDirs` → `asTempDirTimestamp`), never from an mtime.
        //         so each plant is aged by the name it is given, and `utimes` would
        //         move no fact the gate reads
        const outcome = useThen(
          'the gate meets one aged dir, one sealed dir, and one fresh dir',
          (): {
            spokenStable: string;
            sealHolds: boolean;
            status: number;
            existedBefore: { taken: boolean; sealed: boolean; fresh: boolean };
            existsAfter: { taken: boolean; sealed: boolean; fresh: boolean };
            countOursMade: number;
            countOursLeft: number;
          } => {
            const contract = getAllContractPaths();
            const repoThrowaway = genRepoThrowaway({ slug: 'friday-gate' });

            let pathSealed: string | null = null;
            try {
              const child = spawnSync(
                process.execPath,
                [
                  '-e',
                  `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
const teardownHook = require(${JSON.stringify(contract.teardownJest)}).default;

// the root, WITHOUT a mint — so the plants land where a real gate pass looks
const { pathPhysical } = getOneTempDirRoot();
fs.mkdirSync(pathPhysical, { recursive: true });

const stampAt = (msAgo) =>
  new Date(Date.now() - msAgo).toISOString().replace(/:/g, '-');
const AGED = 48 * 60 * 60 * 1000;

// 1 — TAKE: aged, readable, and no entry within it resists removal
const dirTaken = path.join(pathPhysical, stampAt(AGED) + '.acc-friday-taken.a1b2c3d4');
fs.mkdirSync(dirTaken, { recursive: true });
fs.writeFileSync(path.join(dirTaken, 'fixture.txt'), 'x', 'utf8');

// 2 — SPARE AND COUNT: aged and readable too, but its removal is REFUSED
const dirSealed = path.join(pathPhysical, stampAt(AGED) + '.acc-friday-sealed.b2c3d4e5');
const sealed = path.join(dirSealed, 'sealed');
fs.mkdirSync(sealed, { recursive: true });
fs.writeFileSync(path.join(sealed, 'child.txt'), 'x', 'utf8');
fs.chmodSync(sealed, 0o500);

// 3 — SPARE SILENTLY: readable, and not yet aged
const dirFresh = path.join(pathPhysical, stampAt(0) + '.acc-friday-fresh.c3d4e5f6');
fs.mkdirSync(dirFresh, { recursive: true });

const sealHolds = (() => {
  try {
    fs.rmSync(path.join(sealed, 'child.txt'));
    return false;
  } catch (thrown) {
    return true;
  }
})();

const existedBefore = {
  taken: fs.existsSync(dirTaken),
  sealed: fs.existsSync(dirSealed),
  fresh: fs.existsSync(dirFresh),
};

(async () => {
  let countOursMade = -1;
  let countOursLeft = -1;
  try {
    // ONE pass — the gate rides the setup scan, so all three verdicts issue here
    await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
    const run = process.env.TEST_FNS_RUN;

    // this run allocates too, so the reclaim below fires in a CROWDED dir rather
    // than an empty one — which is where a seen-based invariant misfires
    genTempDir({ slug: 'acc-friday-own' });
    countOursMade = countOurs(pathPhysical, run);

    await teardownHook();
    countOursLeft = countOurs(pathPhysical, run);
  } finally {
    fs.chmodSync(sealed, 0o700);
  }

  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({
    sealHolds,
    pathPhysical,
    sealed,
    existedBefore,
    countOursMade,
    countOursLeft,
    existsAfter: {
      taken: fs.existsSync(dirTaken),
      sealed: fs.existsSync(dirSealed),
      fresh: fs.existsSync(dirFresh),
    },
  }));
})();
`,
                ],
                {
                  cwd: repoThrowaway,
                  encoding: 'utf8',
                  env: envIsolated(),
                },
              );

              const at = child.stdout.indexOf(VERDICT_TOKEN);
              if (at === -1)
                throw new Error(
                  `the child rendered no verdict. status: ${child.status}, stderr: ${child.stderr}`,
                );
              const scene: {
                sealHolds: boolean;
                pathPhysical: string;
                sealed: string;
                existedBefore: {
                  taken: boolean;
                  sealed: boolean;
                  fresh: boolean;
                };
                countOursMade: number;
                countOursLeft: number;
                existsAfter: {
                  taken: boolean;
                  sealed: boolean;
                  fresh: boolean;
                };
              } = JSON.parse(child.stdout.slice(at + VERDICT_TOKEN.length));
              pathSealed = scene.sealed;

              return {
                sealHolds: scene.sealHolds,
                status: child.status ?? -1,
                existedBefore: scene.existedBefore,
                existsAfter: scene.existsAfter,
                countOursMade: scene.countOursMade,
                countOursLeft: scene.countOursLeft,
                spokenStable: asStrerrorMasked(child.stderr)
                  .split(scene.pathPhysical)
                  .join('<tmpDir>')
                  .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
                  .replace(/\br[a-f0-9]{8}\b/g, '<run>')
                  .replace(/\.[a-f0-9]{8}(?=$|\D)/g, '.<hex>'),
              };
            } finally {
              // 🔴 the unseal is repeated HERE, in the parent, and it is not
              // redundant: a child that died before its own `finally` would leave
              // a dir whose removal is refused, and the scope-root reclaim below
              // would then throw EACCES over the top of the real cause
              if (pathSealed && fs.existsSync(pathSealed))
                fs.chmodSync(pathSealed, 0o700);
              reclaimReposThrowaway();
            }
          },
        );

        then(
          'guard the guard: the seal held, and all three dirs were on disk before the pass',
          () => {
            // root ignores mode bits, so fail on the SETUP rather than the product
            expect(outcome.sealHolds).toEqual(true);
            expect(outcome.existedBefore).toEqual({
              taken: true,
              sealed: true,
              fresh: true,
            });
          },
        );

        then('🔴 verdict one — it TOOK the aged dir it could take', () => {
          expect(outcome.existsAfter.taken).toEqual(false);
          // and a dir it took is not a find: a report that named every reclaim
          // would drown the one entry a human must act on
          expect(outcome.spokenStable).not.toContain('acc-friday-taken');
        });

        then(
          '🔴 verdict two — it SPARED the dir it could not remove, and COUNTED it aloud',
          () => {
            expect(outcome.existsAfter.sealed).toEqual(true);
            expect(outcome.spokenStable).toContain(
              'the temp-dir age gate could not reclaim',
            );
            expect(outcome.spokenStable).toContain('EACCES');
            expect(outcome.spokenStable).toContain('acc-friday-sealed');
          },
        );

        then(
          '🔴 verdict three — it SPARED the fresh dir in SILENCE, and asked no more than its age',
          () => {
            // 🔴 the verdict `[case11]` cannot reach, because it plants no dir the
            // gate spares. a gate that reached past "not yet aged" for "looks
            // abandoned" is `case=4`'s forbidden probe under another name — and a
            // gate that took this dir would take a LIVE peer's fixtures too, since
            // the two are spared by the identical predicate
            expect(outcome.existsAfter.fresh).toEqual(true);
            expect(outcome.spokenStable).not.toContain('acc-friday-fresh');
          },
        );

        then('🔴 and all three verdicts issued from ONE pass', () => {
          // .why = the three are asserted separately above, and separate assertions
          //        cannot say they came from one sweep — three passes with one
          //        verdict each would satisfy every line of them. exactly one gate
          //        report was rendered, so exactly one gate pass rendered it
          expect(
            outcome.spokenStable.split(
              'the temp-dir age gate could not reclaim',
            ).length - 1,
          ).toEqual(1);

          // and the pass reads as distinct finds rather than one run-on block —
          // the seam `sayReport` exists to keep
          expect(outcome.spokenStable).not.toContain('\n\n\n');
        });

        then(
          "🔴 and the run reclaimed exactly its OWN, in a dir full of others'",
          () => {
            // 🔴 the vision's second interaction: an implementation that filtered
            // *"dirs older than my run's start"* passes every sterile case and
            // reaps this whole room. and `case=10`'s broken-chain invariant must
            // NOT fire here — it asks whether a FRESH, UNSTAMPED entry exists, so
            // an implementation that reasoned *"I matched far fewer than I saw"*
            // would throw on every crowded dir, which is the ordinary case
            expect(outcome.countOursMade).toEqual(1);
            expect(outcome.countOursLeft).toEqual(0);
            expect(outcome.spokenStable).not.toContain('💥');
          },
        );

        then(
          'it did NOT die — the gate is a backstop, never a gate on the run',
          () => {
            expect(outcome.status).toEqual(0);
          },
        );

        then('and what a human reads is shaped as here', () => {
          expectNoVolatileBytes(outcome.spokenStable);
          expect(outcome.spokenStable).toMatchSnapshot();
        });
      });
    },
  );

  given(
    '[case18] an adopter RETIRES the teardown they hand-rolled, and loses no guarantee',
    () => {
      // 🔴 the catalog critipath `case=13`, and **the wish's own acceptance signal
      // for the choice of repo**: *"downstream should end with NO temp-dir prune,
      // registry, or teardown of its own. if a consumer still holds prune
      // machinery once this lands, the fix landed in the wrong repo."*
      //
      // it was graded ⚠️ composite — a deletion in the diff, 64 green tests, and
      // an acid test run by hand. **not one automated assertion**, and a deletion
      // is the one kind of evidence that cannot be re-run.
      //
      // .scope = the claim is COMPARATIVE and it needs three arms, since any two
      //      of them admit a reading that is not the claim:
      //
      //        [t0] hand-roll PRESENT, hooks wired   → 0 left
      //        [t1] hand-roll RETIRED, hooks wired   → 0 left   ← the retire is safe
      //        [t2] hand-roll RETIRED, hooks ABSENT  → LEAKS    ← so it was the HOOKS
      //
      //      without the third, the second's zero has another explanation — some
      //      other mechanism, an empty workload, a mis-aimed count — and the
      //      journey would pass against a build whose hooks did no work at all
      const runArm = (input: {
        slug: string;
        handRolled: boolean;
        hooked: boolean;
      }): { countMade: number; countLeft: number; run: string } => {
        const contract = getAllContractPaths();
        const repoThrowaway = genRepoThrowaway({ slug: input.slug });

        // the machinery an adopter hand-rolls where this behavior is absent — the
        // exact shape `genTempDir.acceptance.jest.test.ts` would carry unhooked
        const handRolledTeardown = input.handRolled
          ? `
  for (const dir of dirsTracked) fs.rmSync(dir, { recursive: true, force: true });
`
          : '';

        const child = spawnSync(
          process.execPath,
          [
            '-e',
            `
${genChildPrelude({ contract })}
const setupHook = require(${JSON.stringify(contract.setupJest)}).default;
const teardownHook = require(${JSON.stringify(contract.teardownJest)}).default;
(async () => {
  await setupHook({ globalTeardown: ${JSON.stringify(TEARDOWN_SLOT_WIRED)} });
  const run = process.env.TEST_FNS_RUN;
  const { pathPhysical } = getOneTempDirRoot();

  // the adopter's own suite body — identical in all three arms, so the only
  // thing that varies is WHO is expected to reclaim
  const dirsTracked = [];
  for (let i = 0; i < 3; i += 1)
    dirsTracked.push(genTempDir({ slug: 'adopter-' + i }));
  const countMade = countOurs(pathPhysical, run);
${handRolledTeardown}
  ${input.hooked ? 'await teardownHook();' : '// the hook is NOT wired — this arm must leak'}

  console.log(${JSON.stringify(VERDICT_TOKEN)} + JSON.stringify({
    run, countMade, countLeft: countOurs(pathPhysical, run),
  }));
})();
`,
          ],
          {
            cwd: repoThrowaway,
            encoding: 'utf8',
            env: {
              ...genChildEnvFresh(),
              [KEEP_ENV_KEY]: undefined,
            },
          },
        );

        const at = child.stdout.indexOf(VERDICT_TOKEN);
        if (at === -1)
          throw new Error(
            `arm ${input.slug} rendered no verdict. status: ${child.status}, stderr: ${child.stderr}`,
          );
        const parsed: { run: string; countMade: number; countLeft: number } =
          JSON.parse(child.stdout.slice(at + VERDICT_TOKEN.length));
        return parsed;
      };

      when('[t0] the three arms are driven', () => {
        const outcome = useThen('each renders its verdict', () => {
          try {
            return {
              withHandRoll: runArm({
                slug: 'adopt-before',
                handRolled: true,
                hooked: true,
              }),
              retired: runArm({
                slug: 'adopt-after',
                handRolled: false,
                hooked: true,
              }),
              retiredUnhooked: runArm({
                slug: 'adopt-unhooked',
                handRolled: false,
                hooked: false,
              }),
            };
          } finally {
            reclaimReposThrowaway();
          }
        });

        then(
          'guard the guard: all three arms did the same work — 3 dirs each',
          () => {
            // without this, a zero could mean *the reclaim worked* or *no dir was
            // ever made*, and the two are indistinguishable from the count alone
            expect(outcome.withHandRoll.countMade).toEqual(3);
            expect(outcome.retired.countMade).toEqual(3);
            expect(outcome.retiredUnhooked.countMade).toEqual(3);
          },
        );

        then('🔴 with the hand-rolled teardown present — none left', () => {
          expect(outcome.withHandRoll.countLeft).toEqual(0);
        });

        then('🔴 with it RETIRED — still none left. the retire is safe', () => {
          // the wish's acceptance signal, as one assertion: an adopter deletes
          // their prune machinery and loses no guarantee
          expect(outcome.retired.countLeft).toEqual(0);
          expect(outcome.retired.countLeft).toEqual(
            outcome.withHandRoll.countLeft,
          );
        });

        then(
          '🔴 and with it retired while the hook is ABSENT — it LEAKS all three',
          () => {
            // 🔴 the arm that makes the two zeros above mean something. it is
            // the adopter's real hazard too: delete the hand-roll, miss one of
            // the ten config lines, and every dir survives under a green suite
            expect(outcome.retiredUnhooked.countLeft).toEqual(3);
          },
        );

        then('and the three verdicts read as here', () => {
          // .note = 🔴 one noun phrase, and EVERY state token in caps. the three
          //         keys are a parallel three-arm comparison, so any difference
          //         between them that is not a difference in STATE is noise a
          //         reader must first discount — and this file uses caps to mark
          //         the condition under test (`PRE-EMPTED`, `ABSENT`, `TORN`), so
          //         a lowercase state beside an upper one reads as significant
          //         when it is not.
          //
          //         caps on all four tokens rather than on the notable ones: a
          //         reader who must ask *"why is ABSENT shouted and wired not?"*
          //         asks the same question as *"why is one RETIRED shouted?"* —
          //         moved, never answered. uniform caps carries no differential
          //         sense at all, so the difference does not EXIST rather than
          //         earn an explanation (`rule.prefer.prevent-over-correct`)
          expect({
            'hand-roll PRESENT, hooks WIRED': {
              made: outcome.withHandRoll.countMade,
              left: outcome.withHandRoll.countLeft,
            },
            'hand-roll RETIRED, hooks WIRED': {
              made: outcome.retired.countMade,
              left: outcome.retired.countLeft,
            },
            'hand-roll RETIRED, hooks ABSENT': {
              made: outcome.retiredUnhooked.countMade,
              left: outcome.retiredUnhooked.countLeft,
            },
          }).toMatchSnapshot();
        });
      });
    },
  );
});
