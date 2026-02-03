/**
 * .what = test fixture with slow tests
 * .why = used to verify slowtest reporter detects slow tests
 *
 * .note = uses jest describe/it with given/when/then prefixes
 *         because this runs in child process without @src/ aliases
 */

describe('given: [case1] slow setup', () => {
  beforeAll(async () => {
    // simulate 500ms setup time
    await new Promise((r) => setTimeout(r, 500));
  });

  describe('when: [t0] slow test', () => {
    it('then: takes time', async () => {
      // simulate 200ms test time
      await new Promise((r) => setTimeout(r, 200));
      expect(true).toBe(true);
    });
  });

  describe('when: [t1] another slow test', () => {
    it('then: also takes time', async () => {
      // simulate 300ms test time
      await new Promise((r) => setTimeout(r, 300));
      expect(true).toBe(true);
    });
  });
});
