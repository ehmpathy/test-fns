import { given, then, when } from '../../contract';
import { isTempDir } from './genTempDir';

describe('isTempDir', () => {
  given('a path that matches temp dir pattern', () => {
    when('isTempDir is called', () => {
      then('it returns true for valid temp dir paths', () => {
        expect(
          isTempDir({
            path: '/repo/.temp/2026-01-19T12-34-56.789Z.my-test.a1b2c3d4',
          }),
        ).toBe(true);

        expect(
          isTempDir({
            path: '/any/path/2026-01-19T00-00-00.000Z.some-slug.00000000',
          }),
        ).toBe(true);

        // physical /tmp/ path also works
        expect(
          isTempDir({
            path: '/tmp/test-fns/my-repo/.temp/2026-01-19T12-34-56.789Z.my-test.a1b2c3d4',
          }),
        ).toBe(true);

        expect(
          isTempDir({ path: '2025-12-31T23-59-59.999Z.test.ffffffff' }),
        ).toBe(true);
      });
    });
  });

  given('a path that does not match temp dir pattern', () => {
    when('isTempDir is called', () => {
      then('it returns false for invalid paths', () => {
        expect(isTempDir({ path: '/tmp/random' })).toBe(false);
        expect(isTempDir({ path: '/repo/.temp/invalid-dir' })).toBe(false);
        expect(isTempDir({ path: '' })).toBe(false);
        expect(isTempDir({ path: 'not-a-temp-dir' })).toBe(false);
        expect(
          isTempDir({ path: '2026-01-19T12:34:56.789Z.test.a1b2c3d4' }),
        ).toBe(false); // colons instead of dashes
      });
    });
  });
});
