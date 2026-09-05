/**
 * .what = clamps the TEARDOWN's two loud branches: the residue report (case=9) and
 *         the "teardown ran, setup did not" diagnosis (case=7's teardown-side half)
 * .why = 🔴 both were undriven. `pruneRun` had a residue case, so the AUDIT was
 *        clamped — but the teardown's REACTION to that audit was not: no test
 *        asserted that it speaks, that it carries the residue onto the marker for
 *        the next run, or that it declines to throw. and the no-run-id branch, the
 *        one half-wired state a `globalTeardown` can diagnose about ITSELF, had no
 *        assertion at all
 *
 * .note = the two branches share a file because they share the property that earns
 *         them a clamp: each is a message a human reads INSTEAD OF a crash. an
 *         unasserted message is prose, and prose drifts
 *
 * .note = the seal trick (chmod 0o500 on a populated dir) is the one already proven
 *         by `pruneRun.integration.jest.test.ts`. it is unsealed in a `finally`, so
 *         a red assertion cannot strand an unreclaimable dir on the machine
 */
import { genTempDir, given, then, useThen, when } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeTempDirName } from '../computeTempDirName';
import { genRunId, RUN_ID_ENV_KEY } from '../getOneRunId';
import { getOneTempDirRoot } from '../getOneTempDirRoot';
import {
  delRunMarker,
  genRunMarkerOpen,
  getOneRunMarker,
  setRunMarker,
} from '../runMarker';
import { teardownAutoprune } from './teardownAutoprune';

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

describe('teardownAutoprune — the loud branches', () => {
  given('[case1] a run one of whose dirs will not delete', () => {
    when('[t0] the teardown fires', () => {
      const outcome = useThen(
        'it completes rather than throw',
        async (): Promise<{
          run: string;
          lines: string[];
          dirOkAlive: boolean;
          dirStuckAlive: boolean;
          stateAfter: string | null;
          residueAfter: Array<{ path: string; errno: string }>;
        }> => {
          const { pathPhysical } = getOneTempDirRoot();
          const runBefore = process.env[RUN_ID_ENV_KEY];
          const run = genRunId();
          let pathSealed: string | null = null;

          try {
            process.env[RUN_ID_ENV_KEY] = run;
            setRunMarker({
              tmpDir: pathPhysical,
              marker: genRunMarkerOpen({ run, teardownWired: true }),
            });
            const dirOk = genTempDir({ slug: 'residue-clamp-ok' });
            const dirStuck = genTempDir({ slug: 'residue-clamp-stuck' });

            // seal the stuck dir so its removal is refused with EACCES
            pathSealed = path.join(dirStuck, 'sealed');
            fs.mkdirSync(pathSealed, { recursive: true });
            fs.writeFileSync(path.join(pathSealed, 'child.txt'), 'x', 'utf8');
            fs.chmodSync(pathSealed, 0o500);

            const lines = await getAllLinesSpoken(
              async () => await teardownAutoprune({ runner: 'jest' }),
            );

            const marker = getOneRunMarker({ tmpDir: pathPhysical, run });
            return {
              run,
              lines,
              dirOkAlive: fs.existsSync(dirOk),
              dirStuckAlive: fs.existsSync(dirStuck),
              stateAfter: marker?.state ?? null,
              residueAfter: marker?.residue ?? [],
            };
          } finally {
            // 🔴 unseal, THEN remove. this clamp deliberately makes a dir the run's
            // own reclaim cannot take — and that dir carries a run id no LATER run
            // will ever match, so without this line it survives until the 24h age
            // gate. a clamp for a leak that leaks one dir per run is the defect it
            // exists to catch, and the repo's acid test is what caught it
            if (pathSealed) {
              fs.chmodSync(pathSealed, 0o700);
              fs.rmSync(path.dirname(pathSealed), {
                recursive: true,
                force: true,
              });
            }

            // and the MARKER too. a residue teardown deliberately LEAVES its marker
            // `partial`, so the next run can print what this one may not live to say
            // — correct in prod, and a leaked file per run here. the acid test read
            // `8 files -> 9` and named it
            delRunMarker({ tmpDir: pathPhysical, run });

            if (runBefore === undefined) delete process.env[RUN_ID_ENV_KEY];
            if (runBefore !== undefined)
              process.env[RUN_ID_ENV_KEY] = runBefore;
          }
        },
      );

      then('guard the guard: the seal really did refuse the removal', () => {
        // .why = were the seal ineffective (a root user, an exotic filesystem),
        //        every assertion below would clamp the CLEAN path while it claims
        //        to clamp the residue path — green, and blind
        expect(outcome.dirStuckAlive).toEqual(true);
      });

      then('it reaped the rest FIRST, rather than stop at the refusal', () => {
        expect(outcome.dirOkAlive).toEqual(false);
      });

      then('🔴 it spoke the residue LOUD, with the path and the reason', () => {
        const spoken = outcome.lines.join('\n');
        expect(spoken).toContain('could not reclaim');
        expect(spoken).toContain('EACCES');
        expect(spoken).toContain('residue-clamp-stuck');
      });

      then('it named the fix, never only the symptom', () => {
        expect(outcome.lines.join('\n')).toContain('fix:');
      });

      then(
        '🔴 it CARRIED the residue onto the marker for the next run to print',
        () => {
          // .why = this run may not live long enough to be heard — the report goes
          //        to stderr, which a killed CI job discards. the marker is the
          //        durable copy, and it is why `partial` outlives the run
          expect(outcome.stateAfter).toEqual('partial');
          expect(outcome.residueAfter).toHaveLength(1);
          expect(outcome.residueAfter[0]?.errno).toEqual('EACCES');
          expect(outcome.residueAfter[0]?.path).toContain(
            'residue-clamp-stuck',
          );
        },
      );

      then('🔴 it did NOT throw — loud, and non-fatal', () => {
        // .why = the vision settled this class the same way at case=6 [t2]: "a leak
        //        is not worth a broken pipeline". a reclaim that fails a green run
        //        over one age-gate-bounded dir trains consumers to UNWIRE the hooks,
        //        which loses the whole behavior to guard against a benign residue.
        //        the `useThen` above would have surfaced any throw as a red block
        expect(outcome.run).toMatch(/^r[a-f0-9]{8}$/);
      });
    });
  });

  given('[case2] a config with a globalTeardown but NO globalSetup', () => {
    when('[t0] the teardown fires with no run id to its name', () => {
      const outcome = useThen(
        'it completes rather than reclaim blind',
        async (): Promise<{ lines: string[]; dirPeerAlive: boolean }> => {
          const { pathPhysical } = getOneTempDirRoot();
          const runBefore = process.env[RUN_ID_ENV_KEY];

          // a peer's live dir, to prove an id-less teardown reaps not one dir
          const namePeer = computeTempDirName({
            slug: 'unhooked-peer',
            run: 'r99887766',
          });
          const pathPeer = path.join(pathPhysical, namePeer);

          try {
            fs.mkdirSync(pathPeer, { recursive: true });
            delete process.env[RUN_ID_ENV_KEY];

            const lines = await getAllLinesSpoken(
              async () => await teardownAutoprune({ runner: 'jest' }),
            );
            return { lines, dirPeerAlive: fs.existsSync(pathPeer) };
          } finally {
            fs.rmSync(pathPeer, { recursive: true, force: true });
            if (runBefore === undefined) delete process.env[RUN_ID_ENV_KEY];
            if (runBefore !== undefined)
              process.env[RUN_ID_ENV_KEY] = runBefore;
          }
        },
      );

      then('🔴 it says its own SETUP did not run', () => {
        // .why = a teardown can diagnose exactly one config defect about itself:
        //        that its own setup is absent. `isTeardownWired` covers the mirror
        //        case (a setup with no teardown), and this covers the other half
        const spoken = outcome.lines.join('\n');
        expect(spoken).toContain('SETUP did not');
        expect(spoken).toContain('half-wired');
      });

      then('it named the fix — add the setup to THIS runner config', () => {
        expect(outcome.lines.join('\n')).toContain('fix:');
      });

      then(
        '🔴 it reclaimed not one dir — it declines rather than reap blind',
        () => {
          // .why = with no id of its own, every dir in the root belongs to someone
          //        else. a teardown that swept anyway would reap a LIVE PEER — the
          //        one failure mode this design keeps off the table everywhere else
          expect(outcome.dirPeerAlive).toEqual(true);
        },
      );
    });
  });

  given('[case3] a run whose mint chain broke, so the teardown throws', () => {
    when('[t0] the teardown fires and the chain guard rejects it', () => {
      const outcome = useThen(
        'it throws rather than reclaim zero in silence',
        async (): Promise<{ threw: boolean; stateAfter: string | null }> => {
          const { pathPhysical } = getOneTempDirRoot();
          const runBefore = process.env[RUN_ID_ENV_KEY];
          const run = genRunId();

          // an ORPHAN — a dir made since we began that carries NO run id. with
          // zero dirs of our own beside it, that is the broken-chain signature
          const nameOrphan = computeTempDirName({
            slug: 'partial-on-throw-orphan',
            run: null,
          });
          const pathOrphan = path.join(pathPhysical, nameOrphan);

          try {
            process.env[RUN_ID_ENV_KEY] = run;

            // the run BEGAN a minute ago, which is the real shape: a global setup
            // mints the marker, then test files allocate dirs over the run's life.
            // .note = a marker minted THIS instant would make the orphan's mtime and
            //         `since` land in one filesystem tick, and the guard's `>=` is
            //         deliberately strict — it fails toward SILENCE over a false
            //         accusation. so a same-tick setup clamps the guard's tie-break
            //         rather than the broken chain it means to clamp
            setRunMarker({
              tmpDir: pathPhysical,
              marker: {
                ...genRunMarkerOpen({ run, teardownWired: true }),
                startedAt: new Date(Date.now() - 60 * 1000).toISOString(),
              },
            });
            fs.mkdirSync(pathOrphan, { recursive: true });

            const threw = await (async (): Promise<boolean> => {
              try {
                await teardownAutoprune({ runner: 'jest' });
                return false;
              } catch {
                return true;
              }
            })();

            const marker = getOneRunMarker({ tmpDir: pathPhysical, run });
            return { threw, stateAfter: marker?.state ?? null };
          } finally {
            fs.rmSync(pathOrphan, { recursive: true, force: true });
            delRunMarker({ tmpDir: pathPhysical, run });
            if (runBefore === undefined) delete process.env[RUN_ID_ENV_KEY];
            if (runBefore !== undefined)
              process.env[RUN_ID_ENV_KEY] = runBefore;
          }
        },
      );

      then('guard the guard: the chain guard really did reject it', () => {
        // .why = were the orphan setup ineffective, the assertion below would
        //        clamp a teardown that ran to completion while it claims to clamp
        //        one that threw part way — green, and blind
        expect(outcome.threw).toEqual(true);
      });

      then(
        '🔴 it left the marker `partial`, never `open` — the teardown BEGAN',
        () => {
          // .why = `partial` means "the teardown began", and it must be written
          //        AHEAD of every step that can end the process — a throw included.
          //        left `open`, the next run's arrears report tells the human "its
          //        teardown never ran", which sends them to audit a wire-up that
          //        was never at fault while the cause sat in a runner upgrade. that
          //        is cell 25's defect exactly, reached by a throw rather than a
          //        signal — so the write-ahead rule must cover the guard too
          expect(outcome.stateAfter).toEqual('partial');
        },
      );
    });
  });
});
