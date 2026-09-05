import { given, then, when } from '@src/contract';

import { asCountAgreement } from './asCountAgreement';

/**
 * .what = clamps the english agreement every message with a count renders through
 * .why = 🔴 the messages this feeds are SNAPPED, so a regression here surfaces in a
 *        diff — but only for the counts the snapshots happen to exercise, and those
 *        are 1 and 2. this holds the boundary the snapshots cannot: zero, and the
 *        pronoun pair that moves with the count
 */
describe('asCountAgreement', () => {
  given('[case1] a count of exactly one', () => {
    when('[t0] the forms are asked for', () => {
      const agreed = asCountAgreement({
        count: 1,
        one: 'run marker',
        many: 'run markers',
      });

      then('the noun is singular', () => {
        expect(agreed.phrase).toEqual('1 run marker');
      });

      then('🔴 both pronouns are singular too', () => {
        // .why = this pair is the whole reason the `(s)` suffix was not merely
        //        unpolished: "1 prior test run(s) never reclaimed THEIR temp dirs"
        //        rendered a plural possessive beside a count of one
        expect(agreed.them).toEqual('it');
        expect(agreed.their).toEqual('its');
      });
    });
  });

  given('[case2] a count above one', () => {
    when('[t0] the forms are asked for', () => {
      const agreed = asCountAgreement({
        count: 2,
        one: 'temp-dir name',
        many: 'temp-dir names',
      });

      then('the noun is plural', () => {
        expect(agreed.phrase).toEqual('2 temp-dir names');
      });

      then('both pronouns are plural', () => {
        expect(agreed.them).toEqual('them');
        expect(agreed.their).toEqual('their');
      });
    });
  });

  given('[case3] a count of zero', () => {
    when('[t0] the forms are asked for', () => {
      const agreed = asCountAgreement({
        count: 0,
        one: 'prior test run',
        many: 'prior test runs',
      });

      then('🔴 zero takes the PLURAL, as english does', () => {
        // .why = the naive `count > 1` test renders "0 prior test run", which no
        //        snapshot in this repo would catch — every caller guards on
        //        `length > 0` before it speaks, so zero never reaches a render.
        //        that is exactly why it needs a clamp here rather than there: the
        //        guard is a property of today's call sites, not of this transformer
        expect(agreed.phrase).toEqual('0 prior test runs');
        expect(agreed.them).toEqual('them');
        expect(agreed.their).toEqual('their');
      });
    });
  });

  given('[case4] an irregular plural the caller supplies', () => {
    when('[t0] the forms are asked for', () => {
      then('it takes the caller word, never a stem it pluralized', () => {
        // .why = the contract takes BOTH forms precisely so english irregulars are
        //        the caller's to state. a stem-plus-"s" helper would render
        //        "2 childs" — and it would render, and it would snapshot, and only
        //        a human would ever notice
        expect(
          asCountAgreement({ count: 2, one: 'child', many: 'children' }).phrase,
        ).toEqual('2 children');
      });
    });
  });
});
