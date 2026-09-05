/**
 * .what = clamps H4 — the unhooked notice speaks ONCE per run, names the config
 *         file at fault, is suppressible, and is SILENT where no runner is in play
 * .why = this notice is the entire mitigation for the wish's one conditional
 *        promise: the guarantee holds only if a consumer wired the hooks into every
 *        runner config they own. a notice that spams is unwired by an annoyed
 *        human, and a notice that misfires teaches them to distrust it — so each of
 *        its four bounds carries load, and each is clamped here
 *
 * .note = 🔴 H4 is the requirement this file exists to clamp, and `resetUnhookedNotice`
 *         is its lever — an `@internal - only for test use` export whose sole consumer
 *         is here. where such an export has NO consumer, the honest read is not
 *         "delete the helper" but "H4 has no clamp at all": an export justified by a
 *         test no one wrote is a tell that the requirement, rather than the export,
 *         is what went absent
 */
import { given, then, when } from '@src/contract';

import {
  QUIET_ENV_KEY,
  resetUnhookedNotice,
  warnIfUnhooked,
} from './warnIfUnhooked';

describe('warnIfUnhooked', () => {
  /** captures console.error for one call, then restores it */
  const getAllLinesSpoken = (act: () => void): string[] => {
    const lines: string[] = [];
    const errorBefore = console.error;
    console.error = (...args: unknown[]): void => {
      lines.push(args.map(String).join(' '));
    };
    try {
      act();
    } finally {
      console.error = errorBefore;
    }
    return lines;
  };

  /** captures the notice under a supplied argv, then restores the real one */
  const getAllLinesSpokenWithArgv = (input: {
    argv: string[];
    act: () => void;
  }): string[] => {
    const argvBefore = process.argv;
    process.argv = input.argv;
    try {
      return getAllLinesSpoken(input.act);
    } finally {
      process.argv = argvBefore;
    }
  };

  /**
   * .what = runs `act` with each named env key set (or absent, on null), then
   *         restores every prior value — even when `act` throws
   * .why = 🔴 the restores sit in a `finally`, never inline on the happy path. a
   *        throw inside `warnIfUnhooked` would otherwise carry the mutation into
   *        every later test in this file — and the two keys at stake are
   *        `JEST_WORKER_ID` and `VITEST`, which is to say jest's own runner
   *        detection. one red test then cascades into a file of unrelated reds
   *        whose cause sits nowhere near them
   */
  const withEnv = <T>(keys: Record<string, string | null>, act: () => T): T => {
    const before = Object.keys(keys).map((key) => ({
      key,
      value: process.env[key],
    }));
    const setOneKey = (input: {
      key: string;
      value: string | undefined;
    }): void => {
      if (input.value === undefined) delete process.env[input.key];
      if (input.value !== undefined) process.env[input.key] = input.value;
    };
    try {
      for (const [key, value] of Object.entries(keys))
        setOneKey({ key, value: value ?? undefined });
      return act();
    } finally {
      for (const entry of before) setOneKey(entry);
    }
  };

  given('[case1] a run under a detectable runner, never yet warned', () => {
    when('[t0] the notice is asked to speak twice', () => {
      then('it speaks exactly ONCE', () => {
        // .why = a per-allocation notice would print once per genTempDir call —
        //        hundreds of lines in a suite, which trains a human to unwire it
        resetUnhookedNotice();
        const linesFirst = getAllLinesSpoken(() =>
          warnIfUnhooked({ reason: 'setup-absent' }),
        );
        const linesSecond = getAllLinesSpoken(() =>
          warnIfUnhooked({ reason: 'setup-absent' }),
        );

        expect(linesFirst).toHaveLength(1);
        expect(linesSecond).toHaveLength(0);
      });

      then(
        '🔴 it names the CONFIG FILE at fault, not merely "your runner"',
        () => {
          // .why = this repo holds nine runner configs that share no base, so a
          //        notice that says "your test runner" leaves the human to hunt
          //
          // .note = a looser assertion here — `toContain('at:') / ('jest') /
          //         ('fix')` — reads green on the very fallback it means to
          //         forbid: `at: your jest config (…)` satisfies ALL THREE. so
          //         the clamp would pass on the exact answer its own TITLE
          //         declares wrong. *a clamp whose assertions the wrong answer
          //         also passes is a clamp for the sentence in its title, not
          //         for the behavior.*
          resetUnhookedNotice();
          const [line] = getAllLinesSpokenWithArgv({
            argv: ['node', 'jest', '-c', './jest.unit.config.ts'],
            act: () => warnIfUnhooked({ reason: 'setup-absent' }),
          });

          expect(line).toContain('at: ./jest.unit.config.ts');
        },
      );

      then('and it reads every shape the flag is written in', () => {
        // .why = both runners accept `-c` and `--config`, space- or `=`-joined.
        //        this repo passes the space form of each; a consumer may pass
        //        either, and an unread shape silently downgrades their address
        const shapes = [
          ['node', 'jest', '-c', './a.config.ts'],
          ['node', 'jest', '-c=./a.config.ts'],
          ['node', 'vitest', 'run', '--config', './a.config.ts'],
          ['node', 'vitest', 'run', '--config=./a.config.ts'],
        ];

        for (const argv of shapes) {
          resetUnhookedNotice();
          const [line] = getAllLinesSpokenWithArgv({
            argv,
            act: () => warnIfUnhooked({ reason: 'setup-absent' }),
          });
          expect(line).toContain('at: ./a.config.ts');
        }
      });

      then('and where argv carries no flag, it names the FAMILY', () => {
        // .why = a runner DISCOVERS its config when no flag is passed, and tells
        //        no one which it found — so the honest answer is the family, and
        //        a guessed filename would send the human to edit the wrong file
        resetUnhookedNotice();
        const [line] = getAllLinesSpokenWithArgv({
          argv: ['node', 'jest'],
          act: () => warnIfUnhooked({ reason: 'setup-absent' }),
        });

        expect(line).toContain('at: your jest config');
      });
    });

    when('[t1] the reason is a HALF-WIRED config', () => {
      then('it names the absent teardown specifically', () => {
        // .why = a setup with no teardown stamps every dir and reclaims not one —
        //        a distinct broken state with a distinct one-line fix
        resetUnhookedNotice();
        const [line] = getAllLinesSpoken(() =>
          warnIfUnhooked({ reason: 'teardown-absent' }),
        );

        expect(line).toContain('globalTeardown');
        expect(line).toContain('STAMPED but never reclaimed');
      });
    });
  });

  given('[case2] a human who has read the notice and set the quiet key', () => {
    when('[t0] the notice is asked to speak', () => {
      then('it says no word', () => {
        resetUnhookedNotice();
        const lines = withEnv({ [QUIET_ENV_KEY]: '1' }, () =>
          getAllLinesSpoken(() => warnIfUnhooked({ reason: 'setup-absent' })),
        );

        expect(lines).toEqual([]);
      });

      then('and the quiet key did NOT burn the once-per-run budget', () => {
        // .why = were the flag set before the quiet check, a consumer who unsets
        //        the key mid-run would be silently owed a notice they never get
        resetUnhookedNotice();
        withEnv({ [QUIET_ENV_KEY]: '1' }, () =>
          getAllLinesSpoken(() => warnIfUnhooked({ reason: 'setup-absent' })),
        );

        const lines = getAllLinesSpoken(() =>
          warnIfUnhooked({ reason: 'setup-absent' }),
        );
        expect(lines).toHaveLength(1);
      });
    });
  });

  given(
    '[case3] a caller that is NOT a test runner — a cli, a tsx one-off',
    () => {
      when('[t0] the notice is asked to speak', () => {
        then('it says no word, because its named fix would not apply', () => {
          // .why = such a caller has no runner config to wire, so the notice would
          //        hand them a fix they cannot take — worse than silence
          resetUnhookedNotice();
          const lines = withEnv({ JEST_WORKER_ID: null, VITEST: null }, () =>
            getAllLinesSpoken(() => warnIfUnhooked({ reason: 'setup-absent' })),
          );

          expect(lines).toEqual([]);
        });

        then('and that silence did NOT burn the once-per-run budget', () => {
          // .why = a cli call early in a process must not mute the notice a real
          //        runner earns later in that same process
          resetUnhookedNotice();
          withEnv({ JEST_WORKER_ID: null }, () =>
            getAllLinesSpoken(() => warnIfUnhooked({ reason: 'setup-absent' })),
          );

          const lines = getAllLinesSpoken(() =>
            warnIfUnhooked({ reason: 'setup-absent' }),
          );
          expect(lines).toHaveLength(1);
        });
      });
    },
  );
});
