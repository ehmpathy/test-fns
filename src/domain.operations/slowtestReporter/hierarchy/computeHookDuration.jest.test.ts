import { given, then, when } from '../../../contract';
import { computeHookDuration } from './computeHookDuration';

describe('computeHookDuration', () => {
  given(
    '[case1] block with children that sum to less than block duration',
    () => {
      when('[t0] compute is called', () => {
        then('returns the difference', () => {
          const result = computeHookDuration({
            blockDuration: 1000,
            childDurations: [200, 300],
          });
          expect(result).toEqual(500);
        });
      });
    },
  );

  given(
    '[case2] block with children that sum to exactly block duration',
    () => {
      when('[t0] compute is called', () => {
        then('returns 0', () => {
          const result = computeHookDuration({
            blockDuration: 1000,
            childDurations: [500, 500],
          });
          expect(result).toEqual(0);
        });
      });
    },
  );

  given('[case3] block with children that exceed block duration', () => {
    when('[t0] compute is called', () => {
      then('returns 0 (clamped, not negative)', () => {
        const result = computeHookDuration({
          blockDuration: 1000,
          childDurations: [600, 600],
        });
        expect(result).toEqual(0);
      });
    });
  });

  given('[case4] block with no children', () => {
    when('[t0] compute is called', () => {
      then('returns full block duration', () => {
        const result = computeHookDuration({
          blockDuration: 500,
          childDurations: [],
        });
        expect(result).toEqual(500);
      });
    });
  });

  given('[case5] block with single child', () => {
    when('[t0] compute is called', () => {
      then('returns correct difference', () => {
        const result = computeHookDuration({
          blockDuration: 800,
          childDurations: [300],
        });
        expect(result).toEqual(500);
      });
    });
  });
});
