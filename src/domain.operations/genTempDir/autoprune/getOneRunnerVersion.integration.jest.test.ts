/**
 * .what = clamps the one fact a broken-chain report exists to hand a maintainer
 * .why = 🔴 this operation had NO test at all. it reads a foreign manifest off disk
 *        on the FAILURE path of a report — so its own defects surface only when
 *        something else has already gone wrong, which is the worst moment to learn
 *        that the version line reads `jest` where it should read `jest@30.2.0`
 *
 * .note = an INTEGRATION test, never a unit one. it reads `node_modules/*` off the
 *         filesystem — a remote boundary — so a unit test could reach it only
 *         through a mock of `fs`, which would prove the mock and not the read
 *         (`rule.forbid.unit.remote-boundaries`, `rule.require.test-coverage-by-grain`)
 */
import { genTempDir, given, then, when } from '@src/contract';

import { getOneRunnerVersion } from './getOneRunnerVersion';

describe('getOneRunnerVersion', () => {
  given('[case1] a runner installed under the working directory', () => {
    when('[t0] the version is read for jest', () => {
      then('it names the runner AND its version, joined by an @', () => {
        // .why = the bare name is the FALLBACK; a report that silently degraded to
        //        it would send a maintainer to hunt the very fact this call exists
        //        to supply. so the happy path must be asserted as a shape, never as
        //        a mere non-empty string
        expect(getOneRunnerVersion({ runner: 'jest' })).toMatch(
          /^jest@\d+\.\d+\.\d+/,
        );
      });
    });

    when('[t1] the version is read for vitest', () => {
      then('it names that runner and its own version', () => {
        // .why = the two runners are read through one code path, so a defect that
        //        hardcoded either name would pass a single-runner clamp
        expect(getOneRunnerVersion({ runner: 'vitest' })).toMatch(
          /^vitest@\d+\.\d+\.\d+/,
        );
      });
    });

    when('[t2] both are read', () => {
      then("🔴 they do not report one another's name or version", () => {
        const versionJest = getOneRunnerVersion({ runner: 'jest' });
        const versionVitest = getOneRunnerVersion({ runner: 'vitest' });

        expect(versionJest).not.toEqual(versionVitest);
        expect(versionJest).not.toContain('vitest');
        expect(versionVitest.startsWith('vitest@')).toEqual(true);
      });
    });
  });

  given('[case2] a working directory with no node_modules at that path', () => {
    // .why = the fallback is NOT dead code, though both members of the TestRunner
    //        union are installed here. a consumer under pnpm's strict layout, yarn
    //        pnp, or a monorepo hoist has a cwd where `./node_modules/<runner>` is
    //        absent — and that consumer is exactly who reads this report
    //
    // .note = reached by a real cwd with no manifest, never by a cast to a runner
    //         name outside the union. a cast would drive a value the type forbids,
    //         so it would prove a path no caller can reach (`rule.forbid.as-cast`)
    when('[t0] the version is read', () => {
      then('it falls back to the bare runner name, never throws', () => {
        // .why = it runs on the failure path of a report. a throw here would
        //        replace a diagnosis with a second, unrelated crash — and the
        //        human would lose the finding the report was written to deliver
        const dirEmpty = genTempDir({ slug: 'runner-version-fallback' });
        const cwdBefore = process.cwd();

        const version = ((): string => {
          try {
            // .note = process-wide, so it is restored in a `finally` below. a leak
            //         of the cwd would move every later test's relative path
            process.chdir(dirEmpty);
            return getOneRunnerVersion({ runner: 'jest' });
          } finally {
            process.chdir(cwdBefore);
          }
        })();

        expect(version).toEqual('jest');
      });
    });
  });
});
