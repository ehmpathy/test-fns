/**
 * .what = test fixture with plain describe blocks (no bdd)
 * .why = used to verify slowtest reporter handles non-bdd tests
 */

describe('plain suite', () => {
  describe('nested describe', () => {
    it('plain test', () => {
      expect(true).toBe(true);
    });

    it('another plain test', () => {
      expect(1).toBe(1);
    });
  });

  describe('another nested describe', () => {
    it('works', () => {
      expect('hello').toBe('hello');
    });
  });
});
