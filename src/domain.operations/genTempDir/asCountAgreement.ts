/**
 * .what = the english forms a count decides — the noun phrase, and the pronouns
 *         that refer back to it
 * .why = every line this behavior speaks that carries a count used the lazy `(s)`
 *        suffix — `1 run marker(s) could not be read … judged from them` — even
 *        where the count is known at render time. it reads as unpolished next to a
 *        message corpus this hand-tuned, and the pronoun is wrong outright at one
 *
 * .note = the caller supplies BOTH forms rather than a stem we pluralize. english
 *         plurals are irregular, and a guess here would be silent: it renders, it
 *         snapshots, and only a human ever notices it is wrong
 *
 * .note = the fields are named for their PLURAL forms (`them`, `their`) so a call
 *         site reads as the sentence it builds — `preserved ${agreed.them}` — and
 *         never as a variable that must be decoded back into a pronoun
 *
 * @example
 *   asCountAgreement({ count: 1, one: 'run marker', many: 'run markers' })
 *   // { phrase: '1 run marker',  them: 'it',   their: 'its'   }
 *   asCountAgreement({ count: 2, one: 'run marker', many: 'run markers' })
 *   // { phrase: '2 run markers', them: 'them', their: 'their' }
 */
export const asCountAgreement = (input: {
  count: number;
  /** the noun as it reads at a count of one */
  one: string;
  /** the noun as it reads at every other count, zero included */
  many: string;
}): {
  /** the count and its noun — `1 run marker` · `2 run markers` */
  phrase: string;
  /** the object pronoun — `it` · `them` */
  them: string;
  /** the possessive pronoun — `its` · `their` */
  their: string;
} => {
  // .note = zero takes the PLURAL in english — "0 run markers", never "0 run marker"
  const isOne = input.count === 1;

  return {
    phrase: `${input.count} ${isOne ? input.one : input.many}`,
    them: isOne ? 'it' : 'them',
    their: isOne ? 'its' : 'their',
  };
};
