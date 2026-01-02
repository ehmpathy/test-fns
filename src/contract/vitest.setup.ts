/**
 * .what = vitest setup file to register BDD globals
 * .why = direct `import { then }` triggers ESM thenable detection in vitest.
 *        this setup file registers given/when/then as globals via the `bdd` namespace,
 *        which bypasses thenable detection since `bdd` has no top-level `then`.
 *
 * .usage = add to vitest.config.ts:
 *   export default defineConfig({
 *     test: {
 *       setupFiles: ['test-fns/vitest.setup'],
 *     },
 *   });
 *
 * @see .agent/repo=.this/role=any/briefs/limitation.esm-thenable-then-export.md
 */
import { bdd } from './index';

// type declarations for globals
declare global {
  /**
   * describe the scene (initial state or context) for a group of tests
   * @example
   * given('a dry plant', () => {
   *   when('water needs are checked', () => {
   *     then('it should return true', () => {
   *       expect(doesPlantNeedWater(plant)).toBe(true);
   *     });
   *   });
   * });
   */
  var given: typeof bdd.given;

  /**
   * describe the event (action or trigger) that occurs within a scene
   * @example
   * when('the user clicks submit', () => {
   *   then('the form should be submitted', () => {
   *     expect(form.submitted).toBe(true);
   *   });
   * });
   */
  var when: typeof bdd.when;

  /**
   * assert the effect (expected outcome) that should be observed
   * @example
   * then('it should return the correct value', () => {
   *   expect(result).toBe(expected);
   * });
   */
  var then: typeof bdd.then;
}

// register BDD helpers as globals
globalThis.given = bdd.given;
globalThis.when = bdd.when;
globalThis.then = bdd.then;
