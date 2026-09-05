/**
 * .what = clamps the STRUCTURAL claim the vitest adapter makes about itself
 * .why = 🔴 the vitest setup hands `teardownWired: true` as a literal, justified by
 *        "one module carries both halves, so a teardown is wired by construction".
 *        that claim is true today and checked by no one — so a later edit that drops
 *        the `teardown` export would leave the `true` behind as a LIE, and the one
 *        adapter that declares the half-wired state unreachable would be the one that
 *        silently misdiagnoses it as "a class of pre-emption"
 *
 * .note = this is defect 12's shape on the other adapter. jest DERIVES the value and
 *         had no clamp; vitest ASSERTS it and had no clamp. same linchpin, both
 *         adapters, neither verified. *"by construction" is a claim, not a proof —
 *         and a claim about your own module is the cheapest of all to check.*
 */
import { given, then, when } from '@src/contract';

import * as adapter from './autoprune.setup.vitest';

describe('autoprune.setup.vitest', () => {
  given('[case1] the module the vitest globalSetup key points at', () => {
    when('[t0] vitest loads it', () => {
      then('it exports a `setup`, which vitest calls before its pool', () => {
        expect(typeof adapter.setup).toEqual('function');
      });

      then(
        '🔴 it ALSO exports a `teardown` — the claim behind the `true`',
        () => {
          // .why = `setup` passes `teardownWired: true` on the strength of this
          //        export alone. drop it and the boolean becomes a false report of
          //        a wired teardown, which SILENCES the one diagnosis we can make
          //        outright. so the export is the evidence, and this is its clamp
          expect(typeof adapter.teardown).toEqual('function');
        },
      );
    });
  });
});
