// .note = 🔴 RELATIVE, never the `@src` alias — with `autoprune.teardown.jest.ts`, the
//         ONLY two files in this repo where the alias is wrong. jest's
//         `moduleNameMapper` is a TEST-RUNTIME mapper: it maps only the imports jest's
//         own runtime pulls in, and a `globalSetup` module is loaded by node's plain
//         `require` BEFORE that runtime exists. so `@src` here fails with
//         `Cannot find module` and kills every run at startup.
//
//         `autoprune.setup.vitest.ts` DOES use `@src`, and the asymmetry is real
//         rather than an oversight: vite aliases at the LOADER, so its alias covers
//         vitest's `globalSetup` too. one runner maps at runtime, one at load.
//
//         `tsc-alias` rewrites `@src` in the BUILD, so a consumer of the published
//         package would never see this — which means the acceptance suite (which drives
//         the built artifact) stays GREEN while the unit suite dies. only this repo's
//         own dev run catches it
import {
  isTeardownWired,
  type RunnerConfigTeardownSlot,
} from './../domain.operations/genTempDir/autoprune/isTeardownWired';
import { setupAutoprune } from './../domain.operations/genTempDir/autoprune/setupAutoprune';
import { warnIfUnhooked } from './../domain.operations/genTempDir/warnIfUnhooked';

/**
 * .what = jest globalSetup — mints this run's id BEFORE jest forks its workers
 * .why = a worker inherits only a COPY of the env that existed at fork, so the id
 *        must be on the main env before the first fork. this is the earliest hook
 *        jest offers, and it runs once, in the main process
 *
 * @example
 * // jest.config.ts
 * export default {
 *   globalSetup: 'test-fns/autoprune.setup.jest',
 *   globalTeardown: 'test-fns/autoprune.teardown.jest',
 * };
 *
 * .note = jest needs BOTH keys. wire only this one and every dir is stamped but
 *         never reclaimed — a half-wired state vitest cannot reach. the marker
 *         records which of the two was wired, so the next run names the cause
 *
 * .note = `globalConfig` is REQUIRED. jest passes it on every call
 *         (@jest/core build/index.js:3166), so an optional would guard a case the
 *         runner cannot produce — and would fall back to `false`, which ACCUSES a
 *         correctly-wired consumer of a half-wired config
 */
// biome-ignore lint/style/noDefaultExport: jest globalSetup api requires default export
export default async (
  globalConfig: RunnerConfigTeardownSlot,
): Promise<void> => {
  // read our own config: is the teardown wired beside us?
  const teardownWired = isTeardownWired({ config: globalConfig });

  await setupAutoprune({ teardownWired });

  if (!teardownWired) warnIfUnhooked({ reason: 'teardown-absent' });
};
