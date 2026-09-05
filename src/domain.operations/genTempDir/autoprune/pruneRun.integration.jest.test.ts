import { genTempDir, given, then, useThen, when } from '@src/contract';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeTempDirName } from '../computeTempDirName';
import { genRunMarkerOpen, setRunMarker } from '../runMarker';
import { pruneRun } from './pruneRun';

/**
 * .what = lays down a fixture dir stamped with a given run id
 * .why = lets a test stage two runs' dirs side by side, in one root
 */
const genStampedDir = (input: {
  tmpDir: string;
  run: string | null;
  slug: string;
}): string => {
  const name = computeTempDirName({ slug: input.slug, run: input.run });
  fs.mkdirSync(path.join(input.tmpDir, name), { recursive: true });
  return name;
};

describe('pruneRun', () => {
  given('two runs whose dirs share one root', () => {
    when('run A reclaims', () => {
      const scene = useThen('run A reclaims its own', async () => {
        const tmpDir = genTempDir({ slug: 'prune-run-peers' });
        const dirOfA = genStampedDir({ tmpDir, run: 'raaaaaaaa', slug: 'a' });
        const dirOfB = genStampedDir({ tmpDir, run: 'rbbbbbbbb', slug: 'b' });
        const audit = await pruneRun({ tmpDir, run: 'raaaaaaaa' });
        return { tmpDir, dirOfA, dirOfB, audit };
      });

      then('run A took its own dir', () => {
        expect(scene.audit.reclaimed).toEqual([scene.dirOfA]);
        expect(fs.existsSync(path.join(scene.tmpDir, scene.dirOfA))).toBe(
          false,
        );
      });

      then("run B's live dir is untouched", () => {
        expect(fs.existsSync(path.join(scene.tmpDir, scene.dirOfB))).toBe(true);
      });

      then("run A never even CONSIDERED run B's dirs", () => {
        expect(scene.audit.candidatesConsidered).not.toContain(scene.dirOfB);
        expect(scene.audit.candidatesConsidered).toEqual([scene.dirOfA]);
      });
    });
  });

  given('a root that holds unstamped dirs and our infra files', () => {
    when('a run reclaims', () => {
      const scene = useThen('the reclaim runs', async () => {
        const tmpDir = genTempDir({ slug: 'prune-run-unstamped' });
        const dirUnstamped = genStampedDir({
          tmpDir,
          run: null,
          slug: 'plain',
        });
        const dirOfUs = genStampedDir({
          tmpDir,
          run: 'rccccccc1',
          slug: 'ours',
        });
        setRunMarker({
          tmpDir,
          marker: genRunMarkerOpen({ teardownWired: true, run: 'rccccccc1' }),
        });

        // stage the two files genIsolatedTempInfra writes into every real root
        fs.writeFileSync(path.join(tmpDir, 'readme.md'), '# temp', 'utf8');
        fs.writeFileSync(path.join(tmpDir, '.gitignore'), '*\n', 'utf8');

        const audit = await pruneRun({ tmpDir, run: 'rccccccc1' });
        return { tmpDir, dirUnstamped, dirOfUs, audit };
      });

      then('it took only the dir its own id stamps', () => {
        expect(scene.audit.reclaimed).toEqual([scene.dirOfUs]);
      });

      then('an unstamped dir is not a candidate', () => {
        expect(scene.audit.candidatesConsidered).not.toContain(
          scene.dirUnstamped,
        );
        expect(fs.existsSync(path.join(scene.tmpDir, scene.dirUnstamped))).toBe(
          true,
        );
      });

      then('it does not eat its own marker, nor the infra files', () => {
        const names = fs.readdirSync(scene.tmpDir);
        expect(names).toContain('readme.md');
        expect(names).toContain('.gitignore');
        expect(names).toContain('run.rccccccc1.marker.json');
      });
    });
  });

  given('a run whose dirs include one that will not delete', () => {
    when('it reclaims', () => {
      const scene = useThen('the reclaim meets residue', async () => {
        const tmpDir = genTempDir({ slug: 'prune-run-residue' });
        const dirOk = genStampedDir({ tmpDir, run: 'rdddddddd', slug: 'ok' });
        const dirStuck = genStampedDir({
          tmpDir,
          run: 'rdddddddd',
          slug: 'stuck',
        });

        // make the stuck dir resist removal: seal its PARENT against writes
        const pathSealed = path.join(tmpDir, dirStuck, 'sealed');
        fs.mkdirSync(pathSealed, { recursive: true });
        fs.writeFileSync(path.join(pathSealed, 'child.txt'), 'x', 'utf8');
        fs.chmodSync(pathSealed, 0o500);

        const audit = await pruneRun({ tmpDir, run: 'rdddddddd' });

        // unseal, so the age gate can reclaim it later
        fs.chmodSync(pathSealed, 0o700);
        return { tmpDir, dirOk, dirStuck, audit };
      });

      then('it considered BOTH of its own dirs', () => {
        expect(scene.audit.candidatesConsidered.sort()).toEqual(
          [scene.dirOk, scene.dirStuck].sort(),
        );
      });

      then('it reaped the rest FIRST, rather than stop at the refusal', () => {
        expect(scene.audit.reclaimed).toContain(scene.dirOk);
        expect(fs.existsSync(path.join(scene.tmpDir, scene.dirOk))).toBe(false);
      });

      then('it named the residue, with the reason', () => {
        expect(scene.audit.residue).toHaveLength(1);
        expect(scene.audit.residue[0]?.path).toContain(scene.dirStuck);
        expect(scene.audit.residue[0]?.errno).toEqual('EACCES');
      });
    });
  });

  given('a run that allocated no dir at all', () => {
    when('it reclaims', () => {
      const scene = useThen('the reclaim runs empty', async () => {
        const tmpDir = genTempDir({ slug: 'prune-run-empty' });
        return { audit: await pruneRun({ tmpDir, run: 'reeeeeeee' }) };
      });

      then('it renders a verdict rather than throw', () => {
        expect(scene.audit.candidatesConsidered).toEqual([]);
        expect(scene.audit.reclaimed).toEqual([]);
        expect(scene.audit.residue).toEqual([]);
      });
    });
  });
});
