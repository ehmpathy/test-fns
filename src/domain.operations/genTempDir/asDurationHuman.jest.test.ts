import { given, then, when } from '@src/contract';

import { asDurationHuman } from './asDurationHuman';
import { MAX_AGE_MS_DEFAULT } from './pruneStale';

/**
 * .what = clamps the human duration the hold message renders beside its raw ms
 * .why = the window is CONFIGURABLE, so this render is derived rather than a
 *        hardcoded "24h". a clamp on the default alone would stay green while
 *        every non-default window rendered wrong
 */
describe('asDurationHuman', () => {
  given('[case1] the age gate default', () => {
    when('[t0] it is rendered', () => {
      then('🔴 it reads as a day, in one glance', () => {
        // .why = this is the exact string the hold message carries, so it is the
        //        one value a human meets in the wild. it is read from the live
        //        constant, never a literal — a change to the default that left
        //        this render stale is the defect this line exists to catch
        expect(asDurationHuman({ ms: MAX_AGE_MS_DEFAULT })).toEqual('24h');
      });
    });
  });

  given('[case2] a window a consumer narrowed', () => {
    when('[t0] the value carries more than one unit', () => {
      then('every non-zero unit reads, largest first', () => {
        expect(asDurationHuman({ ms: 90 * 60 * 1000 })).toEqual('1h 30m');
      });
    });

    when('[t1] the value is under an hour', () => {
      then('the hour is omitted rather than rendered as zero', () => {
        // .why = a `24h 0m 0s 0ms` render is the shape a naive builder emits, and
        //        it is worse than the raw ms it was added to explain
        expect(asDurationHuman({ ms: 5 * 60 * 1000 })).toEqual('5m');
      });
    });
  });

  given('[case3] the boundaries', () => {
    when('[t0] the value is zero', () => {
      then('it reads as zero seconds rather than as an empty string', () => {
        // .why = an empty render would put "(  )" in the message, which reads as a
        //        broken template rather than as a window of no length
        expect(asDurationHuman({ ms: 0 })).toEqual('0s');
      });
    });

    when('[t1] the value carries a sub-second remainder', () => {
      then('the milliseconds survive', () => {
        expect(asDurationHuman({ ms: 1500 })).toEqual('1s 500ms');
      });
    });
  });
});
