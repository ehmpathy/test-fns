import { given, then, when } from '@src/contract';

import { computeStaleDirs, type DirEntry } from './computeStaleDirs';

const ONE_HOUR_MS: number = 60 * 60 * 1000;

describe('computeStaleDirs', () => {
  given('an empty list of directories', () => {
    when('computeStaleDirs is called', () => {
      then('it returns empty verdicts', () => {
        const judged = computeStaleDirs({
          dirs: [],
          maxAgeMs: ONE_HOUR_MS,
          now: new Date('2026-01-19T14:00:00.000Z'),
        });
        expect(judged.stale).toEqual([]);
        expect(judged.unreadable).toEqual([]);
      });
    });
  });

  given('directories with various ages', () => {
    const now = new Date('2026-01-19T14:00:00.000Z');
    const twoHoursAgo = '2026-01-19T12-00-00.000Z.stale-test.a1b2c3d4'; // stale
    const thirtyMinsAgo = '2026-01-19T13-30-00.000Z.recent-test.b2c3d4e5'; // recent
    const fiveHoursAgo = '2026-01-19T09-00-00.000Z.old-test.c3d4e5f6'; // stale

    const dirs: DirEntry[] = [
      { name: twoHoursAgo, path: `/tmp/.temp/${twoHoursAgo}` },
      { name: thirtyMinsAgo, path: `/tmp/.temp/${thirtyMinsAgo}` },
      { name: fiveHoursAgo, path: `/tmp/.temp/${fiveHoursAgo}` },
    ];

    when('filtered with 1 hour threshold', () => {
      then('it returns directories older than threshold', () => {
        const judged = computeStaleDirs({ dirs, maxAgeMs: ONE_HOUR_MS, now });

        expect(judged.stale).toHaveLength(2);
        expect(judged.stale.map((d) => d.name)).toContain(twoHoursAgo);
        expect(judged.stale.map((d) => d.name)).toContain(fiveHoursAgo);
      });

      then('it preserves directories newer than threshold', () => {
        const judged = computeStaleDirs({ dirs, maxAgeMs: ONE_HOUR_MS, now });

        expect(judged.stale.map((d) => d.name)).not.toContain(thirtyMinsAgo);
      });
    });
  });

  given('a stamped directory name', () => {
    const now = new Date('2026-01-19T14:00:00.000Z');
    const stampedOld = '2026-01-19T10-00-00.000Z.r7f3a91c2.my-test.a1b2c3d4';

    when('filtered', () => {
      then('the run stamp does not blind the age gate', () => {
        const judged = computeStaleDirs({
          dirs: [{ name: stampedOld, path: `/tmp/.temp/${stampedOld}` }],
          maxAgeMs: ONE_HOUR_MS,
          now,
        });

        expect(judged.stale.map((d) => d.name)).toEqual([stampedOld]);
        expect(judged.unreadable).toEqual([]);
      });
    });
  });

  given('directories with invalid timestamp formats', () => {
    const now = new Date('2026-01-19T14:00:00.000Z');
    const validOld = '2026-01-19T10-00-00.000Z.valid-test.a1b2c3d4';
    const invalidFormat = 'random-folder-name';
    const anotherInvalid = 'not-a-timestamp.12345678';

    const dirs: DirEntry[] = [
      { name: validOld, path: `/tmp/.temp/${validOld}` },
      { name: invalidFormat, path: `/tmp/.temp/${invalidFormat}` },
      { name: anotherInvalid, path: `/tmp/.temp/${anotherInvalid}` },
    ];

    when('filtered', () => {
      then('it preserves dirs with invalid timestamp format', () => {
        const judged = computeStaleDirs({ dirs, maxAgeMs: ONE_HOUR_MS, now });

        // only the valid old dir is a reap candidate
        expect(judged.stale).toHaveLength(1);
        expect(judged.stale[0]?.name).toEqual(validOld);
      });

      then('it REPORTS what it could not read, rather than hide it', () => {
        const judged = computeStaleDirs({ dirs, maxAgeMs: ONE_HOUR_MS, now });

        expect(judged.unreadable.map((d) => d.name).sort()).toEqual(
          [anotherInvalid, invalidFormat].sort(),
        );
      });
    });
  });
});
