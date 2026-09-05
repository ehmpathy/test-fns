// import from contract layer only (blackbox)
//
// .why SOURCE here, when its siblings cross `dist/` = the two grains answer two
//      different questions, and each needs the other:
//
//        | this suite                  | `autoprune.exports.acceptance`  |
//        |-----------------------------|---------------------------------|
//        | reads `@src/contract`       | reads `dist/` via the exports map |
//        | subject = the BEHAVIOR      | subject = the compiled SEAM     |
//        | ~40 cases, typechecked      | 3 cases, one spawn each         |
//
//      a build regression — a `tsc-alias` rewrite of the contract index, an
//      exports-map repoint, a narrowed `files` list — is invisible from here,
//      and that is precisely why `autoprune.exports.acceptance` exists: it
//      crosses the seam for all three exports this suite drives
//      (`getOneTempDirRoot` `[case5]`, `isTempDir` `[case5b]`, `genTempDir`'s
//      two refusals `[case5c]`). so the compiled artifact IS proven — in the
//      file whose subject it is
//
//      a spawn per case here would buy the same coverage at ~40× the cost, and
//      would trade this suite's typechecked reads for `any`
import {
  genTempDir,
  getOneTempDirRoot,
  given,
  isTempDir,
  then,
  when,
} from '@src/contract';

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// internal imports only for test setup/teardown
import { RUN_ID_ENV_KEY } from './getOneRunId';
import { resetPruneThrottle } from './pruneStale';

/**
 * .note = this suite carries NO `createdDirs[]` + `afterEach` teardown of its own.
 *         the autoprune hooks wired into jest.acceptance.config.ts reclaim every
 *         dir this run makes, so a call site tracks not one path.
 *
 *         that absence IS the wish's acceptance signal for the choice of repo: a
 *         consumer who adopts this should end with no prune machinery of their
 *         own. we are our own first consumer, so we go first
 *
 * .note = 🔴 and `[case0]` below is what makes that claim CHECKABLE. absent it, the
 *         note above is a promise that leans on a config file no test reads: pull
 *         `globalTeardown` out of `jest.acceptance.config.ts` and this whole suite
 *         leaks every dir it makes, on every run, and stays GREEN. **a teardown
 *         dropped in favour of an unverified config key is the same silent leak
 *         this behavior exists to end, moved one file over**
 */
describe('genTempDir acceptance', () => {
  beforeEach(() => {
    resetPruneThrottle();
  });

  given(
    '[case0] the reclaim this suite deleted its own teardown to rely on',
    () => {
      // .why = the three claims below are ordered from the weakest evidence to
      //        the strongest, and each catches a break the one before it cannot:
      //
      //          [t0] the config DECLARES both hooks   → catches a deleted key
      //          [t1] the setup hook actually RAN      → catches a key that points
      //                                                  at a module that no-ops
      //          [t2] our dirs carry THIS run's stamp  → catches a mint that ran
      //                                                  and produced dirs the
      //                                                  teardown's own filter
      //                                                  cannot match
      //
      //        the last is the one that matters most: a reclaim can be perfectly
      //        wired and still match zero, which is `case=10`'s whole subject

      when('[t0] a maintainer reads the config this suite runs under', () => {
        then('🔴 it wires BOTH keys, at the contract subpaths', () => {
          // .why = jest's two-key surface makes a HALF-WIRED state reachable that
          //        vitest's one-key surface does not: wire only the setup and
          //        every dir is stamped and none is ever taken. so both are named
          //        here, and named as the paths — a key that pointed elsewhere
          //        would pass a bare `toBeDefined`
          const config = fs.readFileSync(
            path.join(__dirname, '../../../jest.acceptance.config.ts'),
            'utf-8',
          );

          expect(config).toContain(
            "globalSetup: './src/contract/autoprune.setup.jest.ts'",
          );
          expect(config).toContain(
            "globalTeardown: './src/contract/autoprune.teardown.jest.ts'",
          );
        });

        then('🔴 and the wire-up it declares reads as here', () => {
          // 🔴 the two `toContain` claims above grade the two lines they name
          // and are blind to a THIRD. this repo holds nine runner configs that
          // share no base, so the adoption cost is ten lines re-paid per config
          // — and a key ADDED here (or a hook pointed at a second module) is
          // exactly the drift that surface invites, with no line in a diff.
          //
          // .note = it snaps the autoprune LINES rather than the whole config,
          //         so an unrelated jest key (a coverage threshold, a timeout)
          //         does not conscript this export into its diff. the filter is
          //         the term this behavior owns
          const config = fs.readFileSync(
            path.join(__dirname, '../../../jest.acceptance.config.ts'),
            'utf-8',
          );

          expect(
            config
              .split('\n')
              .filter((line) => line.includes('autoprune'))
              .map((line) => line.trim())
              .join('\n'),
          ).toMatchSnapshot();
        });
      });

      when('[t1] the run this very test is inside was minted', () => {
        then('🔴 a run id reached this worker, so the setup hook RAN', () => {
          // .why = the config is a declaration; this is the observation. a key
          //        that pointed at a module which threw, no-opped, or failed to
          //        reach the fork would leave this undefined — and that is
          //        precisely the `assertMintChainHeld` failure mode, seen from
          //        the consumer's side rather than from ours
          expect(process.env[RUN_ID_ENV_KEY]).toMatch(/^r[a-f0-9]{8}$/);
        });
      });

      when(
        '[t2] this suite allocates a dir the way every test here does',
        () => {
          then(
            "🔴 it carries THIS run's stamp, so the teardown can match it",
            () => {
              // .why = the teardown reclaims by a NAME MATCH on the run id. a dir that
              //        landed unstamped is unreachable by it forever — the run ends,
              //        the filter matches zero, and the leak resumes under a green
              //        suite. this is the in-run half of that guarantee; the arrears
              //        check is the other half, and it can speak only on the NEXT run
              const run = process.env[RUN_ID_ENV_KEY];
              const name = path.basename(
                genTempDir({ slug: 'reclaim-reachable' }),
              );

              expect(run).toBeDefined();
              expect(name).toContain(`.${run}.`);
            },
          );
        },
      );
    },
  );

  // usecase.1: generate an ephemeral temp directory
  given('[case1] a test that needs a temporary directory', () => {
    when('[t0] genTempDir is called with a slug', () => {
      then('returns an absolute path to a new directory', () => {
        const dir = genTempDir({ slug: 'acceptance-test' });

        expect(path.isAbsolute(dir)).toBe(true);
      });

      then('the directory exists on the filesystem', () => {
        const dir = genTempDir({ slug: 'acceptance-test' });

        expect(fs.existsSync(dir)).toBe(true);
        expect(fs.statSync(dir).isDirectory()).toBe(true);
      });

      then('the directory is empty', () => {
        const dir = genTempDir({ slug: 'acceptance-test' });

        expect(fs.readdirSync(dir)).toHaveLength(0);
      });

      then('the directory path contains a timestamp prefix', () => {
        const dir = genTempDir({ slug: 'acceptance-test' });

        expect(isTempDir({ path: dir })).toBe(true);
      });

      then('the directory path contains the slug for debugging', () => {
        const dir = genTempDir({ slug: 'my-debug-slug' });

        expect(path.basename(dir)).toContain('.my-debug-slug.');
      });
    });

    when('[t2] we read the NAME it gave that directory', () => {
      then('🔴 the shape a human reads in failure output is as here', () => {
        // .why = 🔴 this behavior CHANGED this name — it folded a run stamp into it,
        //        and that name is what a human reads in a failed test's output, what
        //        the readme documents as `{timestamp}.{run}.{slug}.{8-char-uuid}`,
        //        and what the age gate must parse back (`case=14`). every assertion
        //        in this file saw it only through a FRAGMENT — `toContain('.slug.')`,
        //        `isTempDir(...)` — so a reorder of the segments, a lost separator,
        //        or a stamp that migrated one segment right would pass all of them.
        //
        //        those are the properties a fragment cannot see, and this is the one
        //        grain that reads them off the COMPILED artifact a consumer installs
        //        (`rule.require.acceptance-journey-coverage`)
        const name = path.basename(genTempDir({ slug: 'name-shape' }));

        // .note = every volatile segment is masked per-SEGMENT rather than by one
        //         blanket normalizer, so the export still fails on a segment that
        //         moved, vanished, or changed kind — which is what it is for
        const shape = name
          .replace(/^\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/, '<ts>')
          .replace(/\br[a-f0-9]{8}\b/, '<run>')
          .replace(/\.[a-f0-9]{8}$/, '.<hex>');

        expect(shape).toMatchSnapshot();

        // the functional half — the stamp must be PRESENT, since a name without one
        // is the broken-mint-chain state, and a masked export cannot tell a real
        // `<run>` from an absent segment it never had to mask
        expect(name).toMatch(/\.r[a-f0-9]{8}\./);
      });

      then(
        'and the SHIPPED readme documents the same shape it just made',
        () => {
          // .why = 🔴 this readme is rendered into every consumer's own contained dir
          //        on every run (`genIsolatedTempInfra`), so stale prose here is
          //        SHIPPED CODE, never a doc chore. a claim like *"directory names are
          //        prefixed with timestamps for age-based cleanup"* is half the truth:
          //        the name ALSO carries the run stamp that a run's OWN teardown
          //        matches on, so a consumer who reads it looks for the reclaim in the
          //        wrong place.
          //
          //        prose drifts one claim at a time, and a sweep that repairs two of a
          //        file's three claims leaves the third both green and wrong. this
          //        assertion reads the NAME FORMAT off the SHIPPED file, so that claim
          //        cannot outlive the shape it describes — which is why it is an
          //        assertion rather than a hand-check
          //
          // .note = the PHYSICAL root, never `path.dirname(dir)`. that is the symlink
          //         dir, and the readme lives at the target — a distinction worth the
          //         line to state, since the wrong one reads as an absent readme
          const dir = genTempDir({ slug: 'name-shape-readme' });
          const readme = fs.readFileSync(
            path.join(path.dirname(fs.realpathSync(dir)), 'readme.md'),
            'utf-8',
          );
          expect(readme).toContain('{timestamp}.{run}.{slug}.{8-char-uuid}');
        },
      );
    });

    when('[t1] genTempDir is called multiple times in quick succession', () => {
      then('each call returns a unique directory path', () => {
        const dirs = [
          genTempDir({ slug: 'multi-1' }),
          genTempDir({ slug: 'multi-2' }),
          genTempDir({ slug: 'multi-3' }),
        ];
        const uniqueDirs = new Set(dirs);
        expect(uniqueDirs.size).toBe(dirs.length);
      });
    });
  });

  // usecase.2: generate a temp directory from a fixture
  given('[case2] a test that needs a pre-populated directory', () => {
    const fixtureDir = path.join(__dirname, '.acceptance-test-fixture');

    beforeEach(() => {
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'config.json'), '{"key":"value"}');
      fs.mkdirSync(path.join(fixtureDir, 'nested'));
      fs.writeFileSync(
        path.join(fixtureDir, 'nested', 'data.txt'),
        'nested content',
      );
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when(
      '[t0] genTempDir is called with { slug, clone: "path/to/fixture" }',
      () => {
        then('returns an absolute path to a new directory', () => {
          const dir = genTempDir({ slug: 'clone-test', clone: fixtureDir });

          expect(path.isAbsolute(dir)).toBe(true);
        });

        then(
          'the directory contains a copy of all files from the fixture path',
          () => {
            const dir = genTempDir({ slug: 'clone-test', clone: fixtureDir });

            expect(fs.existsSync(path.join(dir, 'config.json'))).toBe(true);
            expect(fs.existsSync(path.join(dir, 'nested', 'data.txt'))).toBe(
              true,
            );
            expect(
              fs.readFileSync(path.join(dir, 'config.json'), 'utf-8'),
            ).toBe('{"key":"value"}');
          },
        );

        then('the original fixture directory is unchanged', () => {
          const dir = genTempDir({ slug: 'clone-test', clone: fixtureDir });

          // modify cloned file
          fs.writeFileSync(path.join(dir, 'config.json'), '{"modified":true}');

          // original unchanged
          expect(
            fs.readFileSync(path.join(fixtureDir, 'config.json'), 'utf-8'),
          ).toBe('{"key":"value"}');
        });

        then('🔴 and the TREE it produced reads as here', () => {
          // 🔴 every claim above is a per-PATH probe — `existsSync` on two files
          // whose names it already holds. so the one property a fixture clone is
          // FOR — *the tree arrived whole* — is beyond any probe at that grain:
          // a clone that also drops a stray file in, flattens the two levels
          // into one, or silently omits a third entry passes each `existsSync`
          // it is handed and is caught by not one of them.
          //
          // an export of the WALK reads what a per-path probe structurally
          // cannot: what is there that we did not think to ask about
          // (`rule.require.acceptance-journey-coverage`).
          const dir = genTempDir({ slug: 'clone-tree', clone: fixtureDir });

          // .note = relative + SORTED, so the export is a claim about the tree
          //         rather than about the order a filesystem happened to yield.
          //         `readdirSync(recursive)` order is not guaranteed stable
          //         across platforms, and an unsorted export would flake on the
          //         one property it is least meant to grade
          const tree = fs
            .readdirSync(dir, { recursive: true })
            .map((entry) => String(entry).split(path.sep).join('/'))
            .sort();

          expect(tree).toMatchSnapshot();
        });
      },
    );

    when(
      '[t1] genTempDir is called with a clone path that does not exist',
      () => {
        then(
          'throws a clear error that indicates the fixture path was not found',
          () => {
            expect(() =>
              genTempDir({
                slug: 'clone-test',
                clone: '/non/existent/fixture/path',
              }),
            ).toThrow(/fixture path not found/i);
          },
        );

        then('🔴 and the MESSAGE a human reads is as here', () => {
          // 🔴 the regex above grades six words of a message a human reads in
          // full. so the fix line, the metadata block, the path it echoes back
          // — every part that decides whether this error TEACHES rather than
          // merely reports — is ungraded, and a repair to any of them lands
          // with no line in a diff (`rule.require.errors-name-the-fix`).
          //
          // this is the same gap the message-family exports close at the
          // integration grain, read here off the artifact a consumer installs.
          const error = ((): Error => {
            try {
              genTempDir({
                slug: 'clone-shape',
                clone: '/non/existent/fixture/path',
              });
            } catch (thrown) {
              return thrown as Error;
            }
            // the guard's guard: a call that CEASED to throw would otherwise
            // export a masked `undefined` and read as a green snapshot
            throw new Error('genTempDir did not throw on an absent clone path');
          })();

          // 🔴 the root is DERIVED, never hand-masked. a literal `/tmp/test-fns`
          // mask leaves the next segment — the scope key, which is this
          // WORKTREE's directory name — verbatim in the export, so the clamp
          // reads green HERE and red on every other clone, worktree, and CI
          // checkout (`rule.require.hermetic-tests`).
          //
          // .note = it uses the very export the wish demanded, which makes this
          //         its own small proof of that export's point: *a consumer
          //         derives the path rather than hardcodes a literal a later
          //         change silently invalidates.* #66 re-keys this scope, and
          //         this mask follows the move rather than breaks on it
          //
          // 🔴 .note = the `from` path is NOT masked, and that is the rule
          //         rather than an exception to it:
          //
          //           mask what the CODE chose; never mask what the TEST chose.
          //
          //         `/non/existent/fixture/path` is the literal handed in four
          //         lines above, so the render echoes it back byte for byte on
          //         every machine, forever — it cannot churn, and it cannot
          //         print a stranger's directory (were the path to exist, this
          //         test would fail because no error is thrown at all, never by
          //         a leaked name). and the echo IS the assertion: this case
          //         exists to prove the error names the value at fault
          //         (`rule.require.errors-name-the-fix`). masked to `<path>` it
          //         would certify that the message holds SOME path, which is the
          //         one claim a reader already assumes.
          //
          //         the `to` field in the same export IS masked, and the two are
          //         consistent, not divergent — `to` is a fresh temp dir the
          //         CODE picks per run. same rule, opposite side of it.
          const { pathPhysical } = getOneTempDirRoot();

          expect(
            error.message
              .split(pathPhysical)
              .join('<tempRoot>')
              .split(process.cwd())
              .join('<cwd>')
              .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/g, '<ts>')
              .replace(/\br[a-f0-9]{8}\b/g, '<run>')
              .replace(/\.[a-f0-9]{8}(?=$|\D)/g, '.<hex>'),
          ).toMatchSnapshot();
        });
      },
    );
  });

  // boundary.1: edge cases
  given('[case3] the .temp directory does not yet exist at gitroot', () => {
    when('[t0] genTempDir is called', () => {
      then('the .temp directory is created automatically', () => {
        const dir = genTempDir({ slug: 'edge-case' });

        const tempDir = path.dirname(dir);
        expect(fs.existsSync(tempDir)).toBe(true);
        expect(tempDir).toContain('.temp');
      });

      then(
        'a readme.md is placed in .temp that explains the ttl policy',
        () => {
          const dir = genTempDir({ slug: 'edge-case' });

          const tempDir = path.dirname(dir);
          const readmePath = path.join(tempDir, 'readme.md');
          expect(fs.existsSync(readmePath)).toBe(true);
          expect(fs.readFileSync(readmePath, 'utf-8')).toContain(
            'cleanup policy',
          );
        },
      );

      then(
        '🔴 and the WHOLE doc a consumer finds in their own temp root reads as here',
        () => {
          // 🔴 this readme is SHIPPED PROSE, not a doc chore: `genIsolatedTempInfra`
          // upserts it into EVERY consumer's contained root on EVERY run, and its
          // whole cleanup-policy section is this behavior's to keep true. so a
          // consumer reads it more often than they read our readme.md.
          //
          // .why whole rather than fragment = a `toContain` check — `'cleanup
          //      policy'`, `'{timestamp}.{run}.{slug}.{8-char-uuid}'` — proves a
          //      token SURVIVES; it says no word about a lost line, a doubled key,
          //      a stale window, or a reworded policy. a stale claim among its
          //      three then reaches a human only by hand-check (`[case1] [t2]`'s
          //      own note) — which is the shape a snapshot exists to make automatic
          //
          // .note = no mask. the doc interpolates no value — `{repo}` in it is
          //         literal prose a consumer reads, not a value we substitute — so
          //         every byte here is chosen and every byte is reviewable
          const dir = genTempDir({ slug: 'readme-shape' });
          const readmePath = path.join(path.dirname(dir), 'readme.md');
          expect(fs.readFileSync(readmePath, 'utf-8')).toMatchSnapshot();
        },
      );

      then('a .gitignore is placed in .temp that ignores all files', () => {
        const dir = genTempDir({ slug: 'edge-case' });

        const tempDir = path.dirname(dir);
        const gitignorePath = path.join(tempDir, '.gitignore');
        expect(fs.existsSync(gitignorePath)).toBe(true);
        expect(fs.readFileSync(gitignorePath, 'utf-8').trim()).toBe('*');
      });
    });
  });

  given('[case4] a fixture directory with nested subdirectories', () => {
    const fixtureDir = path.join(__dirname, '.acceptance-test-nested-fixture');

    beforeEach(() => {
      fs.mkdirSync(path.join(fixtureDir, 'a', 'b', 'c'), { recursive: true });
      fs.writeFileSync(
        path.join(fixtureDir, 'a', 'b', 'c', 'deep.txt'),
        'deep',
      );
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when(
      '[t0] genTempDir is called with { slug, clone: "path/to/nested/fixture" }',
      () => {
        then('all nested files and directories are copied recursively', () => {
          const dir = genTempDir({ slug: 'nested-clone', clone: fixtureDir });

          expect(fs.existsSync(path.join(dir, 'a', 'b', 'c', 'deep.txt'))).toBe(
            true,
          );
          expect(
            fs.readFileSync(path.join(dir, 'a', 'b', 'c', 'deep.txt'), 'utf-8'),
          ).toBe('deep');
        });
      },
    );
  });

  // usecase.2: isolation from gitroot module resolution
  given('[case5] a temp directory created by genTempDir', () => {
    when('[t0] we check physical location', () => {
      then(
        'physical files are stored at /tmp/test-fns/{repo-dirname}/.temp/',
        () => {
          const dir = genTempDir({ slug: 'isolation-test' });

          // the returned path is the symlink path
          expect(dir).toContain('.temp/genTempDir.symlink/');

          // resolve symlink to get physical path
          const physicalPath = fs.realpathSync(dir);
          expect(physicalPath).toMatch(/^\/tmp\/test-fns\//);
          expect(physicalPath).toContain('/.temp/');
        },
      );

      then(
        '🔴 and BOTH views of the returned path are shaped as here — the symlink view is what it hands back, the physical view is where the bytes live',
        () => {
          // 🔴 the returned path is `genTempDir`'s PRIMARY output, and every check
          // on it above is a fragment: one `toContain` per view. a fragment proves
          // one token sits somewhere in the string — it cannot see segment ORDER,
          // a lost separator, or the two views SWAPPED, which is the mistake this
          // behavior's own vision records being made for real.
          //
          // .note = masked per SEGMENT, never by one blanket normalizer, so the
          //         record still fails on a path that moved between scopes, lost a
          //         segment, or changed kind (`rule.require.hermetic-tests` keeps
          //         it portable; the per-segment mask keeps it sharp)
          //
          // .note = the tokens are `<checkouts>` / `<tmp>` / `<repo>`, the SAME
          //         vocabulary `getOneTempDirRoot.integration` uses for the same
          //         three concepts. one term per concept across the snapshot
          //         family, so a reader who diffs two records is never asked
          //         which dialect they are in (`rule.forbid.ambiguous-labels`)
          const dir = genTempDir({ slug: 'path-shape' });
          const physicalPath = fs.realpathSync(dir);

          const gitRootAbs = dir.split(`${path.sep}.temp${path.sep}`)[0] ?? dir;
          const repo = path.basename(gitRootAbs);
          const checkouts = path.dirname(gitRootAbs);

          const asStable = (one: string): string =>
            one
              .split(checkouts)
              .join('<checkouts>')
              .split(os.tmpdir())
              .join('<tmp>')
              .split(repo)
              .join('<repo>')
              .replace(/\d{4}-\d{2}-\d{2}T[\d-]+\.\d+Z/, '<ts>')
              .replace(/\.r[a-f0-9]{8}\./, '.<run>.')
              .replace(/\.[a-f0-9]{8}$/, '.<hex>');

          const shapeStable = {
            returned: asStable(dir),
            resolved: asStable(physicalPath),
            returnedIsTheSymlinkView: dir !== physicalPath,
          };

          // the guard's guard: a mask that failed to fire leaves a home dir or a
          // checkout name in the record, and the snapshot passes here while it
          // fails on every other machine. this is not hypothetical — the first
          // render of THIS export leaked `<home>/git/ehmpathy/_worktrees`
          expect(shapeStable.returned).not.toContain(os.homedir());
          expect(shapeStable.resolved).not.toContain(os.homedir());
          expect(shapeStable.returned).not.toContain(repo);
          expect(shapeStable.resolved).not.toContain(repo);

          expect(shapeStable).toMatchSnapshot();
        },
      );
    });

    when(
      '[t1] we search upward for node_modules from within the temp dir',
      () => {
        then('no node_modules is found in any ancestor directory', () => {
          const dir = genTempDir({ slug: 'nodemodules-test' });

          // resolve to physical path and search upward
          const physicalPath = fs.realpathSync(dir);

          // walk up from physical path, stop at /tmp
          let currentDir = physicalPath;
          while (currentDir !== '/tmp' && currentDir !== '/') {
            const nodeModulesPath = path.join(currentDir, 'node_modules');
            const hasNodeModules = fs.existsSync(nodeModulesPath);
            expect(hasNodeModules).toBe(false);
            currentDir = path.dirname(currentDir);
          }
        });
      },
    );

    when(
      '[t2] we search upward for package.json from within the temp dir',
      () => {
        then('no package.json is found in any ancestor directory', () => {
          const dir = genTempDir({ slug: 'packagejson-test' });

          // resolve to physical path and search upward
          const physicalPath = fs.realpathSync(dir);

          // walk up from physical path, stop at /tmp
          let currentDir = physicalPath;
          while (currentDir !== '/tmp' && currentDir !== '/') {
            const packageJsonPath = path.join(currentDir, 'package.json');
            const hasPackageJson = fs.existsSync(packageJsonPath);
            expect(hasPackageJson).toBe(false);
            currentDir = path.dirname(currentDir);
          }
        });
      },
    );
  });

  // usecase.3: discoverability via symlink at gitroot
  given('[case6] symlink at gitroot', () => {
    when('[t0] we check @gitroot/.temp/genTempDir.symlink/', () => {
      then('it is a symlink', () => {
        const dir = genTempDir({ slug: 'symlink-check' });

        // extract symlink parent from returned path
        const symlinkDir = path.dirname(dir);
        expect(fs.lstatSync(symlinkDir).isSymbolicLink()).toBe(true);
      });

      then('symlink target is within /tmp/', () => {
        const dir = genTempDir({ slug: 'symlink-target' });

        const symlinkDir = path.dirname(dir);
        const target = fs.readlinkSync(symlinkDir);
        expect(target).toMatch(/^\/tmp\//);
      });
    });

    when('[t1] we list contents via symlink', () => {
      then('temp directories are visible', () => {
        const dir = genTempDir({ slug: 'visible-via-symlink' });

        const symlinkDir = path.dirname(dir);
        const dirName = path.basename(dir);

        // list via symlink path (not physical)
        const contents = fs.readdirSync(symlinkDir);
        expect(contents).toContain(dirName);
      });
    });
  });

  // boundary.1: /tmp/ validation
  // note: cannot test /tmp/ absence in acceptance test (would require root to remove)
  // this is verified in genIsolatedTempInfra integration tests
  given('[case7] /tmp/ exists on the system', () => {
    when('[t0] we verify /tmp/ requirement', () => {
      then('/tmp/ directory exists (unix system requirement)', () => {
        expect(fs.existsSync('/tmp')).toBe(true);
        expect(fs.statSync('/tmp').isDirectory()).toBe(true);
      });
    });
  });

  // usecase.4: git repository initialization
  given('[case8] a test that needs a git repo', () => {
    const fixtureDir = path.join(__dirname, '.acceptance-test-git-fixture');

    beforeEach(() => {
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'readme.md'), '# test');
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when('[t0] genTempDir is called with { git: true }', () => {
      then('returns a valid git repository', () => {
        const { execSync } = require('node:child_process');
        const dir = genTempDir({ slug: 'git-test', git: true });

        // .git exists
        expect(fs.existsSync(path.join(dir, '.git'))).toBe(true);

        // git rev-parse succeeds
        const result = execSync('git rev-parse --git-dir', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(result.trim()).toBe('.git');
      });

      then('git log shows began commit', () => {
        const { execSync } = require('node:child_process');
        const dir = genTempDir({ slug: 'git-began-test', git: true });

        const log = execSync('git log --oneline', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(log).toContain('began');
      });
    });

    when('[t1] genTempDir is called with { git: true, clone }', () => {
      then('git log shows began and fixture commits', () => {
        const { execSync } = require('node:child_process');
        const dir = genTempDir({
          slug: 'git-fixture-test',
          clone: fixtureDir,
          git: true,
        });

        const log = execSync('git log --oneline', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(log).toContain('began');
        expect(log).toContain('fixture');
      });

      then('work tree is clean after return', () => {
        const { execSync } = require('node:child_process');
        const dir = genTempDir({
          slug: 'git-clean-test',
          clone: fixtureDir,
          git: true,
        });

        const status = execSync('git status --porcelain', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(status.trim()).toBe('');
      });
    });
  });

  given('[case9] a test that needs an uninitialized git repo', () => {
    const fixtureDir = path.join(__dirname, '.acceptance-test-git-noinit');

    beforeEach(() => {
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'file.txt'), 'content');
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when(
      '[t0] genTempDir is called with { git: { commits: { init: false } } }',
      () => {
        then('git repo exists but has no commits', () => {
          const { execSync } = require('node:child_process');
          const dir = genTempDir({
            slug: 'git-noinit-test',
            git: { commits: { init: false } },
          });

          // git repo exists
          expect(fs.existsSync(path.join(dir, '.git'))).toBe(true);

          // no commits
          expect(() => {
            execSync('git log --oneline', { cwd: dir, stdio: 'pipe' });
          }).toThrow();
        });
      },
    );
  });

  given('[case10] a test that needs fixture content uncommitted', () => {
    const fixtureDir = path.join(__dirname, '.acceptance-test-git-nofixture');

    beforeEach(() => {
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureDir, 'file.txt'), 'content');
    });

    afterEach(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    when(
      '[t0] genTempDir is called with { clone, git: { commits: { fixture: false } } }',
      () => {
        then('began commit exists but files are uncommitted', () => {
          const { execSync } = require('node:child_process');
          const dir = genTempDir({
            slug: 'git-nofixture-test',
            clone: fixtureDir,
            git: { commits: { fixture: false } },
          });

          // began commit exists
          const log = execSync('git log --oneline', {
            cwd: dir,
            encoding: 'utf-8',
          });
          expect(log).toContain('began');
          expect(log).not.toContain('fixture');

          // files are untracked
          const status = execSync('git status --porcelain', {
            cwd: dir,
            encoding: 'utf-8',
          });
          expect(status).toContain('??');
        });
      },
    );
  });

  given('[case11] a test that needs git repo without clone', () => {
    when('[t0] genTempDir is called with { git: true } and no clone', () => {
      then('only began commit exists (no fixture commit)', () => {
        const { execSync } = require('node:child_process');
        const dir = genTempDir({ slug: 'git-nocontent-test', git: true });

        const log = execSync('git log --oneline', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(log).toContain('began');
        expect(log).not.toContain('fixture');

        // only one commit
        const commitCount = execSync('git rev-list --count HEAD', {
          cwd: dir,
          encoding: 'utf-8',
        });
        expect(commitCount.trim()).toBe('1');
      });
    });
  });

  given(
    '[case12] the four git states a caller can reach, rendered side by side',
    () => {
      // 🔴 cases 8–11 above each assert their own state with `toContain`
      // fragments, and a fragment is functional verification — never
      // observability. the four states differ from one another in exactly the
      // bytes those fragments do not read: the ORDER of the log lines, the
      // presence of a second commit, whether the tree is clean or `??`.
      //
      // .why ONE snapshot rather than four = the claim is COMPARATIVE. what a
      //      caller needs to know is how `{ git: true }` differs from
      //      `{ git: true, clone }`, and a reader cannot diff four exports in
      //      four places. rendered together, a regression that made two states
      //      converge shows as one moved block rather than as two green tests
      //
      // .why the hash is MASKED and not carved out = a commit sha is volatile,
      //      and the rule's remedy for a volatile byte is a mask over a live
      //      render — never an assertion that declines to look. carved out, a
      //      log that emitted its subject line twice would read identically
      const fixtureDir = path.join(__dirname, '.acceptance-test-git-states');

      beforeEach(() => {
        fs.mkdirSync(fixtureDir, { recursive: true });
        fs.writeFileSync(path.join(fixtureDir, 'file.txt'), 'content');
      });

      afterEach(() => {
        if (fs.existsSync(fixtureDir))
          fs.rmSync(fixtureDir, { recursive: true, force: true });
      });

      when('[t0] each is driven through the contract', () => {
        then('🔴 the four read as here, and differ from one another', () => {
          const { execSync } = require('node:child_process');

          /**
           * .what = one dir's git surface, with every volatile byte masked
           * .why = the short sha is the ONLY volatile byte in this output, and
           *        it is masked at a width that admits git's own variable
           *        abbreviation — a fixed 7 would redden on a repo large
           *        enough to need 8
           */
          const asGitSurface = (
            dir: string,
          ): { log: string; status: string } => {
            const read = (cmd: string): string => {
              try {
                return String(
                  execSync(cmd, {
                    cwd: dir,
                    encoding: 'utf-8',
                    stdio: 'pipe',
                  }),
                ).trim();
              } catch {
                // `git log` on a repo with no commits EXITS NONZERO, and that
                // is one of the four states — so the throw is the render
                return '<exits nonzero>';
              }
            };
            return {
              log: read('git log --oneline').replace(
                /^[0-9a-f]{7,40} /gm,
                '<sha> ',
              ),
              status: read('git status --porcelain'),
            };
          };

          // .note = each key names the STATE it produced, never the input literal
          //         that produced it. the third row is driven by
          //         `git: { commits: { fixture: false } }`, and it is labelled
          //         `git: true … left untracked` on purpose: git IS on there, and
          //         `left untracked` is what `fixture: false` amounts to. that
          //         keeps rows 2 and 3 symmetric, so the ONE axis they differ on
          //         reads at a glance — which is the whole reason the four are
          //         rendered in one snapshot rather than four. do not "correct" a
          //         key back toward its input shape: the input is already visible
          //         two lines below it, and the label is what a reader diffs
          const rendered = {
            'git: true, no clone': asGitSurface(
              genTempDir({ slug: 'states-bare', git: true }),
            ),
            'git: true, clone — committed': asGitSurface(
              genTempDir({
                slug: 'states-clone',
                clone: fixtureDir,
                git: true,
              }),
            ),
            'git: true, clone — left untracked': asGitSurface(
              genTempDir({
                slug: 'states-nofixture',
                clone: fixtureDir,
                git: { commits: { fixture: false } },
              }),
            ),
            'clone, NO git — not a repo at all': asGitSurface(
              genTempDir({ slug: 'states-noinit', clone: fixtureDir }),
            ),
          };

          // paired with the snapshot, per probe 1 — a snapshot alone is
          // rewritten green on a dev machine, so the DISTINCTIONS carry
          // assertions of their own
          expect(rendered['git: true, no clone'].log).toContain('<sha> began');
          expect(rendered['git: true, no clone'].log).not.toContain('fixture');
          expect(rendered['git: true, clone — committed'].status).toEqual('');
          expect(
            rendered['git: true, clone — left untracked'].status,
          ).toContain('??');
          expect(rendered['clone, NO git — not a repo at all'].log).toEqual(
            '<exits nonzero>',
          );

          // 🔴 and no two of the four are the same render. without this, a
          // regression that collapsed two states would leave every assertion
          // above green — each still holds of a merged state
          const distinct = new Set(
            Object.values(rendered).map((one) => JSON.stringify(one)),
          );
          expect(distinct.size).toEqual(4);

          expect(rendered).toMatchSnapshot();
        });
      });
    },
  );
});
