import { ConstraintError } from 'helpful-errors';

import { genTempDir, given, then, useThen, when } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { isTempDir } from './isTempDir';
import {
  delRunMarker,
  genRunMarkerOpen,
  getAllRunMarkers,
  getOneRunMarker,
  isRunMarkerName,
  type RunMarker,
  setRunMarker,
} from './runMarker';

describe('runMarker', () => {
  given('a run about to begin', () => {
    // .note = 🔴 it settles to `held`, never to a `closed` state. no production
    //         path writes one — the clean settle is REMOVAL — so an assertion on
    //         `closed` proves only that setRunMarker can write whatever string a
    //         test hands it. a test that exercises a state the code cannot reach is
    //         the green-and-blind shape this whole behavior exists to end
    when('it marks itself open, then settles', () => {
      const scene = useThen('the marker rides the run', () => {
        const tmpDir = genTempDir({ slug: 'run-marker-test' });
        const marker = genRunMarkerOpen({
          run: 'r7f3a91c2',
          teardownWired: true,
        });
        setRunMarker({ tmpDir, marker });
        const markerOpen = getOneRunMarker({ tmpDir, run: 'r7f3a91c2' });
        setRunMarker({ tmpDir, marker: { ...marker, state: 'held' } });
        const markerHeld = getOneRunMarker({ tmpDir, run: 'r7f3a91c2' });
        delRunMarker({ tmpDir, run: 'r7f3a91c2' });
        const markerAfterClean = getOneRunMarker({ tmpDir, run: 'r7f3a91c2' });
        return { tmpDir, markerOpen, markerHeld, markerAfterClean };
      });

      then(
        'the open marker records the run, its pid, and when it began',
        () => {
          expect(scene.markerOpen?.run).toEqual('r7f3a91c2');
          expect(scene.markerOpen?.pid).toEqual(process.pid);
          expect(
            Date.parse(scene.markerOpen?.startedAt ?? ''),
          ).toBeLessThanOrEqual(Date.now());
        },
      );

      then('it opens unreported, with no residue', () => {
        expect(scene.markerOpen?.state).toEqual('open');
        expect(scene.markerOpen?.reportedAt).toBeNull();
        expect(scene.markerOpen?.residue).toEqual([]);
      });

      then('a HELD settle overwrites the state in place', () => {
        // .why = a held run keeps its dirs, so its marker must survive to say so
        expect(scene.markerHeld?.state).toEqual('held');
        expect(scene.markerHeld?.run).toEqual('r7f3a91c2');
      });

      then('a CLEAN settle removes the marker rather than restates it', () => {
        // .why = the wish counts ENTRIES, not dirs. a terminal state written to
        //        disk would leave one file per clean run — on the COMMON path,
        //        which is the worst place to put a permanent residue
        expect(scene.markerAfterClean).toBeNull();
      });
    });
  });

  given('a marker on disk beside the fixture dirs', () => {
    when('the root is read', () => {
      const scene = useThen('a marker is written', () => {
        const tmpDir = genTempDir({ slug: 'run-marker-shape' });
        setRunMarker({
          tmpDir,
          marker: genRunMarkerOpen({ teardownWired: true, run: 'rdeadbeef' }),
        });
        const names = fs.readdirSync(tmpDir);
        const nameMarker =
          names.find((name) => isRunMarkerName({ name })) ?? '';
        return { tmpDir, names, nameMarker };
      });

      then('the marker is a FILE, never a directory', () => {
        expect(scene.nameMarker).not.toEqual('');
        expect(
          fs.statSync(path.join(scene.tmpDir, scene.nameMarker)).isFile(),
        ).toBe(true);
      });

      then('its name sits OUTSIDE the fixture pattern', () => {
        expect(isTempDir({ path: scene.nameMarker })).toBe(false);
      });

      then('the marker sweep does not claim readme.md or .gitignore', () => {
        expect(isRunMarkerName({ name: 'readme.md' })).toBe(false);
        expect(isRunMarkerName({ name: '.gitignore' })).toBe(false);
      });
    });
  });

  given('several runs, one of whose markers is half-written', () => {
    when('every marker is read', () => {
      const scene = useThen('the markers are laid down', () => {
        const tmpDir = genTempDir({ slug: 'run-marker-readall' });
        setRunMarker({
          tmpDir,
          marker: genRunMarkerOpen({ teardownWired: true, run: 'raaaaaaaa' }),
        });
        setRunMarker({
          tmpDir,
          marker: genRunMarkerOpen({ teardownWired: true, run: 'rbbbbbbbb' }),
        });
        fs.writeFileSync(
          path.join(tmpDir, 'run.rccccccc1.marker.json'),
          '{ "run": "rccccccc1", "pi',
          'utf8',
        );
        return { tmpDir, markers: getAllRunMarkers({ tmpDir }) };
      });

      then('it yields one entry per marker file', () => {
        expect(scene.markers).toHaveLength(3);
      });

      then('the whole markers parse', () => {
        const runs = scene.markers
          .map((entry) => entry.marker?.run)
          .filter((run): run is string => !!run);
        expect(runs.sort()).toEqual(['raaaaaaaa', 'rbbbbbbbb']);
      });

      then('the half-written one is yielded as null, never dropped', () => {
        const entryTorn = scene.markers.find(
          (entry) => entry.name === 'run.rccccccc1.marker.json',
        );
        expect(entryTorn).toBeDefined();
        expect(entryTorn?.marker).toBeNull();
      });
    });
  });

  given('a marker whose residue list holds a malformed entry', () => {
    // .why = the residue is the ONE field a human is sent to act on — the arrears
    //        report prints `${errno}: ${path}` from it, so an unchecked element
    //        reaches them as `undefined: undefined` and addresses them nowhere.
    //        every OTHER field of this record is checked by type; this one was
    //        checked only for its ARRAY-NESS, so a marker that seems whole could
    //        carry junk past a validator whose stated job is to reject a partial
    when('the marker is read', () => {
      const scene = useThen('the markers are laid down', () => {
        const tmpDir = genTempDir({ slug: 'run-marker-residue-shape' });
        // .note = typed, never cast. an `as never` here would let this fixture drift
        //         out of the shape the validator under test accepts, so the clamp
        //         would grade a record no production writer could produce
        const markerWhole: RunMarker = {
          ...genRunMarkerOpen({ teardownWired: true, run: 'rddddddd1' }),
          state: 'partial',
          residue: [{ path: '/tmp/x', errno: 'EACCES' }],
        };
        setRunMarker({ tmpDir, marker: markerWhole });

        // the same record, but its one residue entry lacks an errno
        fs.writeFileSync(
          path.join(tmpDir, 'run.rddddddd2.marker.json'),
          JSON.stringify({
            ...markerWhole,
            run: 'rddddddd2',
            residue: [{ path: '/tmp/y' }],
          }),
          'utf8',
        );

        return {
          markerWhole: getOneRunMarker({ tmpDir, run: 'rddddddd1' }),
          markerJunk: getOneRunMarker({ tmpDir, run: 'rddddddd2' }),
        };
      });

      then('guard the guard: a WHOLE residue entry still parses', () => {
        // .why = a validator that rejects every input would pass the assertion
        //        below while it breaks the residue report this field exists for
        expect(scene.markerWhole?.residue).toHaveLength(1);
        expect(scene.markerWhole?.residue[0]?.errno).toEqual('EACCES');
      });

      then('🔴 the malformed one reads as unparseable, never as whole', () => {
        expect(scene.markerJunk).toBeNull();
      });
    });
  });

  given('a marker file that cannot be read', () => {
    // .why = 🔴 every marker but our own belongs to ANOTHER RUN, and a peer's
    //        teardown removes its own marker the moment it finishes. so between
    //        our readdir and our read, a file can genuinely vanish. an unguarded
    //        read would throw out of `globalSetup` and kill the whole run before
    //        one test executes — a peer's SUCCESSFUL finish would destroy live
    //        work, the one failure mode this design keeps off the table everywhere
    //        else, since every other path fails toward LEAK and never toward LOSS
    when('every marker is read', () => {
      const scene = useThen('one marker is made unreadable', () => {
        const tmpDir = genTempDir({ slug: 'run-marker-unreadable' });
        setRunMarker({
          tmpDir,
          marker: genRunMarkerOpen({ teardownWired: true, run: 'r99999999' }),
        });
        const pathSealed = path.join(tmpDir, 'run.rvanished1.marker.json');
        fs.writeFileSync(pathSealed, '{}', 'utf8');
        fs.chmodSync(pathSealed, 0o000);

        // the setup must actually bite, so say so loudly when it cannot
        const sealHolds = ((): boolean => {
          try {
            fs.readFileSync(pathSealed, 'utf8');
            return false;
          } catch {
            return true;
          }
        })();
        if (!sealHolds)
          ConstraintError.throw(
            'this clamp needs a file it cannot read, and the seal did not hold',
            {
              pathSealed,
              uid: process.getuid?.() ?? null,
              hint: 'a root process reads through mode 000 — run this suite unprivileged',
            },
          );

        const markers = getAllRunMarkers({ tmpDir });
        fs.chmodSync(pathSealed, 0o600);
        return { tmpDir, markers };
      });

      then('the read does not throw', () => {
        expect(scene.markers).toHaveLength(2);
      });

      then('the unreadable marker is yielded as null, never dropped', () => {
        const entrySealed = scene.markers.find(
          (entry) => entry.name === 'run.rvanished1.marker.json',
        );
        expect(entrySealed).toBeDefined();
        expect(entrySealed?.marker).toBeNull();
      });

      then('the readable marker beside it still parses', () => {
        const entryWhole = scene.markers.find(
          (entry) => entry.marker?.run === 'r99999999',
        );
        expect(entryWhole?.marker?.state).toEqual('open');
      });
    });
  });

  given('a marker that has been settled and swept', () => {
    when('it is deleted twice', () => {
      const scene = useThen('the delete runs twice', () => {
        const tmpDir = genTempDir({ slug: 'run-marker-del' });
        setRunMarker({
          tmpDir,
          marker: genRunMarkerOpen({ teardownWired: true, run: 'r11111111' }),
        });
        delRunMarker({ tmpDir, run: 'r11111111' });
        delRunMarker({ tmpDir, run: 'r11111111' });
        return { tmpDir };
      });

      then('the marker is gone', () => {
        expect(
          getOneRunMarker({ tmpDir: scene.tmpDir, run: 'r11111111' }),
        ).toBeNull();
      });

      then('the second delete was a no-op, never an error', () => {
        expect(getAllRunMarkers({ tmpDir: scene.tmpDir })).toEqual([]);
      });
    });
  });

  given('a run id no mint could ever produce', () => {
    // 🔴 the second pole of the run-id guard. `computeTempDirName` asserts its own
    // output parses back, so an unstampable id cannot reach a DIRECTORY name — and
    // the MARKER path is the only other way a run id reaches disk, so it is the
    // pole this closes
    //
    // the cost of an open pole here is real and it hides well: a fixture id like
    // `rhalfwire`, `rbeganxx1` or `rtornwrite` renders into a snapshot a reviewer
    // reads as product output, and it is invisible precisely because a marker never
    // passes through the mint — the one place that would refuse it
    //
    // .why it is a THROW rather than a lint = a fixture author gets the answer at
    //      the moment of the write, from the product itself, rather than from a
    //      reviewer many rounds later. that is the same trade `case=14` made
    when('it is handed to setRunMarker', () => {
      const scene = useThen('the write is refused', () => {
        const tmpDir = genTempDir({ slug: 'run-marker-unmintable' });
        const refusal = ((): Error => {
          try {
            setRunMarker({
              tmpDir,
              // 'w' and 'i' are not hex — the exact shape a hand-rolled fixture
              // takes whenever its author reaches for a mnemonic run id
              marker: genRunMarkerOpen({
                teardownWired: true,
                run: 'rhalfwire',
              }),
            });
          } catch (caught) {
            if (!(caught instanceof Error)) throw caught;
            return caught;
          }
          // guard the guard: an absent throw would leave this case green while
          // the pole it exists to close stayed open
          throw new Error('setRunMarker accepted an unmintable run id');
        })();
        return { tmpDir, refusal };
      });

      then('it names the id it refused, and the shape it wanted', () => {
        expect(scene.refusal.message).toContain('no mint could produce');
        expect(scene.refusal.message).toContain('rhalfwire');
        expect(scene.refusal.message).toContain('r[a-f0-9]{8}');
      });

      then('🔴 and the WHOLE message a human reads is shaped as here', () => {
        // 🔴 the THIRD refusal in one family, and the one snapped HERE. the other
        // two — a slug shaped like a run stamp, and a run id env var that is not a
        // run id — are snapped whole in `autoprune.exports.acceptance` `[case5c]`.
        // the three fragments above cannot hold this one alone.
        //
        // .why such a gap is predictable = *when a repair closes one member of a
        //      family, the members it did not touch are where the next gap is.*
        //      two members that share a file get swept together; a third that
        //      sits in another file does not
        //
        // .why a fragment is not enough = the three above prove three spans
        //      survived. they cannot see the metadata block's shape, a lost
        //      `hint`, a duplicated label, or a reworded lead — each of which
        //      reaches a human with no line in any diff to read it by
        //
        // .why NO mask = every byte here is a literal this test chose
        //      (`rhalfwire`) or a constant the product owns. there is no
        //      timestamp, no pid, no path, and no minted id — so the record is
        //      deterministic, and this claim is written AFTER its first render
        //      rather than ahead of it
        //
        // 🔴 the general form, since this is the second site to need it:
        //
        //        mask what the CODE chose; never mask what the TEST chose.
        //
        //      a value the code produces churns per run and must be masked. a
        //      value the test hands in is echoed back AS the assertion, so a
        //      mask over it certifies a shape and drops the claim. here that
        //      cost is stark: masked to `<run>`, this export would read as a
        //      run id refused for a pattern breach WITH THE BREACH HIDDEN —
        //      `rhalfwire` is `r` plus 8, so it meets the length the `hint`
        //      names and fails only on the alphabet. the refusal is legible
        //      only while the value sits beside the rule it breaks.
        expect(scene.refusal.message).toMatchSnapshot();
      });

      then('and it wrote NO marker — refused before the write', () => {
        // a partial write would leave the very artifact the guard exists to
        // forbid, and the arrears check would then read it as evidence
        expect(getAllRunMarkers({ tmpDir: scene.tmpDir })).toEqual([]);
      });
    });
  });
});
