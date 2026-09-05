/**
 * the shape of a runner config, as far as this question needs it
 *
 * .note = hand-declared rather than imported from `@jest/types`, and that is
 *         deliberate: this module ships to consumers, so a `.d.ts` that references
 *         `@jest/types` would demand every consumer install it. the cost of the
 *         hand-declaration is that a rename in jest would NOT raise a type error
 *         here — which is exactly why the read below is clamped
 */
export interface RunnerConfigTeardownSlot {
  globalTeardown?: string | null;
}

/**
 * .what = reads whether a runner config wires a global teardown beside our setup
 * .why = this boolean IS the evidence behind the ONE cause the arrears report may
 *        name outright (a half-wired config). every other cause it can only name
 *        as a class, because it holds no evidence for them
 *
 * .note = the config is REQUIRED, never optional. jest passes it on every call —
 *         `await globalModule(globalConfig, projectConfig)`, @jest/core
 *         build/index.js:3166 — so an optional here guards a case the runner
 *         cannot produce, and its fallback (`!!undefined?.globalTeardown`) is
 *         `false`, which is the value that ACCUSES a correctly-wired consumer.
 *         a default on an evidence field is a forgery whichever way it points
 */
export const isTeardownWired = (input: {
  config: RunnerConfigTeardownSlot;
}): boolean => {
  const declared = input.config.globalTeardown;

  // an empty string is a config key present and blank — no module to run, so no
  // teardown is wired. `!!` reads that correctly, and states it here so a later
  // reader need not re-derive it
  return !!declared;
};
