// .note = the `@src` alias, and it holds here where its jest twin cannot. vite aliases
//         at the LOADER (the `resolve.alias` key in vitest.*.config.ts), so the alias
//         covers a `globalSetup` module the same as any test file. jest's
//         `moduleNameMapper` is a TEST-RUNTIME mapper instead, so
//         `autoprune.setup.jest.ts` must stay relative — see the 🔴 note there.
//         one runner maps at load, one at runtime
import { setupAutoprune } from '@src/domain.operations/genTempDir/autoprune/setupAutoprune';
import { teardownAutoprune } from '@src/domain.operations/genTempDir/autoprune/teardownAutoprune';

/**
 * .what = vitest globalSetup — mints this run's id before vitest starts its pool
 * .why = one module, ONE config key. vitest reads `setup` and `teardown` from a
 *        single globalSetup file, so the half-wired state jest can reach — a setup
 *        with no teardown — is unreachable here by construction
 *
 * @example
 * // vitest.config.ts
 * export default defineConfig({
 *   test: { globalSetup: ['test-fns/autoprune.setup.vitest'] },
 * });
 */
export const setup = async (): Promise<void> => {
  // one module carries both halves, so a teardown is wired by construction
  await setupAutoprune({ teardownWired: true });
};

/**
 * .what = vitest globalTeardown — reclaims exactly the dirs this run's id stamps
 * .why = it runs once, after every test file, and no test filter reaches it
 */
export const teardown = async (): Promise<void> => {
  await teardownAutoprune({ runner: 'vitest' });
};
