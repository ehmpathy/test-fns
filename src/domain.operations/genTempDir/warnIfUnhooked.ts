// .note = RELATIVE, never the @src alias. the setup adapter reaches for this module
//         from the globalSetup path, which a runner loads OUTSIDE its moduleNameMapper
import {
  getOneTestRunner,
  type TestRunner,
} from '../../infra/isomorph.test/detectTestRunner';
import { sayReport } from './sayReport';

/** the env key that suppresses the unhooked notice */
export const QUIET_ENV_KEY = 'TEST_FNS_QUIET';

/** whether the unhooked notice has already spoken this process */
let warnedThisProcess = false;

/**
 * .what = tells a consumer their runner is not wired for autoprune, once per run
 * .why = the guarantee is CONDITIONAL on a pair of config keys, and a consumer's
 *        mental model is that cleanup is automatic. a model AHEAD of reality is a
 *        defect in the behavior, not in the human — so the gap is made loud at the
 *        moment it matters, with the config file at fault named
 *
 * .note = SILENT where no runner is detectable. a cli, a tsx one-off, or a codegen
 *         step has no runner config to fix, so the named fix would not apply to it
 *
 * .note = suppressible via TEST_FNS_QUIET, for a consumer who has read it
 *
 * .note = it lives HERE, beside genEphemeralTempDir, rather than under autoprune/,
 *         because both the allocation path and the setup adapter reach for it — so
 *         genTempDir/ is their common ancestor (rule.prefer.most-common-denominator)
 */
export const warnIfUnhooked = (input: {
  reason: 'setup-absent' | 'teardown-absent';
}): void => {
  if (warnedThisProcess) return;
  if (process.env[QUIET_ENV_KEY]) return;

  // where no runner is in play there is no config to name, so say no word
  // .note = through the EXTANT detector, never a second copy of its two env reads.
  //         an inline copy here is a rival definition of "what is a runner", and the
  //         two part company the day a third runner appears or a key is renamed
  const runner = getOneTestRunner();
  if (!runner) return;

  warnedThisProcess = true;

  const pathConfig = getOneRunnerConfigPath({ runner, argv: process.argv });
  const lines =
    input.reason === 'teardown-absent'
      ? // 🔴 the cause line names WHICH half is wired, then the term — the one
        // clause order all three half-wired messages share. each is free to
        // drift into an order of its own (lead with the term, or omit it), and
        // a family whose members phrase one defect three ways makes a human
        // re-read to check they are the same defect
        // (`rule.forbid.ambiguous-labels`, `rule.require.ubiqlang`)
        //
        // .note = `.jest` is hardcoded rather than rendered from the runner,
        //         because this state is jest-ONLY by construction: vitest takes
        //         ONE `globalSetup` key whose module exports both hooks, so a
        //         vitest run cannot wire the setup and miss the teardown. a
        //         vitest arm here would be an unreachable branch, and an
        //         unreachable branch is worse than an absent one — it answers
        //         the question a reviewer would otherwise have asked (see
        //         getOneRunnerConfigPath's note)
        [
          '🧹 test-fns: temp dirs will be STAMPED but never reclaimed.',
          `   ├─ at: ${pathConfig}`,
          '   ├─ cause: the autoprune setup is wired, its teardown is not — a half-wired config.',
          "   └─ fix: add `globalTeardown: 'test-fns/autoprune.teardown.jest'`.",
        ]
      : // 🔴 each fix line is one PASTEABLE config key, in the same shape as the
        // `teardown-absent` arm above — never two keys fused into one line. a form
        // like `globalSetup + globalTeardown = 'a.setup.jest' / 'a.teardown.jest'`
        // is genuinely ambiguous: BOTH values are paths that contain a `/`, so the
        // separator is indistinguishable from the data. the quote style is uniform
        // across the arms for the same reason. this is `case=7`, the notice EVERY
        // consumer meets on release day, so its fix is the one that can least
        // afford a re-read
        [
          '🧹 test-fns: temp dirs made by genTempDir are never reclaimed here.',
          `   ├─ at: ${pathConfig}`,
          '   ├─ cause: this runner config does not wire the autoprune hooks.',
          '   ├─ fix (jest): add both keys —',
          "   │      globalSetup: 'test-fns/autoprune.setup.jest'",
          "   │      globalTeardown: 'test-fns/autoprune.teardown.jest'",
          '   ├─ fix (vitest): add the one key —',
          "   │      globalSetup: ['test-fns/autoprune.setup.vitest']",
          `   └─ quiet: set ${QUIET_ENV_KEY}=1`,
        ];

  sayReport({ lines });
};

/**
 * .what = names the config file at fault, as best it can
 * .why = a repo may hold NINE runner configs that share no base, so "your test
 *        runner" is not an actionable address — the human needs the FILE
 *
 * .note = the source is ARGV, never env. 🔴 `process.env.JEST_CONFIG` and
 *         `VITEST_CONFIG` DO NOT EXIST — neither jest 30.2.0 nor vitest 4.0.16 sets
 *         either key. a read of them gives a branch that cannot fire, leaves the
 *         family fallback as the only reachable answer, and lets the vision's
 *         explicit demand — *name the config file at fault* — read as met in review
 *         while it is unmet in every run.
 *         *an unreachable branch is worse than an absent one: it answers the
 *         question a reviewer would otherwise have asked.*
 *
 * .note = argv is where the address actually lives — every invocation in this repo
 *         passes it (`jest -c ./jest.unit.config.ts`, `vitest run --config ./x.ts`)
 *
 * .note = EXPORTED, because the half-wired family has three members and two of them
 *         live in other modules. were it private, `teardownAutoprune`'s arm — the
 *         mirror of the `teardown-absent` arm above — would carry no `at:` line at
 *         all: a cause and a fix, and the human left to guess WHICH of a repo's
 *         nine configs to edit. *a family whose members are asserted
 *         consistent by comment, while one member cannot reach the helper the
 *         others use, is consistent only in the comment*
 */
export const getOneRunnerConfigPath = (input: {
  runner: TestRunner;
  argv: string[];
}): string => {
  const declared = getOneConfigFlagValue({ argv: input.argv });
  if (declared) return declared;

  // a runner also DISCOVERS its config when no flag is passed, and publishes no
  // path when it does — so name the family rather than guess at a filename
  return `your ${input.runner} config (this repo may hold several)`;
};

/**
 * .what = reads the config path a runner was invoked with, or null
 * .why = both runners accept `-c` and `--config`, in the space-separated and the
 *        `=`-joined form alike, so all four shapes must read back — an unread shape
 *        degrades to the family name, which is a worse address, never a wrong one
 */
const getOneConfigFlagValue = (input: { argv: string[] }): string | null => {
  for (const [index, arg] of input.argv.entries()) {
    if (arg === '-c' || arg === '--config')
      return input.argv[index + 1] ?? null;
    if (arg.startsWith('--config=')) return arg.slice('--config='.length);
    if (arg.startsWith('-c=')) return arg.slice('-c='.length);
  }
  return null;
};

/**
 * .what = resets the once-per-process notice flag
 * .why = enables tests to verify the once-per-run guarantee
 *
 * @internal - only for test use
 */
export const resetUnhookedNotice = (): void => {
  warnedThisProcess = false;
};
