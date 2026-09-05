/**
 * .what = clamps the HOLD hatch — the one legitimate reason to leave residue is a
 *         human who is about to read it
 * .why = 🔴 the hold branch is the one this file exists to assert. `TEST_FNS_KEEP` is
 *        otherwise reached by a single check that the shipped readme MENTIONS it —
 *        which clamps the documentation of a hatch no test ever opens. the `held`
 *        marker state sits where `partial` sits: declared, written, branched on, and
 *        driven by no test
 *
 * .note = the two acts are clamped in ONE flow on purpose. a test that only
 *         asserts "the dirs survived" cannot tell a hatch that held from a
 *         reclaim that broke — both leave the dirs. so the same run then drops
 *         the key and reclaims, which pins that the hatch is what kept them
 *
 * .note = it drives the env in-process, and restores it in a `finally`. the run id
 *         is process-wide, so a leak of it here would strand the OUTER run's dirs —
 *         the same hazard that pushed the J1 clamp into a child process. this one
 *         stays in-process because it never mints through `setupAutoprune`, so the
 *         blast radius is one env key we own end to end
 */
import { genTempDir, given, then, useThen, when } from '@src/contract';

import * as fs from 'node:fs';
import { genRunId, RUN_ID_ENV_KEY } from '../getOneRunId';
import { getOneTempDirRoot } from '../getOneTempDirRoot';
import { genRunMarkerOpen, getOneRunMarker, setRunMarker } from '../runMarker';
import { KEEP_ENV_KEY, teardownAutoprune } from './teardownAutoprune';

/**
 * .what = restores one env key to the value it held before, whatever that was
 * .why = this clamp drives TWO keys across TWO acts, so its `finally` carried four
 *        branches — enough to push the flow past the cognitive-complexity bound. a
 *        named operation drops all four out of the function under test
 *
 * .note = two explicit ifs, never an if/else — an else's condition is implicit
 *         (`rule.forbid.else-branches`)
 */
const setEnvAsBefore = (input: {
  key: string;
  before: string | undefined;
}): void => {
  if (input.before === undefined) delete process.env[input.key];
  if (input.before !== undefined) process.env[input.key] = input.before;
};

/** captures console.error across one awaited act, then restores it */
const getAllLinesSpoken = async (
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

describe('teardownAutoprune — the hold hatch', () => {
  given(
    '[case1] a wired run that allocated dirs, with the hold key set',
    () => {
      when(
        '[t0] the teardown fires, then fires again with the key dropped',
        () => {
          const outcome = useThen(
            'the whole flow completes',
            async (): Promise<{
              run: string;
              dirs: string[];
              linesHeld: string[];
              dirsAliveAfterHold: boolean[];
              stateAfterHold: string | null;
              dirsAliveAfterDrop: boolean[];
              markerAfterDrop: unknown;
            }> => {
              const { pathPhysical } = getOneTempDirRoot();
              const runBefore = process.env[RUN_ID_ENV_KEY];
              const keepBefore = process.env[KEEP_ENV_KEY];
              const run = genRunId();

              try {
                // stand up a run of our own: an env id, a marker, and two dirs
                process.env[RUN_ID_ENV_KEY] = run;
                setRunMarker({
                  tmpDir: pathPhysical,
                  marker: genRunMarkerOpen({ run, teardownWired: true }),
                });
                const dirs = [
                  genTempDir({ slug: 'hold-clamp-a' }),
                  genTempDir({ slug: 'hold-clamp-b' }),
                ];

                // act 1 — the HOLD
                process.env[KEEP_ENV_KEY] = '1';
                const linesHeld = await getAllLinesSpoken(
                  async () => await teardownAutoprune({ runner: 'jest' }),
                );
                const dirsAliveAfterHold = dirs.map((dir) =>
                  fs.existsSync(dir),
                );
                const stateAfterHold =
                  getOneRunMarker({ tmpDir: pathPhysical, run })?.state ?? null;

                // act 2 — the key is dropped, and the SAME run reclaims
                delete process.env[KEEP_ENV_KEY];
                await teardownAutoprune({ runner: 'jest' });
                const dirsAliveAfterDrop = dirs.map((dir) =>
                  fs.existsSync(dir),
                );
                const markerAfterDrop = getOneRunMarker({
                  tmpDir: pathPhysical,
                  run,
                });

                return {
                  run,
                  dirs,
                  linesHeld,
                  dirsAliveAfterHold,
                  stateAfterHold,
                  dirsAliveAfterDrop,
                  markerAfterDrop,
                };
              } finally {
                // restore BOTH keys, whatever happened — a leaked run id would
                // strand the outer run's own fixture dirs
                setEnvAsBefore({ key: RUN_ID_ENV_KEY, before: runBefore });
                setEnvAsBefore({ key: KEEP_ENV_KEY, before: keepBefore });
              }
            },
          );

          then('guard the guard: the run really did allocate two dirs', () => {
            // .why = every assertion below reads these two paths. were the setup to
            //        allocate zero, "they survived" and "they were reclaimed" would
            //        both hold vacuously, forever
            expect(outcome.dirs).toHaveLength(2);
            expect(outcome.dirs[0]).toContain(outcome.run);
            expect(outcome.dirs[1]).toContain(outcome.run);
          });

          then('🔴 the hold KEPT every dir the run made', () => {
            expect(outcome.dirsAliveAfterHold).toEqual([true, true]);
          });

          then(
            '🔴 it settled the marker as `held`, never left it `open`',
            () => {
              // .why = `held` is how the NEXT run tells a deliberate hold from a
              //        casualty. left `open`, this run would be reported as one whose
              //        teardown never fired — a false accusation on a healthy run
              expect(outcome.stateAfterHold).toEqual('held');
            },
          );

          then('it told the human WHERE they are, and what kept them', () => {
            const spoken = outcome.linesHeld.join('\n');
            expect(spoken).toContain(KEEP_ENV_KEY);
            expect(spoken).toContain(outcome.run);
            expect(spoken).toContain(getOneTempDirRoot().pathPhysical);
          });

          then('it named the age gate as the bound on the hold', () => {
            // .why = a hatch with no bound is a leak with a nicer name. the message
            //        must say the residue is reclaimed rather than kept forever
            expect(outcome.linesHeld.join('\n')).toContain('age gate');
          });

          then(
            '🔴 the same run then RECLAIMED them once the key was dropped',
            () => {
              // .why = this is the discrimination. without it, a reclaim that was
              //        simply broken would pass every assertion above
              expect(outcome.dirsAliveAfterDrop).toEqual([false, false]);
              expect(outcome.markerAfterDrop).toEqual(null);
            },
          );
        },
      );
    },
  );
});
