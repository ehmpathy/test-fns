/**
 * .what = test fixture with fast tests
 * .why = used to verify slowtest reporter handles fast tests
 */
import { given, when, then } from '../../../../../contract';

describe('fast suite', () => {
  given('[case1] instant setup', () => {
    when('[t0] fast test', () => {
      then('instant', () => {
        expect(1 + 1).toBe(2);
      });
    });

    when('[t1] another fast test', () => {
      then('also instant', () => {
        expect('hello').toContain('ell');
      });
    });
  });

  given('[case2] another fast scenario', () => {
    when('[t0] quick test', () => {
      then('completes quickly', () => {
        expect([1, 2, 3]).toHaveLength(3);
      });
    });
  });
});
