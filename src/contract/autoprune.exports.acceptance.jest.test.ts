/**
 * .what = clamps the SEAM a consumer actually crosses: the three lines they paste
 *         into a runner config, and whether those lines lead to a module whose
 *         shape the runner can call
 * .why = 🔴 a YAGNI pass found the behavior's headline clamp (J1) states in its own
 *        `.why` that it *"requires from dist, so it exercises the compiled artifact
 *        a consumer installs"* — and then requires
 *        `dist/domain.operations/genTempDir/autoprune/setupAutoprune.js`, an
 *        INTERNAL module. `package.json` declares an `exports` map, and an exports
 *        map SEALS every subpath it does not list, so that is a path a real consumer
 *        cannot require at all. the clamp walked a road closed to the very people it
 *        claims to walk it for
 *
 * .note = so the whole of `package.json` `exports` → `dist/contract/*.js` was
 *         unclamped. drop a build step, mistype a subpath, or narrow `files`, and
 *         every consumer breaks on line ONE of their wire-up — while every test we
 *         own stays green, because our own configs point at `./src/contract/*.ts`
 *
 * .note = it is an ACCEPTANCE test because it reads `dist/`, which exists only after
 *         a build — and because a contract is the grain acceptance tests own
 *         (`rule.require.test-coverage-by-grain`)
 */
import { UnexpectedCodePathError } from 'helpful-errors';

import { given, then, when } from '@src/contract';
import { KEEP_ENV_KEY } from '@src/domain.operations/genTempDir/autoprune/teardownAutoprune';
// .note = the KEY, for the same reason the QUIET one below is imported rather than
//         copied: the child sets this variable to reach a refusal, so a rename of
//         the constant must move the child's set too, or the case goes green on a
//         path the product does not walk (rule.require.ubiqlang)
import {
  GATE_SWEPT_ENV_KEY,
  RUN_ID_ENV_KEY,
} from '@src/domain.operations/genTempDir/getOneRunId';
import {
  MAX_AGE_ENV_KEY,
  MAX_AGE_MS_DEFAULT,
} from '@src/domain.operations/genTempDir/pruneStale';
// .note = the KEY, never a hand-copied `'TEST_FNS_QUIET'` literal. a copy reads as
//         a phantom to a peer reviewer — a string with no visible reader — and a
//         rename of the constant leaves that copy to scrub, in silence, a key the
//         product does not read (rule.require.ubiqlang)
import { QUIET_ENV_KEY } from '@src/domain.operations/genTempDir/warnIfUnhooked';
import { getGitRoot } from '@src/infra/isomorph.fs/getGitRoot';

import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';

/** the three subpaths the readme, the jsdocs, and case=7's notice all tell a consumer to write */
const SUBPATHS_ADVERTISED: string[] = [
  './autoprune.setup.jest',
  './autoprune.teardown.jest',
  './autoprune.setup.vitest',
];

describe('autoprune exports (the consumer wire-up seam)', () => {
  const gitRoot = getGitRoot();

  /**
   * .what = reads this package's `exports` map and `files` list
   * .why = the clamp compares what we ADVERTISE against what we SHIP, so the
   *        manifest is FOREIGN input here — it is edited by hand, by a release
   *        tool, and by a template regenerator alike
   *
   * .note = 🔴 narrowed via `in`, never an as-cast. an `as never` read silences
   *         every shape question at once — so a manifest that lost its `exports`
   *         key would yield `undefined` and throw a bare TypeError from inside a
   *         helper, rather than name the one fact the clamp exists to check
   *         (rule.forbid.as-cast, rule.require.failfast)
   */
  const getOnePackageJson = (): {
    exports: Record<string, string>;
    files: string[];
  } => {
    const pathManifest = path.join(gitRoot, 'package.json');
    const parsed: unknown = JSON.parse(fs.readFileSync(pathManifest, 'utf8'));

    if (typeof parsed !== 'object' || parsed === null)
      throw new UnexpectedCodePathError('package.json is not an object', {
        pathManifest,
      });
    if (
      !('exports' in parsed) ||
      typeof parsed.exports !== 'object' ||
      parsed.exports === null
    )
      throw new UnexpectedCodePathError(
        'package.json declares no exports map',
        {
          pathManifest,
          hint: 'every advertised subpath is unreachable without one',
        },
      );
    if (!('files' in parsed) || !Array.isArray(parsed.files))
      throw new UnexpectedCodePathError('package.json declares no files list', {
        pathManifest,
        hint: 'the tarball would carry not one file we advertise',
      });

    return {
      exports: Object.fromEntries(
        Object.entries(parsed.exports).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      ),
      files: parsed.files.filter(
        (entry): entry is string => typeof entry === 'string',
      ),
    };
  };

  /**
   * .what = the dist file a subpath points at, as an absolute path
   * .why = an absent subpath must fail by NAME here, never by a `path.join` of
   *        `undefined` — the whole point of this clamp is to say WHICH line of a
   *        consumer's wire-up would break
   */
  const getOneTargetPath = (subpath: string): string => {
    const declared = getOnePackageJson().exports[subpath];
    if (declared === undefined)
      throw new UnexpectedCodePathError(
        'subpath is absent from the exports map',
        {
          subpath,
          hint: 'an exports map SEALS what it omits, so a consumer cannot require it',
        },
      );
    return path.join(gitRoot, declared);
  };

  given('[case1] the subpaths we tell every consumer to paste', () => {
    when('[t0] a consumer writes one into their runner config', () => {
      then('🔴 each is DECLARED in the exports map', () => {
        // .why = an exports map seals what it omits, so an unlisted subpath is not
        //        merely undocumented — it is unreachable, and the consumer's line
        //        throws ERR_PACKAGE_PATH_NOT_EXPORTED before our code ever loads
        const { exports: exportsMap } = getOnePackageJson();

        for (const subpath of SUBPATHS_ADVERTISED)
          expect(Object.keys(exportsMap)).toContain(subpath);
      });

      then('🔴 and the whole map a consumer meets is shaped as here', () => {
        // 🔴 this file is ACCEPTANCE grain over a contract and carried ZERO
        // snapshots — every claim proven by a `toContain` fragment. that is
        // functional verification and it is not observability, and
        // `rule.require.snapshots` is explicit that BOTH are owed
        //
        // .why an exports map most of all = it is the artifact where a SILENT
        //      DELETION is the defect. the loop above proves the three subpaths
        //      we knew to ask for are present; it says no word about a fourth
        //      that vanished, or a target quietly repointed at another file. a
        //      whole-map export makes both visible in a diff, which a fragment
        //      loop structurally cannot do
        //
        // .note = the values are relative paths fixed at author time, so this
        //         needs no mask — a repoint reads as a red diff, never as silence
        const { exports: exportsMap } = getOnePackageJson();
        expect(exportsMap).toMatchSnapshot();
      });

      then('🔴 and each points at a file the build actually emitted', () => {
        // .why = the map is a promise about the filesystem, and a promise about the
        //        filesystem that no one checks is how a build-config change ships a
        //        package whose every documented entry point is a 404
        for (const subpath of SUBPATHS_ADVERTISED)
          expect(fs.existsSync(getOneTargetPath(subpath))).toEqual(true);
      });

      then('and each emitted file rides inside a PUBLISHED directory', () => {
        // .why = `files` decides what the tarball carries. a target that exists on
        //        our disk and sits outside `files` is found here and 404s for
        //        everyone who installs us — the one break our own suite cannot see
        const { files } = getOnePackageJson();
        const roots = files.map((entry) => entry.replace(/^\//, ''));

        for (const subpath of SUBPATHS_ADVERTISED) {
          // .note = read through the guarded reader, never an index + a cast. an
          //         absent subpath is named by IT rather than silently read as ''
          const target = getOneTargetPath(subpath)
            .replace(gitRoot, '')
            .replace(/^\//, '');
          expect(roots.some((root) => target.startsWith(root))).toEqual(true);
        }
      });
    });
  });

  given('[case2] the module each subpath points at', () => {
    const requireFromHere = createRequire(__filename);

    /**
     * .what = loads a subpath's target the way the runner will, through the map
     * .why = `require` yields `any`, so the shape must be CHECKED at this boundary.
     *        a cast would let a module that exported a bare function read as a
     *        record, and every `toEqual('function')` below would grade `undefined`
     */
    const getOneModuleAt = (subpath: string): Record<string, unknown> => {
      const loaded: unknown = requireFromHere(getOneTargetPath(subpath));
      if (typeof loaded !== 'object' || loaded === null)
        throw new UnexpectedCodePathError('a hook module is not a namespace', {
          subpath,
          typeLoaded: typeof loaded,
          hint: 'a runner reads named exports off it, so it must be an object',
        });
      return { ...loaded };
    };

    when('[t0] JEST loads its two global hooks', () => {
      then('🔴 each exposes a DEFAULT export, which is what jest calls', () => {
        // .why = jest's contract for globalSetup/globalTeardown is a default-export
        //        function. defect 13 clamped the VITEST module's shape and stopped
        //        there — so the same structural claim went unchecked on the runner
        //        that needs TWO modules rather than one. *a module contract with two
        //        runners is half-clamped by a census that clamps one.*
        expect(typeof getOneModuleAt('./autoprune.setup.jest').default).toEqual(
          'function',
        );
        expect(
          typeof getOneModuleAt('./autoprune.teardown.jest').default,
        ).toEqual('function');
      });
    });

    when('[t1] VITEST loads its one global hook', () => {
      then('it exposes both halves, which is what vitest calls', () => {
        // .why = vitest takes ONE module and calls `setup` then `teardown` off it,
        //        which is the whole reason its config costs one key where jest costs
        //        two (vitest/dist/chunks/cli-api.BKg19Fvw.js:8480-8497)
        const adapter = getOneModuleAt('./autoprune.setup.vitest');

        expect(typeof adapter.setup).toEqual('function');
        expect(typeof adapter.teardown).toEqual('function');
      });
    });

    when('[t2] all three hook modules are read as ONE surface', () => {
      then('🔴 their shapes read as here', () => {
        // 🔴 the `typeof` claims above are FUNCTIONAL — they answer *"can the
        // runner call it?"* and say no word about the shape around the one key
        // each checks. so an export ADDED to a hook module, or the order of a
        // namespace REORDERED, passes every assertion in `[t0]`/`[t1]` and
        // reaches a consumer with no line in any diff to read it by.
        //
        // this is the module-grain twin of `[caseZ]`: a family graded per site
        // agrees with itself only by the author's memory, so the three modules
        // are snapped TOGETHER — a fourth hook added to two runners and not the
        // third is then a visible asymmetry rather than an absent test.
        //
        // 🔴 each module's shape is an ARRAY, never an object, and that is the
        // one detail this export turns on. jest's serializer SORTS object keys,
        // so an object-shaped export would grade the key SET and silently
        // re-hide the reorder — one of the exact two changes the reviewer named
        // as invisible today. an array is emitted in order, so it grades both.
        //
        // .note = I wrote the object form first, and its own export is what
        //         proved the claim false: the three subpaths came back
        //         alphabetized rather than in the order the call site listed
        //         them. *a clamp's first render is the cheapest place to learn
        //         that its promise does not hold.*
        //
        // .note = the OUTER object may sort freely — its keys are three fixed
        //         literals this call site owns, so their order carries no claim
        //         about the built artifact.
        //
        // .note = `__esModule` does not appear, and its absence is correct
        //         rather than a filter: tsc defines it via `defineProperty`, so
        //         it is non-enumerable and a spread omits it. what is snapped is
        //         the enumerable surface a runner destructures off — which is
        //         the surface this behavior's contract is stated in.
        // 🔴 .note = the map declares SIX subpaths and this export shapes THREE,
        //         and until now that subset was SILENT — a reader could not tell
        //         a deliberate bound from an oversight, and a SEVENTH subpath
        //         added tomorrow would join neither list nor any diff.
        //
        //         so the remainder is DERIVED from the map and carried in the
        //         record. it is not shaped in-process for a concrete reason:
        //         `getOneModuleAt` requires, and `./vitest.setup` assigns
        //         `globalThis.given/when/then` as its whole purpose — so a
        //         require here would overwrite this very suite's bdd globals.
        //         the two `slowtest.reporter.*` subpaths predate this behavior
        //         and belong to their own contract.
        //
        //         what the derivation BUYS is the part that matters: a new
        //         subpath lands in `subpathsOutsideThisClamp` and reddens this
        //         snapshot, so the next author meets the question rather than
        //         inherits the silence
        const asShapeOf = (subpath: string): string[] =>
          Object.entries(getOneModuleAt(subpath)).map(
            ([key, value]) => `${key}: ${typeof value}`,
          );

        const shaped = SUBPATHS_ADVERTISED;
        const subpathsOutsideThisClamp = Object.keys(
          getOnePackageJson().exports,
        )
          .filter((subpath) => !shaped.includes(subpath))
          .sort();

        expect({
          './autoprune.setup.jest': asShapeOf('./autoprune.setup.jest'),
          './autoprune.teardown.jest': asShapeOf('./autoprune.teardown.jest'),
          './autoprune.setup.vitest': asShapeOf('./autoprune.setup.vitest'),
          subpathsOutsideThisClamp,
        }).toMatchSnapshot();
      });
    });
  });

  given(
    '[case5] getOneTempDirRoot — the export the wish itself demanded',
    () => {
      // .why = 🔴 this is the SECOND half of the wish's ask (*"the contained temp
      //        path is exported, so a consumer derives it rather than hardcodes
      //        it"*), and its SHAPE was pinned by no snapshot at any grain. every
      //        clamp on it asserted properties — both views exist, they resolve to
      //        one place, a dir lands inside — and each of those survives the two
      //        changes that would actually break a consumer:
      //
      //          1. a key added, renamed, or dropped from the returned record
      //          2. the ROOT MOVING — which is #66's whole subject, since it
      //             re-keys the scope from the worktree to the git common dir
      //
      //        the second is the wish's own *"tie that bites"*: a consumer's count
      //        reads zero before and zero after when the root moves out from under
      //        it, and reads GREEN. a masked shape export makes that move a red
      //        diff (`rule.require.contract-snapshot-exhaustiveness`)

      /**
       * .what = a throwaway git repo, so the export DERIVES a root of its own
       * .why = the claim under clamp is *"a consumer derives it"*, and a call from
       *        OUR repo would derive OUR root — which exists already, so a
       *        derivation that silently fell back to a cached or hardcoded value
       *        would read as correct. an arbitrary repo has no root until the call
       *        makes one, so the findsert is exercised rather than assumed
       */
      const repoThrowawayRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'test-fns-exports-root-'),
      );
      execFileSync('git', ['init', '--quiet'], { cwd: repoThrowawayRoot });
      afterAll(() => {
        fs.rmSync(repoThrowawayRoot, { recursive: true, force: true });
        fs.rmSync(
          path.join('/tmp/test-fns', path.basename(repoThrowawayRoot)),
          {
            recursive: true,
            force: true,
          },
        );
      });

      when('[t0] a consumer calls it from the installed package', () => {
        /**
         * .what = the export's return, read through `dist/` and the exports map
         * .why = a consumer reaches it as `require('test-fns').getOneTempDirRoot`,
         *        with no types to catch a rename. so the clamp must cross the same
         *        seam — our own `import` would typecheck against source and prove
         *        the compiled surface no consumer-visible thing at all
         */
        const getOneRootFromDist = (): {
          pathPhysical: string;
          pathSymlink: string;
        } => {
          const child = spawnSync(
            process.execPath,
            [
              '-e',
              `
const api = require(${JSON.stringify(getOneTargetPath('.'))});
if (typeof api.getOneTempDirRoot !== 'function')
  throw new Error('getOneTempDirRoot is absent from the main export');
process.stdout.write(JSON.stringify(api.getOneTempDirRoot()));
`,
            ],
            { cwd: repoThrowawayRoot, encoding: 'utf8' },
          );
          if (child.status !== 0)
            throw new UnexpectedCodePathError(
              'the root-export child exited nonzero',
              {
                status: child.status,
                stderr: child.stderr,
                hint: 'run `npm run build` — this reads dist/, through the exports map',
              },
            );

          const parsed: unknown = JSON.parse(child.stdout);
          if (
            typeof parsed !== 'object' ||
            parsed === null ||
            !('pathPhysical' in parsed) ||
            !('pathSymlink' in parsed) ||
            typeof parsed.pathPhysical !== 'string' ||
            typeof parsed.pathSymlink !== 'string'
          )
            throw new UnexpectedCodePathError(
              'the export did not yield both views of the root',
              {
                parsed,
                hint: 'a consumer destructures { pathPhysical, pathSymlink } off it',
              },
            );
          return {
            pathPhysical: parsed.pathPhysical,
            pathSymlink: parsed.pathSymlink,
          };
        };

        then('🔴 and the SHAPE it yields reads as here', () => {
          // .note = the masks are PER SEGMENT, never one blanket normalizer, so the
          //         export still fails on a root that moved between scopes, lost a
          //         segment, or changed its kind. `<repo>` alone is masked, because
          //         it is the one part keyed on the machine — and it is exactly the
          //         part #66 will re-key, so the diff must show the shape AROUND it
          const root = getOneRootFromDist();
          const repo = path.basename(repoThrowawayRoot);

          // 🔴 the checkout root is masked by its ROLE, never by where it
          // happens to sit. this fixture mints its repo with `mkdtemp` under
          // the os temp dir, so a bare `os.tmpdir()` replace rendered the
          // checkout as `<tmp>` here while both twin snapshots render the
          // same field `<checkouts>` — one field, two vocabularies, and a
          // reader who compares the three had to derive the fixture
          // difference to reconcile them.
          //
          // .why role = it is this file's own mask principle, applied evenly:
          //      keep every structural segment, drop only the bytes that move
          //      per machine. `<checkouts>` names *the directory that holds
          //      the checkout* — a role both fixtures fill, at two different
          //      places. so the composite root is masked FIRST and WHOLE; the
          //      bare `os.tmpdir()` replace below then reaches only
          //      `pathPhysical`, whose `/tmp` is the os temp root in its
          //      os-temp-root role. one token, one sense, in both files
          const asStable = (one: string): string =>
            one
              .split(repoThrowawayRoot)
              .join(`<checkouts>${path.sep}<repo>`)
              .split(repo)
              .join('<repo>')
              .replace(os.tmpdir(), '<tmp>');

          expect({
            pathPhysical: asStable(root.pathPhysical),
            pathSymlink: asStable(root.pathSymlink),
          }).toMatchSnapshot();
        });

        then('🔴 and the two views are NOT interchangeable', () => {
          // .why = the export yields both rather than choose, because a consumer
          //        reasonably assumes either compares and they do not. that is the
          //        whole reason for the pair, and a shape export alone would not
          //        catch a build that collapsed them into one value
          const root = getOneRootFromDist();
          expect(root.pathPhysical).not.toEqual(root.pathSymlink);
        });

        then(
          '🔴 and OUTSIDE any git repo it REFUSES, rather than guess',
          () => {
            // 🔴 the boundary the positive path cannot show. the case above proves
            // derivation works where a repo EXISTS; the rubric's own note marks the
            // absent-repo variant as *"the one that will break in prod"*, and it
            // had no export.
            //
            // .note = 🔴 I wrote this case expecting the OPPOSITE contract. the
            //         comment here claimed the scope key is found by a walk UP the
            //         parent chain, so a consumer outside a checkout would silently
            //         receive an unrelated ANCESTOR repo's root — a fixture leak
            //         across scopes. **its own first render proved that false**: the
            //         export throws. so the behavior is the safer of the two, and
            //         this export exists to keep it that way — a later change that
            //         made the boundary "helpful" by a walk-up would redden here.
            //
            //         that is the second time on this branch a note asserted a
            //         property the code did not have, and the second time the
            //         export I added to check the note caught it. *a claim is worth
            //         what its clamp is worth.*
            //
            // .note = `os.tmpdir()` is the fixture: the one directory guaranteed to
            //         exist, be writable, and sit outside every checkout on any
            //         machine that runs this suite.
            const spoken = execFileSync(
              process.execPath,
              [
                '-e',
                `
const { createRequire } = require('module');
const req = createRequire(${JSON.stringify(path.join(gitRoot, 'x.js'))});
const { getOneTempDirRoot } = req('test-fns');
try {
  getOneTempDirRoot();
  console.log('NO_THROW: it yielded a root outside a repo');
} catch (thrown) {
  console.log(thrown.message);
}
`,
              ],
              // the child runs from a directory that is NOT a checkout
              { cwd: os.tmpdir(), encoding: 'utf8', stdio: 'pipe' },
            );

            // the guard's guard: a silent walk-up would print NO_THROW and the
            // export below would seal the fixture leak as the contract
            expect(spoken).not.toContain('NO_THROW');

            // .note = `trimEnd`, so this render ends EXACTLY as its two siblings do.
            //         three snapshots in this repo capture the same `HelpfulError`
            //         shape — `<Class>: <sentence>\n\n{ <metadata> }` — and the other
            //         two snapshot `error.message` in-process, which carries no
            //         trailing newline. this one reads the message back through a
            //         CHILD's stdout, and `console.log` appends one. so a trim is
            //         genuinely owed here and nowhere else; the only question is
            //         which way. to force a trailing `\n` instead would make one
            //         member of a byte-identical family render `}\n"` while its two
            //         siblings render `}"` — a divergence with a real cause and no
            //         marker, which reads to a reviewer as an oversight
            expect(
              spoken.split(os.tmpdir()).join('<tmp>').trimEnd(),
            ).toMatchSnapshot();
          },
        );
      });
    },
  );

  given(
    '[case5b] isTempDir — the export a consumer FILTERS their count through',
    () => {
      // .why = 🔴 the third of the three exports the docs advertise for a residue
      //        count (`getOneTempDirRoot`'s own jsdoc: *"filter through
      //        isTempDir"*), and the only one with no journey of its own. its
      //        grammar spans two shapes — the 4-segment stamped name beside the
      //        3-segment unstamped one — and that breadth is what keeps the age
      //        gate alive across the stamp.
      //
      //        every clamp on it today is in-process (`genTempDir.jest.test.ts`)
      //        or incidental (a helper inside another case's prelude). so the
      //        grammar a consumer actually receives — compiled, through the
      //        exports map, with no types to catch a rename — is proven by no
      //        assertion at this grain.
      //
      // .note = the negative rows carry as much load as the positive ones. a
      //         pattern loosened to `.+` anywhere would still admit both true
      //         rows while it started to admit `readme.md` — and `readme.md` and
      //         `.gitignore` are written into every contained dir on every run,
      //         so a consumer's count would silently gain two.

      when('[t0] they call it from the installed package', () => {
        /**
         * .what = the verdict the compiled export renders, per name variant
         * .why = one child, one require, every variant — so the record shows the
         *        whole grammar rather than one row per spawn
         */
        const getAllVerdictsFromDist = (): Record<string, boolean> => {
          const child = spawnSync(
            process.execPath,
            [
              '-e',
              `
const api = require(${JSON.stringify(getOneTargetPath('.'))});
if (typeof api.isTempDir !== 'function')
  throw new Error('isTempDir is absent from the main export');
const cases = {
  'an unstamped name, whose run slot holds _': '2026-01-19T12-34-56.789Z._.my-test.a1b2c3d4',
  'a stamped name, whose run slot holds an id': '2026-01-19T12-34-56.789Z.r7f3a91c2.my-test.a1b2c3d4',
  'a LEGACY name, minted before the run slot existed': '2026-01-19T12-34-56.789Z.my-test.a1b2c3d4',
  'a slug shaped like a run id, beside an empty slot': '2026-01-19T12-34-56.789Z._.rdeadbeef.a1b2c3d4',
  'a full path to a stamped dir': '/tmp/test-fns/repo/.temp/2026-01-19T12-34-56.789Z.r7f3a91c2.my-test.a1b2c3d4',
  'the root readme the infra writes': 'readme.md',
  'the root gitignore the infra writes': '.gitignore',
  'a name with no timestamp': 'stuck-dir',
  'a name whose hex is too short': '2026-01-19T12-34-56.789Z._.my-test.a1b2c3',
  'a name with no hex at all': '2026-01-19T12-34-56.789Z._.my-test',
};
const verdicts = {};
for (const [label, one] of Object.entries(cases))
  verdicts[label] = api.isTempDir({ path: one });
process.stdout.write(JSON.stringify(verdicts));
`,
            ],
            { cwd: gitRoot, encoding: 'utf8' },
          );
          if (child.status !== 0)
            throw new UnexpectedCodePathError(
              'the isTempDir child exited nonzero',
              {
                status: child.status,
                stderr: child.stderr,
                hint: 'run `npm run build` — this reads dist/, through the exports map',
              },
            );
          return JSON.parse(child.stdout) as Record<string, boolean>;
        };

        then('🔴 and the GRAMMAR it admits reads as here', () => {
          expect(getAllVerdictsFromDist()).toMatchSnapshot();
        });

        then('🔴 and it admits every shape the age gate must reclaim', () => {
          // .why = guard the guard. a snapshot alone is rewritten in place on a
          //        local run, so it would record a regression as the contract.
          //        these rows are the ones the age gate stands on: an unstamped
          //        dir is what an UNHOOKED consumer makes, a stamped one is what a
          //        hooked run makes, and the gate must reclaim both or a whole
          //        population goes immortal
          const verdicts = getAllVerdictsFromDist();
          expect(verdicts['an unstamped name, whose run slot holds _']).toEqual(
            true,
          );
          expect(
            verdicts['a stamped name, whose run slot holds an id'],
          ).toEqual(true);

          // 🔴 the LEGACY row carries the upgrade. the run slot is new, so every
          // dir a prior version left on disk has three segments — and a grammar
          // that rejected those would PRESERVE them, since an unreadable name is
          // never removed. that would strand the entire pre-upgrade population,
          // which is the exact harm this behavior exists to end
          expect(
            verdicts['a LEGACY name, minted before the run slot existed'],
          ).toEqual(true);

          // and a run-shaped slug is ADMITTED — the mint never refuses one, so the
          // grammar must read it back beside an empty run slot
          expect(
            verdicts['a slug shaped like a run id, beside an empty slot'],
          ).toEqual(true);
        });

        then('🔴 and it REFUSES the infra files it shares a dir with', () => {
          // .why = the sharpest negative, and the one a loosened pattern breaks
          //        first. `readme.md` and `.gitignore` sit beside every fixture
          //        by construction, so a consumer's count gains two the moment
          //        this goes true — and reads GREEN
          const verdicts = getAllVerdictsFromDist();
          expect(verdicts['the root readme the infra writes']).toEqual(false);
          expect(verdicts['the root gitignore the infra writes']).toEqual(
            false,
          );
        });
      });
    },
  );

  given(
    '[case5c] the ONE way genTempDir refuses a consumer — and the one it dropped',
    () => {
      // .why = 🔴 the refusal is reachable from the PUBLIC `genTempDir`, by an env
      //        var the consumer set, and it was held by a fragment assertion alone
      //        (`toContain(RUN_ID_ENV_KEY)`). a fragment proves a word is present. it
      //        cannot see the metadata block, a duplicated label, a hint that lost
      //        its second sentence, or a rename of the key the block is filed under
      //
      // .why THERE ARE TWO ARMS = a slug shaped like a run stamp is refusable only
      //        where the run slot is OPTIONAL: with the slot omitted, a consumer's
      //        slug sits in the run's own position, so `r` + 8 hex reads back as an
      //        id no run ever minted. the slot is always emitted here, so the slug
      //        can never hold that position and the refusal is WITHDRAWN.
      //
      //        this case keeps that arm rather than deletes it, inverted: the same
      //        slug is driven through `dist/` and asserted to MINT. a withdrawn
      //        refusal is a contract change a consumer feels, so it owes a live
      //        assertion at the same grain the refusal held — a deleted test is no
      //        record at all
      //
      // .why HERE = the two positive-path exports beside it (`getOneTempDirRoot`'s
      //        refusal, `genTempDir`'s clone-not-found) are both snapped at THIS
      //        grain, through `dist/`, for the same reason: an error message is the
      //        one contract surface with no types to catch a drift, so the compiled
      //        artifact is the only honest place to read it
      //        (`rule.require.contract-snapshot-exhaustiveness`)

      const repoThrowawayRefusals = fs.mkdtempSync(
        path.join(os.tmpdir(), 'test-fns-exports-refuse-'),
      );
      execFileSync('git', ['init', '--quiet'], { cwd: repoThrowawayRefusals });
      afterAll(() => {
        fs.rmSync(repoThrowawayRefusals, { recursive: true, force: true });
        fs.rmSync(
          path.join('/tmp/test-fns', path.basename(repoThrowawayRefusals)),
          { recursive: true, force: true },
        );
      });

      when('[t0] a consumer trips each one from the installed package', () => {
        /**
         * .what = the message each refusal renders, read through `dist/`
         * .why = one child reaches both, since `getOneRunId` reads `process.env`
         *        at each call rather than at load — so the env can be set between
         *        the two without a second spawn
         */
        const getAllRefusalsFromDist = (): Record<string, string> => {
          const child = spawnSync(
            process.execPath,
            [
              '-e',
              `
const api = require(${JSON.stringify(getOneTargetPath('.'))});
const spoken = {};

const speak = (label, slug) => {
  try {
    const made = api.genTempDir({ slug });
    spoken[label] = 'MINTED: ' + require('path').basename(made);
  } catch (thrown) {
    spoken[label] = thrown.message;
  }
};

// 1 — the WITHDRAWN refusal: a slug the consumer chose that is shaped like a run
//     stamp. on an UNHOOKED run it must MINT rather than throw, with \`_\`
//     in the run slot and the slug intact one segment to its right
delete process.env[${JSON.stringify(RUN_ID_ENV_KEY)}];
speak('MINTS: a slug shaped like a run stamp', 'rdeadbeef');

// 2 — the refusal that REMAINS: a value the consumer set, left over or hand-written
process.env[${JSON.stringify(RUN_ID_ENV_KEY)}] = 'not-a-run-id';
speak('REFUSES: a run id env var that is not a run id', 'plain-slug');

process.stdout.write(JSON.stringify(spoken));
`,
            ],
            {
              cwd: repoThrowawayRefusals,
              encoding: 'utf8',
              // .why = the unhooked NOTICE would ride stdout beside our json
              env: { ...process.env, [QUIET_ENV_KEY]: '1' },
            },
          );
          if (child.status !== 0)
            throw new UnexpectedCodePathError(
              'the refusals child exited nonzero',
              {
                status: child.status,
                stderr: child.stderr,
                hint: 'run `npm run build` — this reads dist/, through the exports map',
              },
            );
          return JSON.parse(child.stdout) as Record<string, string>;
        };

        then('🔴 and the OUTCOMES a human reads are shaped as here', () => {
          // .note = 🔴 this snapshots a titled REPORT, never a map, and the container
          //         is the whole point. one of the two values is a multi-line
          //         `helpful-errors` render whose metadata block opens a `{` at
          //         column 0. inside a map that brace is indistinguishable, at a
          //         glance, from the map's own — so the render read as structure it
          //         is not, and the closes stacked `}",` / `}` at the tail.
          //
          //         a move of the block AROUND inside a container does not answer
          //         that (jest sorts keys, so a label led by its outcome sorts the
          //         one-line value ahead) — any position still stacks braces
          //         somewhere. the container itself is what makes a bare `{`
          //         ambiguous, and a map is not the only container that holds this
          //         case's whole claim — the CONTRAST between a refusal that remains
          //         and one withdrawn. a titled report holds the same contrast, and
          //         has no brace of its own to confuse with the render's
          //         (`rule.prefer.prevent-over-correct`, rung 1).
          //
          //         🔴 the render itself is UNTOUCHED, byte for byte — the `── ──`
          //         rules only replace the map's quoting and indent, so what a human
          //         reads in their terminal is what lands here. the structural claim
          //         a map would carry by implication is asserted explicitly in the
          //         `then` below, which is where it belongs.
          //
          // .note = the mask is PER SEGMENT of the minted name — the timestamp and
          //         the random suffix are the only bytes that move between runs.
          //         the run slot and the slug are NOT masked, and that is the point:
          //         the withdrawn arm's whole claim is that `_` holds the slot and
          //         `rdeadbeef` sits beside it as a plain slug, so a regression that
          //         put the slug back in the run's position must redden here
          const spoken = getAllRefusalsFromDist();
          const asStable = (one: string): string =>
            one
              .replace(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z/g, '<ts>')
              // 🔴 the suffix is masked at a QUOTE **or at end of string**. a
              // quote-only form reaches only the names that sit inside a json
              // metadata block: the withdrawn-refusal arm renders a bare
              // `MINTED: <name>` with no trailing quote, so that form leaves its 8
              // random hex chars LIVE in the snapshot — a value that changes every
              // run, which reddens the board on the next invocation and teaches a
              // human to `--updateSnapshot` past it
              .replace(/\.[a-f0-9]{8}(?="|$)/g, '.<hex>');

          // 🔴 sorted EXPLICITLY. a bare `Object.entries` inherits the child's
          // `speak` call order, so a reorder there would redden this snapshot for
          // no change in behavior. the sort keeps order a property of the LABELS
          // rather than of a serializer or a call site
          expect(
            Object.entries(spoken)
              .sort(([one], [two]) => one.localeCompare(two))
              .map(([label, one]) => `── ${label} ──\n${asStable(one)}`)
              .join('\n\n'),
          ).toMatchSnapshot();
        });

        then(
          '🔴 the withdrawn refusal MINTS, and the one that remains still names the input at fault',
          () => {
            // .why = guard the guard. a snapshot is rewritten in place on a local
            //        run, so it would record a regression as the contract. these
            //        rows carry the whole ergonomic claim, on both arms
            const spoken = getAllRefusalsFromDist();

            // 🔴 arm 1 — the WITHDRAWN refusal. it must mint, and the shape of what
            // it mints is the proof: `_` in the run slot, the consumer's slug intact
            // one segment right of it. a regression that restored the optional slot
            // would put `rdeadbeef` back in the run's position and redden here
            const minted = spoken[
              'MINTS: a slug shaped like a run stamp'
            ] as string;
            expect(minted).toContain('MINTED: ');
            expect(minted).toContain('._.rdeadbeef.');

            // arm 2 — the refusal that REMAINS. absent it, a stale env var rides
            // two modules down and surfaces as a message that blames OUR mint for
            // THEIR value
            expect(
              spoken['REFUSES: a run id env var that is not a run id'],
            ).toContain(RUN_ID_ENV_KEY);
            expect(
              spoken['REFUSES: a run id env var that is not a run id'],
            ).toContain('not-a-run-id');
          },
        );
      });
    },
  );

  given(
    '[case3] the readme — the one contract a consumer reads BEFORE our code',
    () => {
      // .why = 🔴 a backcompat pass found the readme still promised the PRE-change
      //        contract in four places: a 7-day window (now 24h), a dir-name format
      //        with no run stamp, a prune that fires "when genTempDir is called" (now
      //        true only unhooked), and no word at all about the hooks, the hold hatch,
      //        or getOneTempDirRoot — the export the wish itself demanded
      //
      // .note = the sharpest part is that `SUBPATHS_ADVERTISED` above says these are
      //         the subpaths *"the readme … tell(s) a consumer to write"*. that comment
      //         was FALSE when it was written: the readme named none of them. **a clamp
      //         may cite a source of truth that does not hold the truth**, and the
      //         citation reads as evidence to every later reader
      //
      // .why it belongs HERE = this file's subject is "the seam a consumer crosses",
      //        and the readme is the first half of that seam. a stale doc is not a
      //        tidiness matter — it is a contract we publish and then break
      const readme = fs.readFileSync(path.join(gitRoot, 'readme.md'), 'utf8');

      when('[t0] a consumer reads it to wire the autoprune', () => {
        then('🔴 it names every subpath they must paste', () => {
          for (const subpath of SUBPATHS_ADVERTISED)
            expect(readme).toContain(subpath.replace(/^\.\//, 'test-fns/'));
        });

        then('🔴 it names the env keys by their LIVE constant', () => {
          // .why = a renamed key with a stale readme sends a human to set a variable
          //        the product does not read, and the failure is SILENT — they get
          //        the default and never learn why
          expect(readme).toContain(KEEP_ENV_KEY);
          expect(readme).toContain(MAX_AGE_ENV_KEY);
        });

        then('🔴 it states the age window the code actually uses', () => {
          // .why = this is the exact claim that went stale. tie the prose to the
          //        constant, so the next change to one fails until the other follows
          const hours = MAX_AGE_MS_DEFAULT / (60 * 60 * 1000);
          expect(readme).toContain(`${hours} hours`);
        });

        then('it shows the dir-name format WITH the run stamp', () => {
          // .why = the stamp is this behavior's headline change to the name a human
          //        reads in failure output; a format doc without it teaches a name
          //        no run of the product mints
          expect(readme).toContain('{timestamp}.{run}.{slug}.{8-char-uuid}');
        });

        then('it names the export the wish demanded', () => {
          expect(readme).toContain('getOneTempDirRoot');
        });

        then('🔴 and the SECTIONS it publishes read as here', () => {
          // 🔴 the fragment assertions above are FUNCTIONAL, never observability.
          // each proves one token survives; not one would notice a reworded
          // sentence, a doubled line, a lost blank line, or a paragraph deleted
          // whole — and every token they check could still be present in prose
          // that teaches the wrong lesson.
          //
          // .why this surface, specifically = the readme is the first contract a
          //      consumer reads, and `genIsolatedTempInfra` writes a copy of this
          //      policy into EVERY consumer's contained dir on every run. this
          //      branch has already shipped a stale readme once: a backcompat pass
          //      found it promised a 7-day window, a name format with no run stamp,
          //      and no word at all about the hooks. fragment clamps were added for
          //      those four facts — and a fifth drift would pass all of them
          //
          // .note = it snaps the three sections this behavior OWNS rather than the
          //         whole file. the badges, the install block, and the bdd docs
          //         churn for reasons that have no relation to this contract, so a
          //         whole-file snapshot would redden on other people's work — which
          //         trains a reader to resnap without a read, and that is how a
          //         snapshot stops to be a review surface
          const getOneSection = (title: string): string => {
            const lines = readme.split('\n');
            const at = lines.indexOf(title);
            expect(at).toBeGreaterThan(-1); // the guard's guard: a renamed title
            const rest = lines.slice(at + 1);
            const until = rest.findIndex((line) => /^#{2,4} /.test(line));
            return [title, ...(until === -1 ? rest : rest.slice(0, until))]
              .join('\n')
              .trimEnd();
          };

          expect(
            [
              getOneSection('### autoprune'),
              getOneSection('### getOneTempDirRoot'),
              getOneSection('### isTempDir'),
            ].join('\n\n'),
          ).toMatchSnapshot();
        });

        then('🔴 and those three ARE every section this behavior owns', () => {
          // 🔴 the gap the snapshot above cannot close by construction. it grades
          // three sections BY NAME, so it is blind in exactly one direction: a
          // FOURTH section added for this behavior is covered by no export, and
          // ships with no diff line.
          //
          // that is the same class as `[case2] [t2]`'s module-shape export — a
          // check that names its subjects can never see a subject that was added.
          // so the roster itself is graded here, rather than the snapshot widened
          // to the whole file (which would redden on badge and install churn and
          // train the blind resnap this file argues against).
          //
          // .note = keyed on the EXPORTS the contract ships, never a hand-list, so
          //         a new export with a readme section fails here until the
          //         snapshot above is widened to hold it — and a new export with
          //         NO readme section fails too, which is the stronger catch.
          const documented = readme
            .split('\n')
            .filter((line) => line.startsWith('### '))
            .map((line) => line.slice('### '.length));

          for (const exported of [
            'autoprune',
            'getOneTempDirRoot',
            'isTempDir',
          ])
            expect(documented).toContain(exported);

          // the roster is pinned, so a section added for this behavior reddens
          expect(
            documented.filter((title) =>
              ['autoprune', 'getOneTempDirRoot', 'isTempDir'].includes(title),
            ),
          ).toEqual(['autoprune', 'getOneTempDirRoot', 'isTempDir']);
        });
      });
    },
  );

  given(
    '[case4] the unhooked NOTICE — the loudest of the three advertisers',
    () => {
      // .why = 🔴 `SUBPATHS_ADVERTISED` claims to hold the subpaths *"the readme, the
      //        jsdocs, and case=7's notice all tell a consumer to write"*. case=3 above
      //        found that claim false for the README and clamped that third. the other
      //        TWO were left — and the notice is the one with the widest reach, since
      //        the vision calls the unhooked state *"the default state of the world on
      //        release day"*. so the list stayed a HAND-COPY of the notice's text, and
      //        a typo in either drifted from the other in silence
      //
      // .note = the shape of the defect is worth the record, because it is the third
      //         instance this branch: **a comment that asserts coverage the code does
      //         not supply**. the messages-file header claimed `(gone)` was held by a
      //         fragment assertion that did not exist; this list claimed three sources
      //         it never read. *a coverage claim in prose is a claim no gate grades* —
      //         so a claim of that shape is a defect until a test makes it true

      /**
       * .what = a throwaway git repo, so the child derives a CONTAINED ROOT OF ITS OWN
       * .why = 🔴 an unhooked consumer is a DIFFERENT REPO, and this file simulated
       *        one by a scrub of env keys alone. that sufficed while the notice keyed
       *        on the env — and it stopped to suffice the moment the notice began to
       *        read the DISK to tell "genuinely unhooked" apart from "OUR mint chain
       *        broke". this child is a literal descendant of a live wired run that
       *        shares its scope, and `test:acceptance:jest` passes `--runInBand`, so
       *        the runner's own pid IS its parent's — it read as our broken chain
       *        rather than as a foreign unhooked repo, and went silent.
       *
       *        the env scrub answers "what does this process know". this answers
       *        "whose scope is it in" — and a fixture for a foreign repo owes both
       */
      const repoThrowaway = fs.mkdtempSync(
        path.join(os.tmpdir(), 'test-fns-exports-notice-'),
      );
      execFileSync('git', ['init', '--quiet'], { cwd: repoThrowaway });
      afterAll(() => {
        fs.rmSync(repoThrowaway, { recursive: true, force: true });
        fs.rmSync(path.join('/tmp/test-fns', path.basename(repoThrowaway)), {
          recursive: true,
          force: true,
        });
      });

      /**
       * .what = the program a child runs to reach ONE of the two unhooked states
       * .why = 🔴 the ACTION crosses the contract, never an internal
       *        (`rule.require.acceptance.blackbox`). it called
       *        `warnIfUnhooked({ reason })` directly — the very action-via-internal
       *        shape this rubric blocked on the J1 clamp one round earlier
       *
       * .note = each child LEAVES NO RESIDUE. it is here for the stderr, not for
       *         the allocation, so it discharges what it made before it exits —
       *         the dir by hand, the marker through the teardown subpath. the
       *         acid test (`1 directory, 2 files`) grades this file too
       */
      function genChildProgram(
        reason: 'setup-absent' | 'teardown-absent',
      ): string {
        return reason === 'setup-absent'
          ? `
const fs = require('node:fs');
const { genTempDir } = require(${JSON.stringify(getOneTargetPath('.'))});

// an allocation with no setup wired — the state every consumer is in on day one
const dir = genTempDir({ slug: 'exports-notice' });
fs.rmSync(dir, { recursive: true, force: true });
`
          : `
const setupHook = require(${JSON.stringify(
              getOneTargetPath('./autoprune.setup.jest'),
            )}).default;
const teardownHook = require(${JSON.stringify(
              getOneTargetPath('./autoprune.teardown.jest'),
            )}).default;

(async () => {
  // a globalConfig with NO globalTeardown — the half-wired state jest's two-key
  // surface makes reachable and vitest's one-key surface does not
  await setupHook({});

  // discharge the marker this child just minted, through the contract as well
  await teardownHook();
})();
`;
      }

      /**
       * .what = the raw stderr of one notice child — the single spawn every reader shares
       * .why = it sits at the GIVEN scope rather than inside one `when`, because two
       *        distinct actions need it: a consumer who runs their suite, and a
       *        consumer who runs it with the notice suppressed
       */
      function getOneChildStderr(input: {
        reason: 'setup-absent' | 'teardown-absent';
        quiet: boolean;
      }): string {
        const child = spawnSync(
          process.execPath,
          ['-e', genChildProgram(input.reason)],
          {
            // .note = a repo of its OWN, never `gitRoot` — see `repoThrowaway`
            cwd: repoThrowaway,
            encoding: 'utf8',
            // .note = the same four scrubs the J1 clamp documents: an inherited
            //         RUN_ID reads as hooked and silences the notice, an inherited
            //         GATE_SWEPT makes the child's age gate skip, an inherited
            //         KEEP adds a second message, and an inherited QUIET silences
            //         this clamp on one machine alone.
            //         JEST_WORKER_ID is set EXPLICITLY — the notice stays silent
            //         where no runner is detectable, so an inherited value would
            //         make this clamp pass vacuously as a bare node one-off
            //
            // .note = 🔴 RUN_ID and GATE_SWEPT scrub TOGETHER. they are two distinct
            //         facts that merely coincide — so a site that scrubs one alone
            //         silently stops to test its own claim
            //
            // .note = `quiet` is the ONE key this helper sets rather than scrubs,
            //         so the suppressed variant is reached by the same spawn, the
            //         same program, and the same repo as the loud one. a second
            //         spawn helper would let those two drift, and a drift is what
            //         would make a suppression clamp pass while the real notice
            //         still speaks
            env: {
              ...process.env,
              [RUN_ID_ENV_KEY]: undefined,
              [GATE_SWEPT_ENV_KEY]: undefined,
              [KEEP_ENV_KEY]: undefined,
              [QUIET_ENV_KEY]: input.quiet ? '1' : undefined,
              VITEST: undefined,
              JEST_WORKER_ID: '1',
            },
          },
        );
        if (child.status !== 0)
          throw new UnexpectedCodePathError('the notice child exited nonzero', {
            reason: input.reason,
            quiet: input.quiet,
            status: child.status,
            stderr: child.stderr,
            hint: 'run `npm run build` — this reads dist/, through the exports map',
          });

        return child.stderr;
      }

      when('[t1] a consumer who has READ the notice suppresses it', () => {
        then('🔴 it emits NOT ONE BYTE, at a real terminal', () => {
          // .why = 🔴 `TEST_FNS_QUIET` is a user-faced contract variant with a
          //        deterministic output — the empty one — and every clamp on it
          //        lived at a DIRECT in-process call to `warnIfUnhooked`
          //        (`warnIfUnhooked.jest.test.ts`). this file's own comment names
          //        that shape as the one the rubric forbids: *"do not settle for a
          //        snapshot at an injected layer and call the live journey
          //        covered."* the suppression a consumer actually buys travels
          //        through `dist/`, the exports map, and a process boundary — and
          //        not one of those three was covered
          //
          // .note = 🔴 SNAPPED **and** asserted, never asserted alone. the case for
          //         the omission reads: *"a snapshot of an empty string is a record
          //         a reviewer cannot tell from an absent one."* that is true of the
          //         bytes and false of the contract, and `[case17] [t1]` states the
          //         counter in as many words:
          //
          //           *"an empty record looks like an absent one, and it is neither.
          //            it is the RENDER of a run that … chose to say no word — so a
          //            change that made a later run speak again lands as a diff here
          //            rather than as a judgement call somewhere downstream."*
          //
          //         two rationales for one situation, in one repo, is the drift the
          //         snapshot rubric exists to end. the KEYED shape settles it: an
          //         empty string under a named key is plainly distinct from an
          //         absent export, so the objection does not survive the form.
          //
          //         the `toEqual('')` rows stay beside it, always — a snapshot alone
          //         is rewritten green by the very run that should have failed it
          const spokenQuiet = {
            'setup-absent': getOneChildStderr({
              reason: 'setup-absent',
              quiet: true,
            }),
            'teardown-absent': getOneChildStderr({
              reason: 'teardown-absent',
              quiet: true,
            }),
          };
          expect(spokenQuiet).toMatchSnapshot();

          expect(spokenQuiet['setup-absent']).toEqual('');
          expect(spokenQuiet['teardown-absent']).toEqual('');
        });

        then('🔴 and the SAME child speaks loudly without the key', () => {
          // .why = guards the guard. a suppression clamp passes vacuously if the
          //        child was silent for any OTHER reason — a build that did not
          //        emit, a repo whose scope reads as hooked, a runner it could not
          //        detect. this pins the difference to the key alone, which is the
          //        only thing the consumer changed
          for (const reason of ['setup-absent', 'teardown-absent'] as const)
            expect(
              getOneChildStderr({ reason, quiet: false }).length,
            ).toBeGreaterThan(0);
        });
      });

      when('[t0] a consumer with no hooks wired runs their suite', () => {
        /**
         * .what = the notice a real child speaks to stderr, masked to be stable
         *
         * .why = 🔴 this child is the ONLY place either notice crosses a process
         *        boundary against the compiled `dist/`, through the exports map. a
         *        regex that consumes its stderr for subpaths alone proves the live
         *        journey by FRAGMENT, and leaves the full message text covered only
         *        one layer in, at a direct call.
         *
         *        that is the shape `rule.require.contract-snapshot-exhaustiveness`
         *        names outright: do not settle for a snapshot at an injected layer
         *        and call the live journey covered. the subpath assertions prove
         *        the notice names the right keys; only a snapshot proves a human
         *        can read what arrives around them.
         */
        const getOneNoticeSpoken = (
          reason: 'setup-absent' | 'teardown-absent',
        ): string =>
          getOneChildStderr({ reason, quiet: false })
            .replace(/\/[\w./-]*\/\.temp/g, '<tmpDir>')
            .replace(/-c [\w./-]+/g, '-c <config>');

        /** every `test-fns/...` subpath the notice actually speaks, as exports keys */
        const getAllSubpathsSpoken = (
          reason: 'setup-absent' | 'teardown-absent',
        ): string[] => {
          const spoken =
            getOneChildStderr({ reason, quiet: false }).match(
              /test-fns\/[\w.-]+/g,
            ) ?? [];
          return [...new Set(spoken)].map((one) =>
            one.replace(/^test-fns\//, './'),
          );
        };

        then('🔴 every subpath it tells them to paste is one we EXPORT', () => {
          // .why = a notice that names a subpath our exports map seals is worse than
          //        silence: the human pastes it, and their next run dies with
          //        ERR_PACKAGE_PATH_NOT_EXPORTED before any of our code loads. they
          //        would then reasonably conclude the library is broken, on the very
          //        first instruction it ever gave them
          const { exports: exportsMap } = getOnePackageJson();
          const spoken = [
            ...getAllSubpathsSpoken('setup-absent'),
            ...getAllSubpathsSpoken('teardown-absent'),
          ];

          expect(spoken.length).toBeGreaterThan(0);
          for (const subpath of spoken)
            expect(Object.keys(exportsMap)).toContain(subpath);
        });

        then('🔴 and it names ALL THREE, never a subset', () => {
          // .why = the reverse direction, and it fails the other way: a notice that
          //        drops one subpath leaves a consumer half-wired — which is the exact
          //        state case=6's teardown-side message exists to diagnose later. the
          //        cheapest place to prevent that is the instruction itself
          const spoken = new Set([
            ...getAllSubpathsSpoken('setup-absent'),
            ...getAllSubpathsSpoken('teardown-absent'),
          ]);

          for (const subpath of SUBPATHS_ADVERTISED)
            expect([...spoken]).toContain(subpath);
        });

        then(
          '🔴 and the SETUP-ABSENT notice reads as here, at a real terminal',
          () => {
            // the subpath assertions above prove the notice names the right keys.
            // only this proves a human can read the message that surrounds them —
            // and it proves it through `dist/`, across a process boundary, which is
            // where the direct-call snapshot in `autoprune.messages` cannot reach
            expect(getOneNoticeSpoken('setup-absent')).toMatchSnapshot();
          },
        );

        then(
          '🔴 and the TEARDOWN-ABSENT notice reads as here, at a real terminal',
          () => {
            // the half-wired branch jest's two-key surface makes reachable. with its
            // full text covered only at a direct call, a drift in the spawned path
            // passes every other check here
            expect(getOneNoticeSpoken('teardown-absent')).toMatchSnapshot();
          },
        );
      });
    },
  );

  given('[case6] the harness that decides whether ANY export bites', () => {
    // 🔴🔴 the sharpest defect this behavior's verification found, and it sat in
    // the INSTRUMENT rather than in the subject. every jest command gated
    // `--updateSnapshot` on an UNQUOTED variable:
    //
    //     $([ -n $RESNAP ] && echo '--updateSnapshot')
    //
    // with `RESNAP` unset that expands to `[ -n ]` — a ONE-argument `test`,
    // which POSIX resolves as *"is the string `-n` non-empty?"*. it is. so
    // `--updateSnapshot` was passed on EVERY run, in CI as well as locally, and
    // every `.snap` in this repo rewrote itself in place and reported green.
    //
    // it was found by a dogfood rather than by a read: a one-line regression to
    // `sayReport` went red on ONE assertion while it silently rewrote FOURTEEN
    // snapshot exports. with the quotes restored the same regression goes red on
    // fifteen. *those fourteen were not weak clamps; they were absent ones.*
    //
    // .why this is in scope = this behavior states its evidence in snapshots, so
    //      every snapshot-coverage verdict is read off this instrument. a verdict
    //      read off an instrument that cannot fail is not a weak verdict — it is
    //      no verdict at all (`rule.forbid.failhide`). *check the instrument
    //      before you trust what it measured.*
    //
    // .note = the mirror gate `[ -z $THOROUGH ]` is correct BY ACCIDENT and is
    //         quoted here too. unset → `[ -z ]` → the same one-argument rule →
    //         true, which is the wanted answer; set → a real two-argument test →
    //         false, also wanted. it lands right for a reason unrelated to what
    //         it says, which is a defect that has yet to bite
    const getAllCommandsDeclared = (): string[] => {
      const parsed: unknown = JSON.parse(
        fs.readFileSync(path.join(gitRoot, 'package.json'), 'utf8'),
      );
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('scripts' in parsed) ||
        typeof parsed.scripts !== 'object' ||
        parsed.scripts === null
      )
        throw new UnexpectedCodePathError('package.json declares no commands', {
          hint: 'the gates this case checks live under the `scripts` key',
        });

      return Object.values(parsed.scripts).filter(
        (command): command is string => typeof command === 'string',
      );
    };

    when(
      '[t0] a maintainer reads how the jest commands gate their flags',
      () => {
        then(
          '🔴 every gated variable is QUOTED, so the test has two args',
          () => {
            const gated = getAllCommandsDeclared().filter((command) =>
              command.includes('[ -'),
            );

            // the guard's guard: a manifest whose gates were rewritten away would
            // otherwise satisfy a loop over an empty list
            expect(gated.length).toBeGreaterThan(0);

            // an unquoted `$VAR` inside a `[ … ]` IS the defect, so it is matched
            // directly rather than inferred from the flag it happens to gate
            for (const command of gated)
              expect(command).not.toMatch(/\[ -[a-z] \$[A-Za-z_]/);
          },
        );

        then(
          '🔴 and RESNAP is what gates --updateSnapshot, at every grain',
          () => {
            // .why = a command that dropped the gate entirely and passed
            //        `--updateSnapshot` outright would satisfy the quote check above
            //        while it re-opened the identical hole. so the BINDING is named:
            //        the flag appears only inside a RESNAP-gated expression
            const withUpdate = getAllCommandsDeclared().filter((command) =>
              command.includes('--updateSnapshot'),
            );

            // the three jest grains — unit, integration, acceptance
            expect(withUpdate.length).toEqual(3);

            for (const command of withUpdate)
              expect(command).toContain(
                '[ -n "$RESNAP" ] && echo \'--updateSnapshot\'',
              );

            // 🔴 and the VITEST grains, which this `then` claimed by its own name
            // and did not check. vitest names the flag `--update`, so a filter on
            // jest's name matched none of them and the "every grain" claim passed
            // VACUOUSLY over half its subject — the four vitest commands carried
            // no gate at all, and their snapshots could not be updated through
            // the harness by any means it offers
            const withUpdateVitest = getAllCommandsDeclared().filter(
              (command) => command.includes("echo '--update'"),
            );
            expect(withUpdateVitest.length).toEqual(3);

            for (const command of withUpdateVitest)
              expect(command).toContain(
                '[ -n "$RESNAP" ] && echo \'--update\'',
              );

            // and no vitest run escapes the gate — the count above proves three
            // commands carry one; this proves no fourth slipped past the filter
            const vitestRuns = getAllCommandsDeclared().filter((command) =>
              command.startsWith('vitest run'),
            );
            for (const command of vitestRuns)
              expect(command).toContain(
                '[ -n "$RESNAP" ] && echo \'--update\'',
              );
          },
        );
      },
    );
  });
});
