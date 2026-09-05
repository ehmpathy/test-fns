/**
 * .what = clamps the read that PRODUCES `teardownWired`, not merely what is done
 *         with it once produced
 * .why = 🔴 a YAGNI pass found that every `teardownWired` in every test was a
 *        hand-supplied literal. so the F4 linchpin — the ONE cause the arrears
 *        report may name outright — had its production read clamped by not one
 *        assertion, while three separate files clamped what happens DOWNSTREAM
 *        of the value
 *
 * .note = that is the third time this review met the same shape: defect 5 (a
 *         default fabricated the value), defect 7 (my fixture reached it by the
 *         wrong path), and this. *a clamp on what the code does with a value is
 *         not a clamp on whether the value is right.*
 */
import { given, then, when } from '@src/contract';

import { isTeardownWired } from './isTeardownWired';

describe('isTeardownWired', () => {
  given('[case1] a config that wires a teardown beside our setup', () => {
    when('[t0] the setup reads it', () => {
      then('it reports WIRED, so no half-wired cause is ever named', () => {
        expect(
          isTeardownWired({
            config: { globalTeardown: 'test-fns/autoprune.teardown.jest' },
          }),
        ).toBe(true);
      });
    });
  });

  given('[case2] a config with the teardown key absent', () => {
    when('[t0] the setup reads it', () => {
      then('it reports UNWIRED — the half-wired state jest can reach', () => {
        expect(isTeardownWired({ config: {} })).toBe(false);
      });
    });
  });

  given('[case3] the two shapes jest uses for "no teardown"', () => {
    // .why = @jest/types declares `globalTeardown: string | null | undefined` on
    //        the resolved config, so BOTH null and undefined are reachable — and
    //        an equality check against one would misread the other
    when('[t0] the key is null', () => {
      then('it reports UNWIRED', () => {
        expect(isTeardownWired({ config: { globalTeardown: null } })).toBe(
          false,
        );
      });
    });

    when('[t1] the key is present but blank', () => {
      then('it reports UNWIRED — a blank key runs no module', () => {
        // .why = a key set to '' is a config that DECLARES a teardown and names
        //        none. to read that as wired would silence the diagnosis for the
        //        consumer most likely to have mis-edited their config
        expect(isTeardownWired({ config: { globalTeardown: '' } })).toBe(false);
      });
    });
  });
});
