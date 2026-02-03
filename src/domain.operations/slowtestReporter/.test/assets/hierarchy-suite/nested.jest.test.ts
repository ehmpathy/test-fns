/**
 * .what = test fixture with nested given/when/then blocks
 * .why = used to verify slowtest reporter preserves hierarchy
 *
 * .note = uses jest describe/it with given/when/then prefixes
 *         because this runs in child process without @src/ aliases
 */

describe('given: [case1] outer given', () => {
  describe('given: [case1.1] nested given', () => {
    describe('when: [t0] nested when', () => {
      it('then: leaf test', () => {
        expect(true).toBe(true);
      });

      it('then: another leaf test', () => {
        expect(false).toBe(false);
      });
    });
  });

  describe('when: [t0] outer when', () => {
    it('then: another leaf', () => {
      expect(42).toBe(42);
    });
  });
});

describe('given: [case2] second top-level given', () => {
  describe('when: [t0] simple when', () => {
    it('then: simple test', () => {
      expect('test').toBeDefined();
    });
  });
});
