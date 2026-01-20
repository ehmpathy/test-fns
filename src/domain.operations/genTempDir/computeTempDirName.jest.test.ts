import { given, then, when } from '../../contract';
import {
  computeTempDirName,
  parseTempDirTimestamp,
} from './computeTempDirName';

describe('computeTempDirName', () => {
  given('computeTempDirName is called', () => {
    when('invoked', () => {
      then('it returns a string with iso timestamp prefix', () => {
        const dirName = computeTempDirName();
        expect(dirName).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\./,
        );
      });

      then('timestamp is parseable as a date', () => {
        const dirName = computeTempDirName();
        const parsed = parseTempDirTimestamp({ dirName });
        expect(parsed).toBeInstanceOf(Date);
        expect(parsed?.getTime()).toBeLessThanOrEqual(Date.now());
      });

      then('it includes 8-char uuid suffix', () => {
        const dirName = computeTempDirName();
        expect(dirName).toMatch(/\.[a-f0-9]{8}$/i);
      });

      then('it returns unique value on each call', () => {
        const dirName1 = computeTempDirName();
        const dirName2 = computeTempDirName();
        expect(dirName1).not.toEqual(dirName2);
      });
    });
  });
});

describe('parseTempDirTimestamp', () => {
  given('a valid temp directory name', () => {
    when('parsed', () => {
      then('it returns the correct date', () => {
        const dirName = '2026-01-19T12-34-56.789Z.a1b2c3d4';
        const parsed = parseTempDirTimestamp({ dirName });
        expect(parsed).toBeInstanceOf(Date);
        expect(parsed?.toISOString()).toEqual('2026-01-19T12:34:56.789Z');
      });
    });
  });

  given('an invalid directory name', () => {
    when('parsed', () => {
      then('it returns null for malformed names', () => {
        expect(
          parseTempDirTimestamp({ dirName: 'not-a-valid-dir' }),
        ).toBeNull();
        expect(parseTempDirTimestamp({ dirName: 'random-folder' })).toBeNull();
        expect(parseTempDirTimestamp({ dirName: '' })).toBeNull();
      });

      then('it returns null for names with invalid timestamps', () => {
        expect(
          parseTempDirTimestamp({ dirName: 'invalid-date.a1b2c3d4' }),
        ).toBeNull();
      });
    });
  });
});
