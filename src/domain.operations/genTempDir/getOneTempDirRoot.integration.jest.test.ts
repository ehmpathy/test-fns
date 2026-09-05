import { given, then, useThen, when } from '@src/contract';

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { genTempDir } from './genTempDir';
import { getOneTempDirRoot } from './getOneTempDirRoot';
import { isTempDir } from './isTempDir';

describe('getOneTempDirRoot', () => {
  given('a consumer who wants to count the dirs genTempDir makes', () => {
    when('they derive the root, then allocate a dir', () => {
      const scene = useThen('the root is derived and a dir allocated', () => {
        const root = getOneTempDirRoot();
        const dir = genTempDir({ slug: 'root-export-test' });
        return { root, dir };
      });

      then('the root yields both views of one place', () => {
        expect(fs.existsSync(scene.root.pathPhysical)).toBe(true);
        expect(fs.existsSync(scene.root.pathSymlink)).toBe(true);
        expect(fs.realpathSync(scene.root.pathSymlink)).toEqual(
          fs.realpathSync(scene.root.pathPhysical),
        );
      });

      then('the dir genTempDir made sits inside the derived root', () => {
        const dirName = path.basename(scene.dir);
        expect(fs.existsSync(path.join(scene.root.pathPhysical, dirName))).toBe(
          true,
        );
      });

      then('genTempDir yields the SYMLINK view, never the physical one', () => {
        // .why = the two views name one place, so a consumer reasonably assumes
        //        either compares. it does not: `path.dirname(genTempDir(...))`
        //        equals pathSymlink and NEVER equals pathPhysical. that is the
        //        whole reason the export yields both rather than choose — and it
        //        is a mistake made for real while this behavior was built
        expect(path.dirname(scene.dir)).toEqual(scene.root.pathSymlink);
        expect(path.dirname(scene.dir)).not.toEqual(scene.root.pathPhysical);
      });

      then('a count filtered through isTempDir sees it', () => {
        const dirName = path.basename(scene.dir);
        const namesTemp = fs
          .readdirSync(scene.root.pathPhysical)
          .filter((name) => isTempDir({ path: name }));
        expect(namesTemp).toContain(dirName);
      });

      then('a RAW entry count would have counted the infra files too', () => {
        const namesAll = fs.readdirSync(scene.root.pathPhysical);
        expect(namesAll).toContain('readme.md');
        expect(namesAll).toContain('.gitignore');
        expect(namesAll.length).toBeGreaterThan(
          namesAll.filter((name) => isTempDir({ path: name })).length,
        );
      });

      then(
        '🔴 and the RECORD of what the export yields is shaped as here — RICHER than its acceptance twin, since this grain alone owns the LIVE view relationship',
        () => {
          // 🔴 the WHY rides in the test NAME, and that placement is the fix. this
          // record and `autoprune.exports.acceptance`'s `[case5]` snapshot the SAME
          // export at two grains, so a reader who diffs them must be able to tell a
          // real divergence from an incidental one:
          //
          //   | | this grain (integration) | the twin (acceptance) |
          //   |---|---|---|
          //   | shape | + `keys` + two relationship flags | the bare two-key record |
          //   | why | the LIVE derivation is here, so the relationship IS the subject | it crosses `dist/`, so the compiled SHAPE is the subject |
          //   | checkout root | `<checkouts>` | `<checkouts>` — the SAME token, on purpose |
          //
          // 🔴 that last row is the SAME token on both, and must stay so. a `<tmp>`
          // on the twin — whose fixture mints its repo under the os temp dir —
          // would mask that root by LOCATION while this file masks it by ROLE: one
          // field, two vocabularies. do NOT split them apart: the twin's `/tmp`
          // fills the checkouts role there, and `<checkouts>` is that role's name.
          //
          // a `.note` here would not reach the reader who raises it: a snapshot
          // reviewer opens the `.snap`, and a jest snapshot key IS the test name.
          // 🔴 every claim above is an `expect`, so the export's own SHAPE — that
          // it yields a two-key record, and which key is which — lands in no
          // reviewable artifact at the grain where the live derivation happens.
          // a rename, a dropped key, or a swap of the two values would go red on
          // an assertion whose message names a path, never the contract.
          //
          // .why masked = both values are machine-specific by construction. the
          //      mask is PER SEGMENT rather than one blanket normalizer, so the
          //      record keeps every structural part — `test-fns/<repo>/.temp`
          //      under the os temp dir, `<repo>/.temp/…` under the checkout —
          //      while it drops only the bytes that differ per machine. so it is
          //      hermetic AND still red on a root that moved, lost a segment, or
          //      changed its kind (`rule.require.hermetic-tests`)
          //
          // .note = the mask parts are DERIVED from the values, never hardcoded.
          //         a hardcoded worktree name is the same non-portability defect
          //         one layer down, and it passes on the machine that wrote it
          const repo = path.basename(path.dirname(scene.root.pathPhysical));
          const checkouts = path.dirname(
            scene.root.pathSymlink.split(`${path.sep}.temp${path.sep}`)[0] ??
              scene.root.pathSymlink,
          );
          const asStable = (one: string): string =>
            one
              .split(checkouts)
              .join('<checkouts>')
              .split(os.tmpdir())
              .join('<tmp>')
              .split(repo)
              .join('<repo>');

          const shapeStable = {
            pathPhysical: asStable(scene.root.pathPhysical),
            pathSymlink: asStable(scene.root.pathSymlink),
            keys: Object.keys(scene.root).sort(),
            viewsNameOnePlace:
              fs.realpathSync(scene.root.pathSymlink) ===
              fs.realpathSync(scene.root.pathPhysical),
            viewsAreNotInterchangeable:
              scene.root.pathSymlink !== scene.root.pathPhysical,
          };

          // the guard's guard: a mask that failed to fire would leave a home dir
          // or a worktree name in the record, and the snapshot would pass here
          // and fail on every other machine
          expect(shapeStable.pathPhysical).not.toContain(os.homedir());
          expect(shapeStable.pathSymlink).not.toContain(os.homedir());
          expect(shapeStable.pathPhysical).not.toContain(repo);
          expect(shapeStable.pathSymlink).not.toContain(repo);

          expect(shapeStable).toMatchSnapshot();
        },
      );
    });
  });
});
