/**
 * .what = the regression clamps for a repeatable retry that actually retries (#71)
 * .why = a non-final `SOME` attempt must not fail the file, whatever failed in it —
 *        a thrown error, a suppressed snapshot mismatch, a timeout, or a setup hook.
 *        and a fail on every attempt must still turn the file red
 *
 * .note = each case runs a REAL runner in a CHILD process. the verdict a consumer
 *         meets is the run's exit code and its `✕` marks, and only a whole run
 *         produces either. a same-process exercise sees one test, never the file
 *
 * .note = the child imports `test-fns` through a `node_modules/test-fns` symlink to
 *         this repo, so every action crosses the `exports` map into `dist/` — the
 *         road a consumer walks (`rule.require.acceptance.blackbox`)
 *
 * .note = each fixture counts its own drives in `drives.log`, so a case can grade
 *         HOW MANY times a factory or a setup ran, not only the final verdict
 */
import { given, then, useThen, when } from '@src/contract';
import { genTempDir } from '@src/domain.operations/genTempDir/genTempDir';
import { getGitRoot } from '@src/infra/isomorph.fs/getGitRoot';

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * the fixture prelude every jest child shares
 *
 * .why = `drive(label)` appends one line and returns how many times that label has
 *        run so far, so a fixture can fail on its first drive and pass on its second
 */
const PRELUDE_JEST = `
const fs = require('node:fs');
const path = require('node:path');
const { given, when, then, useThen, useBeforeAll, useBeforeEach } = require('test-fns');
const drive = (label) => {
  const file = path.join(__dirname, 'drives.log');
  fs.appendFileSync(file, label + '\\n');
  return fs.readFileSync(file, 'utf8').split('\\n').filter((line) => line === label).length;
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
`;

/**
 * the fixture prelude every vitest child shares
 *
 * .why = vitest loads a test file as esm, and a module that exports `then` is a
 *        thenable to a dynamic import — the import settles to a subset that lacks
 *        `useThen` (see limitation.esm-thenable-then-export). a cjs `require` does no
 *        thenable dance, so the fixture loads `test-fns` that way, and reaches `then`
 *        via `bdd`
 */
const PRELUDE_VITEST = `
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { bdd, useThen, useBeforeAll, useBeforeEach } = require('test-fns');
const { given, when, then } = bdd;
const dirname = path.dirname(fileURLToPath(import.meta.url));
const drive = (label) => {
  const file = path.join(dirname, 'drives.log');
  fs.appendFileSync(file, label + '\\n');
  return fs.readFileSync(file, 'utf8').split('\\n').filter((line) => line === label).length;
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
`;

/** the budget each child runs under, in ms — small, so a hang costs seconds */
const BUDGET_MS = 1500;

/** how long a hung ask sleeps — well past the budget */
const HANG_MS = 4000;

/**
 * .what = a fixture dir with `test-fns` linked to this repo
 * .why = the child must import `test-fns` the way a consumer does
 */
const genFixtureDir = (input: { slug: string }): string =>
  genTempDir({
    slug: input.slug,
    symlink: [{ at: 'node_modules/test-fns', to: '.' }],
  });

/**
 * .what = runs one child runner over a fixture dir
 * .why = the exit code, the output, and the drive counts are the whole verdict
 */
const getOneChildRun = (input: {
  dir: string;
  runner: 'jest' | 'vitest';
  args: string[];
  env: Record<string, string>;
}): {
  status: number | null;
  output: string;
  drives: Record<string, number>;
} => {
  // reset the drive log, so each run counts only its own drives
  const fileDrives = path.join(input.dir, 'drives.log');
  fs.rmSync(fileDrives, { force: true });

  // spawn the runner from this repo's install, rooted in the fixture dir
  const gitRoot = getGitRoot();
  const argvRunner =
    input.runner === 'jest'
      ? [
          path.join(gitRoot, 'node_modules/jest/bin/jest.js'),
          '--rootDir',
          input.dir,
          '--forceExit',
          ...input.args,
        ]
      : [
          path.join(gitRoot, 'node_modules/vitest/vitest.mjs'),
          'run',
          '--root',
          input.dir,
          ...input.args,
        ];
  const child = spawnSync(process.execPath, argvRunner, {
    cwd: input.dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      JEST_WORKER_ID: '',
      ...input.env,
    },
    timeout: 120_000,
  });

  // tally the drives by label
  const lines = fs.existsSync(fileDrives)
    ? fs.readFileSync(fileDrives, 'utf8').split('\n').filter(Boolean)
    : [];
  const drives = lines.reduce<Record<string, number>>(
    (tally, label) => ({ ...tally, [label]: (tally[label] ?? 0) + 1 }),
    {},
  );

  return {
    status: child.status,
    output: `${child.stdout}\n${child.stderr}`,
    drives,
  };
};

/**
 * .what = asserts a child run exited 0
 * .why = a red shows the child's whole output in place of the verdict, so it names
 *        its own cause
 */
const expectRunPassed = (run: {
  status: number | null;
  output: string;
}): void => {
  expect(
    run.status === 0 ? 'exit 0' : `exit ${run.status}\n${run.output}`,
  ).toEqual('exit 0');
};

/**
 * .what = the lines of a child's output that hold a marker, trimmed
 * .why = a consumer reads these lines; a snapshot of them clamps their full shape,
 *        while the rest of the output (timings, paths) stays out of the snapshot
 */
const asLinesWithMarker = (input: { output: string; marker: string }): string =>
  input.output
    .split('\n')
    .filter((line) => line.includes(input.marker))
    .map((line) => line.trim())
    .join('\n');

/**
 * .what = writes the jest fixture files into a dir
 * .why = one config + one test file is the whole consumer under clamp
 */
const setJestFixture = (input: { dir: string; body: string }): void => {
  fs.writeFileSync(
    path.join(input.dir, 'jest.config.js'),
    `module.exports = { testEnvironment: 'node', transform: {}, testTimeout: ${BUDGET_MS}, testMatch: ['**/*.test.js'], testPathIgnorePatterns: ['/node_modules/'] };\n`,
  );
  fs.writeFileSync(
    path.join(input.dir, 'fixture.test.js'),
    `${PRELUDE_JEST}\n${input.body}\n`,
  );
};

/**
 * .what = writes the vitest fixture files into a dir
 * .why = one config + one test file is the whole consumer under clamp
 */
const setVitestFixture = (input: { dir: string; body: string }): void => {
  fs.writeFileSync(
    path.join(input.dir, 'vitest.config.mjs'),
    `export default { test: { globals: true, environment: 'node', testTimeout: ${BUDGET_MS}, include: ['**/*.test.mjs'], exclude: ['**/node_modules/**'] } };\n`,
  );
  fs.writeFileSync(
    path.join(input.dir, 'fixture.test.mjs'),
    `${PRELUDE_VITEST}\n${input.body}\n`,
  );
};

/**
 * .what = reads the snapshot file a child wrote
 * .why = the keys inside it are the baseline every attempt checks against
 */
const getOneSnapshotFile = (input: {
  dir: string;
  runner: 'jest' | 'vitest';
}): string => {
  const fileSnapshot = path.join(
    input.dir,
    '__snapshots__',
    input.runner === 'jest' ? 'fixture.test.js.snap' : 'fixture.test.mjs.snap',
  );

  // an absent file reads as a marker, so the baseline assertion can name the cause
  if (!fs.existsSync(fileSnapshot)) return '(no snapshot file was written)';
  return fs.readFileSync(fileSnapshot, 'utf8');
};

/** a fixture whose snapshot flips on the drives FLAKE names */
const BODY_SNAPSHOT_FLAKE = `
given('[case1] a value checked against a snapshot', () => {
  when.repeatably({ attempts: 3, criteria: 'SOME' })('[t0] the value is derived', () => {
    const result = useThen('it is derived', async () => {
      const n = drive('derive');
      const flaky = process.env.FLAKE === 'every' || (process.env.FLAKE === 'first' && n === 1);
      return { value: flaky ? 'bad' : 'good' };
    });
    then('it matches the snapshot', () => {
      expect(result.value).toMatchSnapshot();
    });
  });
});
`;

/** a fixture whose ask hangs past the budget on the drives HANG names */
const BODY_TIMEOUT_FLAKE = `
given('[case9] a slow ask', () => {
  when.repeatably({ attempts: 3, criteria: 'SOME' })('[t0] the ask is made', () => {
    const result = useThen('it succeeds', async () => {
      const n = drive('ask');
      const hangs = process.env.HANG === 'every' || n <= 2;
      if (hangs) await sleep(${HANG_MS});
      return { detected: true };
    });
    then('it detects the verdict', () => {
      expect(result.detected).toBe(true);
    });
  });
});
`;

/** a fixture whose setup throws on the drives SETUP names */
const BODY_SETUP_FLAKE = `
given.repeatably({ attempts: 3, criteria: 'SOME' })('[case10] a scene that fails to set up once', () => {
  const scene = useBeforeAll(async () => {
    const n = drive('setup');
    if (process.env.SETUP === 'every' || n === 1) throw new Error('ENOENT: no such fixture');
    return { ready: true };
  });
  when('[t0] the scene is read', () => {
    then('it is ready', () => {
      expect(scene.ready).toBe(true);
    });
  });
});
`;

/** a fixture under EVERY whose snapshot holds on every attempt */
const BODY_SNAPSHOT_EVERY = `
given('[case5] a stable value', () => {
  when.repeatably({ attempts: 3, criteria: 'EVERY' })('[t0] the value is derived', () => {
    const result = useThen('it is derived', async () => {
      drive('derive');
      return { value: 'good' };
    });
    then('it matches the snapshot', () => {
      expect(result.value).toMatchSnapshot();
    });
  });
});
`;

/** a fixture whose `then.repeatably` snapshot flips on the drives FLAKE names */
const BODY_THEN_REPEATABLY_FLAKE = `
given('[case8] a value checked by then.repeatably', () => {
  when('[t0] the value is derived', () => {
    then.repeatably({ attempts: 3, criteria: 'SOME' })('it matches the snapshot', () => {
      const n = drive('derive');
      const flaky = process.env.FLAKE === 'first' && n === 1;
      expect(flaky ? 'bad' : 'good').toMatchSnapshot();
    });
  });
});
`;

/** a fixture under EVERY that passes on attempts 1-2 and fails on 3 */
const BODY_EVERY_LATE_FLIP = `
given('[case4] a value that flips late', () => {
  when.repeatably({ attempts: 3, criteria: 'EVERY' })('[t0] the value is derived', () => {
    then('it holds', () => {
      const n = drive('derive');
      expect(n === 3 ? 'bad' : 'good').toEqual('good');
    });
  });
});
`;

/** a fixture with ONE attempt, whose snapshot mismatches */
const BODY_SNAPSHOT_ONE_ATTEMPT = `
given('[case21] a value checked once', () => {
  when.repeatably({ attempts: 1, criteria: 'SOME' })('[t0] the value is derived', () => {
    then('it matches the snapshot', () => {
      drive('derive');
      expect(process.env.FLAKE === 'every' ? 'bad' : 'good').toMatchSnapshot();
    });
  });
});
`;

/** a fixture whose assertion throws on the drives FLAKE names */
const BODY_THROW_FLAKE = `
given('[case2] a value checked by a plain assertion', () => {
  when.repeatably({ attempts: 3, criteria: 'SOME' })('[t0] the value is derived', () => {
    const result = useThen('it is derived', async () => {
      const n = drive('derive');
      const flaky = process.env.FLAKE === 'every' || (process.env.FLAKE === 'first' && n === 1);
      return { value: flaky ? 'bad' : 'good' };
    });
    then('it holds', () => {
      expect(result.value).toEqual('good');
    });
  });
});
`;

/** a fixture whose `then.repeatably` body hangs past the budget on attempt 1 */
const BODY_THEN_REPEATABLY_HANG = `
given('[case9] a slow check by then.repeatably', () => {
  when('[t0] the check is made', () => {
    then.repeatably({ attempts: 3, criteria: 'SOME' })('it detects the verdict', async () => {
      const n = drive('ask');
      if (n === 1) await sleep(${HANG_MS});
      expect(true).toBe(true);
    });
  });
});
`;

/** a fixture whose assertion throws a distinct error on every attempt */
const BODY_THROW_EVERY_DISTINCT = `
given('[case23] a check that fails differently each time', () => {
  when.repeatably({ attempts: 3, criteria: 'SOME' })('[t0] the check runs', () => {
    then('it holds', () => {
      const n = drive('check');
      throw new Error('failure-of-drive-' + n);
    });
  });
});
`;

/** a fixture whose setup throws a distinct error on every attempt */
const BODY_SETUP_EVERY_DISTINCT = `
given.repeatably({ attempts: 3, criteria: 'SOME' })('[case24] a scene that fails to set up differently each time', () => {
  const scene = useBeforeAll(async () => {
    const n = drive('setup');
    throw new Error('setup-failure-of-drive-' + n);
  });
  when('[t0] the scene is read', () => {
    then('it is ready', () => {
      expect(scene.ready).toBe(true);
    });
  });
});
`;

/** a fixture whose setup runs for its side effect and returns naught */
const BODY_SETUP_VOID = `
given.repeatably({ attempts: 2, criteria: 'SOME' })('[case22] a scene set up for its side effect', () => {
  useBeforeAll(async () => {
    drive('setup');
  });
  when('[t0] the scene is checked', () => {
    then('it passes', () => {
      expect(true).toBe(true);
    });
  });
});
`;

/** a fixture whose RAW beforeAll throws on the first drive — outside the retry */
const BODY_RAW_BEFORE_ALL_FLAKE = `
given('[case25] a scene set up by a raw beforeAll', () => {
  when.repeatably({ attempts: 3, criteria: 'SOME' })('[t0] the scene is read', () => {
    beforeAll(() => {
      const n = drive('setup');
      if (n === 1) throw new Error('raw-setup-failure');
    });
    then('it is ready', () => {
      expect(true).toBe(true);
    });
  });
});
`;

/** a fixture whose useBeforeEach throws on the first drive — inside the retry */
const BODY_BEFORE_EACH_FLAKE = `
given('[case26] a scene set up before each check', () => {
  when.repeatably({ attempts: 3, criteria: 'SOME' })('[t0] the scene is read', () => {
    const scene = useBeforeEach(async () => {
      const n = drive('setup');
      if (n === 1) throw new Error('each-setup-failure');
      return { ready: true };
    });
    then('it is ready', () => {
      expect(scene.ready).toBe(true);
    });
  });
});
`;

/** a fixture whose `then.repeatably` body fails on every attempt */
const BODY_THEN_REPEATABLY_FAIL_EVERY = `
given('[case27] a check by then.repeatably that never passes', () => {
  when('[t0] the check is made', () => {
    then.repeatably({ attempts: 3, criteria: 'SOME' })('it holds', ({ attempt }) => {
      const n = drive('check');
      throw new Error('check-failure-of-attempt-' + attempt + '-drive-' + n);
    });
  });
});
`;

/** a fixture whose setup fails once, read by two thens */
const BODY_SETUP_FLAKE_TWO_THENS = `
given.repeatably({ attempts: 3, criteria: 'SOME' })('[case28] a scene read by two checks', () => {
  const scene = useBeforeAll(async () => {
    const n = drive('setup');
    if (n === 1) throw new Error('two-then-setup-failure');
    return { ready: true };
  });
  when('[t0] the scene is read', () => {
    then('it is ready', () => {
      expect(scene.ready).toBe(true);
    });
    then('it is still ready', () => {
      expect(scene.ready).toBe(true);
    });
  });
});
`;

/**
 * .what = turns a fresh baseline into the one a consumer held before the key rename
 * .why = the header line must be the one the installed jest writes, so the legacy file
 *        is derived from a real baseline: only the key regains its attempt ordinal
 */
const asSnapshotLegacy = (input: { snapshot: string }): string =>
  input.snapshot
    .split('when: [t0] the value is derived then:')
    .join('when: [t0] the value is derived, attempt 1 then:');

describe('givenWhenThen.repeatably', () => {
  given('[case1] jest, a snapshot that mismatches on attempt 1 only', () => {
    const dir = genFixtureDir({ slug: 'repeatably-snapshot-flake' });

    when('[t0] the baseline is written, then the flake runs under --ci', () => {
      const runs = useThen('both runs complete', () => {
        setJestFixture({ dir, body: BODY_SNAPSHOT_FLAKE });
        const baseline = getOneChildRun({
          dir,
          runner: 'jest',
          args: ['-u', '--ci=false'],
          env: { FLAKE: 'none' },
        });
        const snapshot = getOneSnapshotFile({ dir, runner: 'jest' });
        const flake = getOneChildRun({
          dir,
          runner: 'jest',
          args: ['--ci'],
          env: { FLAKE: 'first' },
        });
        return { baseline, snapshot, flake };
      });

      then('the baseline run passes', () => {
        expectRunPassed(runs.baseline);
      });

      then('the snapshot key carries no attempt ordinal', () => {
        expect(runs.snapshot).not.toContain('attempt');
        expect(runs.snapshot).toContain('when: [t0] the value is derived');
      });

      then('the flake run passes', () => {
        expect(runs.flake.output).not.toContain('✕');
        expectRunPassed(runs.flake);
      });

      then('the factory re-ran for the retry', () => {
        expect(runs.flake.drives.derive).toEqual(2);
      });

      then('the withheld attempt is named in the log', () => {
        expect(runs.flake.output).toContain(
          '[withheld] attempt 1 failed, a retry follows',
        );
      });

      then('the withheld line matches its snapshot', () => {
        expect(
          asLinesWithMarker({
            output: runs.flake.output,
            marker: '[withheld]',
          }),
        ).toMatchSnapshot();
      });

      then('the attempt after the pass is skipped, and says so', () => {
        expect(runs.flake.output).toContain(
          '[skipped] prior repeatably attempt passed',
        );
      });

      then('the skipped line matches its snapshot', () => {
        expect(
          asLinesWithMarker({
            output: runs.flake.output,
            marker: '[skipped]',
          }),
        ).toMatchSnapshot();
      });
    });

    when('[t1] the snapshot mismatches on every attempt', () => {
      const run = useThen('the run completes', () =>
        getOneChildRun({
          dir,
          runner: 'jest',
          args: ['--ci'],
          env: { FLAKE: 'every' },
        }),
      );

      then('the run fails', () => {
        expect(run.status).not.toEqual(0);
      });

      then('every attempt was driven', () => {
        expect(run.drives.derive).toEqual(3);
      });

      then('the mismatch is shown', () => {
        expect(run.output).toContain('toMatchSnapshot');
      });

      then('only the final attempt counts in the snapshot tally', () => {
        // the withheld mismatches of attempts 1 and 2 are rolled back (invariant I1)
        expect(run.output).toMatch(/Snapshots:\s+1 failed/);
      });
    });

    when('[t2] the flake runs in local mode, neither -u nor --ci', () => {
      const runs = useThen('the run completes', () => {
        const snapshotBefore = getOneSnapshotFile({ dir, runner: 'jest' });
        const run = getOneChildRun({
          dir,
          runner: 'jest',
          args: ['--ci=false'],
          env: { FLAKE: 'first' },
        });
        const snapshotAfter = getOneSnapshotFile({ dir, runner: 'jest' });
        return { run, snapshotBefore, snapshotAfter };
      });

      then('the run passes, after a retry', () => {
        expectRunPassed(runs.run);
        expect(runs.run.drives.derive).toEqual(2);
      });

      then('the baseline is left untouched', () => {
        expect(runs.snapshotAfter).toEqual(runs.snapshotBefore);
      });
    });
  });

  given('[case5] jest, EVERY over a stable snapshot', () => {
    const dir = genFixtureDir({ slug: 'repeatably-snapshot-every' });

    when('[t0] the baseline is written, then re-checked under --ci', () => {
      const runs = useThen('both runs complete', () => {
        setJestFixture({ dir, body: BODY_SNAPSHOT_EVERY });
        const baseline = getOneChildRun({
          dir,
          runner: 'jest',
          args: ['-u', '--ci=false'],
          env: {},
        });
        const snapshot = getOneSnapshotFile({ dir, runner: 'jest' });
        const check = getOneChildRun({
          dir,
          runner: 'jest',
          args: ['--ci'],
          env: {},
        });
        return { baseline, snapshot, check };
      });

      then('one key holds the baseline, with no attempt ordinal', () => {
        expect(runs.snapshot).not.toContain('attempt');
        expect(runs.snapshot.split('exports[').length - 1).toEqual(1);
      });

      then('every attempt checks against it and passes', () => {
        expectRunPassed(runs.check);
        expect(runs.check.drives.derive).toEqual(3);
      });
    });
  });

  given('[case9] jest, an ask that hangs past the budget', () => {
    const dir = genFixtureDir({ slug: 'repeatably-timeout-flake' });

    when('[t0] the ask hangs on attempts 1 and 2, and returns on 3', () => {
      const run = useThen('the run completes', () => {
        setJestFixture({ dir, body: BODY_TIMEOUT_FLAKE });
        return getOneChildRun({
          dir,
          runner: 'jest',
          args: [],
          env: { HANG: 'first-two' },
        });
      });

      then('the run passes', () => {
        expect(run.output).not.toContain('✕');
        expectRunPassed(run);
      });

      then('the ask was driven once per attempt', () => {
        expect(run.drives.ask).toEqual(3);
      });

      then('the overrun is named in the withheld log', () => {
        expect(run.output).toContain(`exceeded the ${BUDGET_MS}ms budget`);
      });

      then('the withheld overrun lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[withheld]' }),
        ).toMatchSnapshot();
      });
    });

    when('[t1] the ask hangs on every attempt', () => {
      const run = useThen('the run completes', () =>
        getOneChildRun({
          dir,
          runner: 'jest',
          args: [],
          env: { HANG: 'every' },
        }),
      );

      then('the run fails', () => {
        expect(run.status).not.toEqual(0);
      });

      then('every attempt was driven', () => {
        expect(run.drives.ask).toEqual(3);
      });

      then("the final attempt's timeout is shown", () => {
        expect(run.output).toContain(`exceeded the ${BUDGET_MS}ms budget`);
        expect(run.output).toContain('✕');
      });
    });
  });

  given('[case2] jest, an assertion that throws on attempt 1 only', () => {
    const dir = genFixtureDir({ slug: 'repeatably-throw-flake' });

    when('[t0] the flake runs', () => {
      const run = useThen('the run completes', () => {
        setJestFixture({ dir, body: BODY_THROW_FLAKE });
        return getOneChildRun({
          dir,
          runner: 'jest',
          args: [],
          env: { FLAKE: 'first' },
        });
      });

      then('the run passes, after a retry', () => {
        expect(run.output).not.toContain('✕');
        expectRunPassed(run);
        expect(run.drives.derive).toEqual(2);
      });

      then('the thrown failure is named in the withheld log', () => {
        expect(run.output).toContain(
          '[withheld] attempt 1 failed, a retry follows',
        );
      });

      then('the withheld lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[withheld]' }),
        ).toMatchSnapshot();
      });
    });

    when('[t1] the assertion throws on every attempt', () => {
      const run = useThen('the run completes', () =>
        getOneChildRun({
          dir,
          runner: 'jest',
          args: [],
          env: { FLAKE: 'every' },
        }),
      );

      then('the run fails, after every attempt drove', () => {
        expect(run.status).not.toEqual(0);
        expect(run.drives.derive).toEqual(3);
      });
    });
  });

  given('[case10] jest, a setup hook that fails once', () => {
    const dir = genFixtureDir({ slug: 'repeatably-setup-flake' });

    when('[t0] the setup throws on attempt 1, and passes on 2', () => {
      const run = useThen('the run completes', () => {
        setJestFixture({ dir, body: BODY_SETUP_FLAKE });
        return getOneChildRun({
          dir,
          runner: 'jest',
          args: [],
          env: { SETUP: 'first' },
        });
      });

      then('the run passes', () => {
        expect(run.output).not.toContain('✕');
        expectRunPassed(run);
      });

      then('the setup re-ran for the retry', () => {
        expect(run.drives.setup).toEqual(2);
      });

      then('the setup failure is named in the withheld log', () => {
        expect(run.output).toContain(
          '[withheld] attempt 1 failed, a retry follows',
        );
      });

      then('the withheld lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[withheld]' }),
        ).toMatchSnapshot();
      });

      then('the setup after the pass is skipped, and says so', () => {
        expect(run.output).toContain(
          '[skipped] prior repeatably attempt passed (setup)',
        );
      });

      then('the skipped lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[skipped]' }),
        ).toMatchSnapshot();
      });
    });

    when('[t1] the setup throws on every attempt', () => {
      const run = useThen('the run completes', () =>
        getOneChildRun({
          dir,
          runner: 'jest',
          args: [],
          env: { SETUP: 'every' },
        }),
      );

      then('the run fails', () => {
        expect(run.status).not.toEqual(0);
      });

      then('every attempt ran the setup', () => {
        expect(run.drives.setup).toEqual(3);
      });

      then('the setup error is shown', () => {
        expect(run.output).toContain('ENOENT: no such fixture');
      });
    });
  });

  given('[case6] jest, a baseline written before the key rename', () => {
    const dir = genFixtureDir({ slug: 'repeatably-snapshot-legacy' });

    when('[t0] the legacy baseline is checked under --ci', () => {
      const runs = useThen('the runs complete', () => {
        setJestFixture({ dir, body: BODY_SNAPSHOT_FLAKE });
        const baseline = getOneChildRun({
          dir,
          runner: 'jest',
          args: ['-u', '--ci=false'],
          env: { FLAKE: 'none' },
        });
        const snapshotLegacy = asSnapshotLegacy({
          snapshot: getOneSnapshotFile({ dir, runner: 'jest' }),
        });
        fs.writeFileSync(
          path.join(dir, '__snapshots__', 'fixture.test.js.snap'),
          snapshotLegacy,
        );
        const check = getOneChildRun({
          dir,
          runner: 'jest',
          args: ['--ci'],
          env: { FLAKE: 'none' },
        });
        return { baseline, snapshotLegacy, check };
      });

      then('the baseline run passes', () => {
        expectRunPassed(runs.baseline);
      });

      then('the legacy baseline carries the attempt ordinal', () => {
        expect(runs.snapshotLegacy).toContain('attempt 1');
      });

      then('the run fails safe, never silent', () => {
        expect(runs.check.status).not.toEqual(0);
      });

      then('the failure names the rename and the resnap', () => {
        expect(runs.check.output).toContain('this snapshot key was renamed');
        expect(runs.check.output).toContain('run the suite once with -u');
      });

      then('the rename hint matches its snapshot', () => {
        expect(
          asLinesWithMarker({ output: runs.check.output, marker: 'test-fns:' }),
        ).toMatchSnapshot();
      });
    });

    when('[t1] the consumer resnaps once, then checks under --ci', () => {
      const runs = useThen('both runs complete', () => {
        const resnap = getOneChildRun({
          dir,
          runner: 'jest',
          args: ['--ci=false', '-u'],
          env: { FLAKE: 'none' },
        });
        const snapshot = getOneSnapshotFile({ dir, runner: 'jest' });
        const check = getOneChildRun({
          dir,
          runner: 'jest',
          args: ['--ci'],
          env: { FLAKE: 'first' },
        });
        return { resnap, snapshot, check };
      });

      then('the resnap passes', () => {
        expectRunPassed(runs.resnap);
      });

      then('the key is renamed and the old key dropped', () => {
        expect(runs.snapshot).not.toContain('attempt');
        expect(runs.snapshot.split('exports[').length - 1).toEqual(1);
      });

      then('a later flake is rescued on the new key', () => {
        expectRunPassed(runs.check);
        expect(runs.check.drives.derive).toEqual(2);
      });
    });
  });

  given(
    '[case8] jest, then.repeatably over a snapshot that flakes once',
    () => {
      const dir = genFixtureDir({ slug: 'repeatably-then-snapshot-flake' });

      when(
        '[t0] the baseline is written, then the flake runs under --ci',
        () => {
          const runs = useThen('both runs complete', () => {
            setJestFixture({ dir, body: BODY_THEN_REPEATABLY_FLAKE });
            const baseline = getOneChildRun({
              dir,
              runner: 'jest',
              args: ['-u', '--ci=false'],
              env: { FLAKE: 'none' },
            });
            const snapshot = getOneSnapshotFile({ dir, runner: 'jest' });
            const flake = getOneChildRun({
              dir,
              runner: 'jest',
              args: ['--ci'],
              env: { FLAKE: 'first' },
            });
            return { baseline, snapshot, flake };
          });

          then('the snapshot key carries no attempt ordinal', () => {
            expectRunPassed(runs.baseline);
            expect(runs.snapshot).not.toContain('attempt');
          });

          then('the flake run passes, after a retry', () => {
            expect(runs.flake.output).not.toContain('✕');
            expectRunPassed(runs.flake);
            expect(runs.flake.drives.derive).toEqual(2);
          });

          then('the withheld lines match their snapshot', () => {
            expect(
              asLinesWithMarker({
                output: runs.flake.output,
                marker: '[withheld]',
              }),
            ).toMatchSnapshot();
          });
        },
      );
    },
  );

  given('[case4] jest, EVERY over a value that flips on attempt 3', () => {
    const dir = genFixtureDir({ slug: 'repeatably-every-late-flip' });

    when('[t0] the run completes', () => {
      const run = useThen('the run completes', () => {
        setJestFixture({ dir, body: BODY_EVERY_LATE_FLIP });
        return getOneChildRun({ dir, runner: 'jest', args: [], env: {} });
      });

      then('the run fails', () => {
        expect(run.status).not.toEqual(0);
      });

      then('every attempt was driven', () => {
        expect(run.drives.derive).toEqual(3);
      });
    });
  });

  given('[case21] jest, a SOME block of one attempt', () => {
    const dir = genFixtureDir({ slug: 'repeatably-one-attempt' });

    when('[t0] its snapshot mismatches', () => {
      const run = useThen('the run completes', () => {
        setJestFixture({ dir, body: BODY_SNAPSHOT_ONE_ATTEMPT });
        getOneChildRun({
          dir,
          runner: 'jest',
          args: ['-u', '--ci=false'],
          env: {},
        });
        return getOneChildRun({
          dir,
          runner: 'jest',
          args: ['--ci'],
          env: { FLAKE: 'every' },
        });
      });

      then(
        'the mismatch is never withheld — the first attempt is the final one',
        () => {
          expect(run.status).not.toEqual(0);
          expect(run.output).not.toContain('[withheld]');
        },
      );
    });
  });

  given(
    '[case23] jest, a check that throws a distinct error on every attempt',
    () => {
      const dir = genFixtureDir({ slug: 'repeatably-throw-every-distinct' });

      when('[t0] the run completes', () => {
        const run = useThen('the run completes', () => {
          setJestFixture({ dir, body: BODY_THROW_EVERY_DISTINCT });
          return getOneChildRun({ dir, runner: 'jest', args: [], env: {} });
        });

        then('the run fails, after every attempt drove', () => {
          expect(run.status).not.toEqual(0);
          expect(run.drives.check).toEqual(3);
        });

        then(
          'the final attempt rethrows the first error of any attempt',
          () => {
            // the failure block of attempt 3, never the withheld log lines
            expect(run.output).toMatch(
              /attempt 3 › then: it holds\s+failure-of-drive-1/,
            );
          },
        );
      });
    },
  );

  given(
    '[case24] jest, a setup hook that throws a distinct error on every attempt',
    () => {
      const dir = genFixtureDir({ slug: 'repeatably-setup-every-distinct' });

      when('[t0] the run completes', () => {
        const run = useThen('the run completes', () => {
          setJestFixture({ dir, body: BODY_SETUP_EVERY_DISTINCT });
          return getOneChildRun({ dir, runner: 'jest', args: [], env: {} });
        });

        then('the run fails, after every attempt set up', () => {
          expect(run.status).not.toEqual(0);
          expect(run.drives.setup).toEqual(3);
        });

        then(
          'the final setup failure rethrows the first error of any attempt, as a test body does',
          () => {
            // the failure block of attempt 3, never the withheld log lines
            expect(run.output).toMatch(
              /attempt 3 › when: \[t0\] the scene is read › then: it is ready\s+setup-failure-of-drive-1/,
            );
          },
        );
      });
    },
  );

  given('[case22] jest, a SOME setup that returns naught', () => {
    const dir = genFixtureDir({ slug: 'repeatably-setup-void' });

    when('[t0] the run completes', () => {
      const run = useThen('the run completes', () => {
        setJestFixture({ dir, body: BODY_SETUP_VOID });
        return getOneChildRun({ dir, runner: 'jest', args: [], env: {} });
      });

      then('the run passes on the first attempt', () => {
        expectRunPassed(run);
        expect(run.output).not.toContain('[withheld]');
        expect(run.drives.setup).toEqual(1);
      });
    });
  });

  given('[case25] jest, a raw beforeAll that fails once', () => {
    const dir = genFixtureDir({ slug: 'repeatably-raw-before-all' });

    when('[t0] the run completes', () => {
      const run = useThen('the run completes', () => {
        setJestFixture({ dir, body: BODY_RAW_BEFORE_ALL_FLAKE });
        return getOneChildRun({ dir, runner: 'jest', args: [], env: {} });
      });

      then(
        'the run fails — a raw hook sits outside the retry, as documented',
        () => {
          expect(run.status).not.toEqual(0);
          expect(run.output).toContain('raw-setup-failure');
        },
      );
    });
  });

  given('[case26] jest, a useBeforeEach that fails once', () => {
    const dir = genFixtureDir({ slug: 'repeatably-before-each' });

    when('[t0] the run completes', () => {
      const run = useThen('the run completes', () => {
        setJestFixture({ dir, body: BODY_BEFORE_EACH_FLAKE });
        return getOneChildRun({ dir, runner: 'jest', args: [], env: {} });
      });

      then('the run passes after the retry', () => {
        expectRunPassed(run);
        expect(run.drives.setup).toEqual(2);
      });

      then('the failed attempt is withheld, not lost', () => {
        expect(run.output).toContain('[withheld]');
        expect(run.output).toContain('each-setup-failure');
      });

      then('the withheld lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[withheld]' }),
        ).toMatchSnapshot();
      });
    });
  });

  given('[case27] jest, a then.repeatably that never passes', () => {
    const dir = genFixtureDir({ slug: 'repeatably-then-fail-every' });

    when('[t0] the run completes', () => {
      const run = useThen('the run completes', () => {
        setJestFixture({ dir, body: BODY_THEN_REPEATABLY_FAIL_EVERY });
        return getOneChildRun({ dir, runner: 'jest', args: [], env: {} });
      });

      then('the run fails, after exactly as many drives as attempts', () => {
        expect(run.status).not.toEqual(0);
        expect(run.drives.check).toEqual(3);
      });
    });
  });

  given('[case28] jest, a setup that fails once, read by two thens', () => {
    const dir = genFixtureDir({ slug: 'repeatably-setup-two-thens' });

    when('[t0] the run completes', () => {
      const run = useThen('the run completes', () => {
        setJestFixture({ dir, body: BODY_SETUP_FLAKE_TWO_THENS });
        return getOneChildRun({ dir, runner: 'jest', args: [], env: {} });
      });

      then('the run passes after the retry', () => {
        expectRunPassed(run);
        expect(run.drives.setup).toEqual(2);
      });

      then(
        'the first withheld line is the cause, then one echo per then that read it',
        () => {
          const lines = asLinesWithMarker({
            output: run.output,
            marker: '[withheld]',
          }).split('\n');
          expect(lines).toHaveLength(3);
          expect(lines[0]).toContain('two-then-setup-failure');
          expect(lines[1]).toContain('tried to access value before setup');
          expect(lines[2]).toContain('tried to access value before setup');
          expect(lines.join('\n')).toMatchSnapshot();
        },
      );
    });
  });

  given('[case25] vitest, a raw beforeAll that fails once', () => {
    const dir = genFixtureDir({ slug: 'repeatably-vitest-raw-before-all' });

    when('[t0] the run completes', () => {
      const run = useThen('the run completes', () => {
        setVitestFixture({ dir, body: BODY_RAW_BEFORE_ALL_FLAKE });
        return getOneChildRun({ dir, runner: 'vitest', args: [], env: {} });
      });

      then(
        'the run fails — a raw hook sits outside the retry, as documented',
        () => {
          expect(run.status).not.toEqual(0);
          expect(run.output).toContain('raw-setup-failure');
        },
      );
    });
  });

  given('[case26] vitest, a useBeforeEach that fails once', () => {
    const dir = genFixtureDir({ slug: 'repeatably-vitest-before-each' });

    when('[t0] the run completes', () => {
      const run = useThen('the run completes', () => {
        setVitestFixture({ dir, body: BODY_BEFORE_EACH_FLAKE });
        return getOneChildRun({ dir, runner: 'vitest', args: [], env: {} });
      });

      then('the run passes after the retry', () => {
        expectRunPassed(run);
        expect(run.drives.setup).toEqual(2);
      });

      then('the failed attempt is withheld, not lost', () => {
        expect(run.output).toContain('[withheld]');
        expect(run.output).toContain('each-setup-failure');
      });

      then('the withheld lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[withheld]' }),
        ).toMatchSnapshot();
      });
    });
  });

  given('[case27] vitest, a then.repeatably that never passes', () => {
    const dir = genFixtureDir({ slug: 'repeatably-vitest-then-fail-every' });

    when('[t0] the run completes', () => {
      const run = useThen('the run completes', () => {
        setVitestFixture({ dir, body: BODY_THEN_REPEATABLY_FAIL_EVERY });
        return getOneChildRun({ dir, runner: 'vitest', args: [], env: {} });
      });

      then('the run fails, after exactly as many drives as attempts', () => {
        expect(run.status).not.toEqual(0);
        expect(run.drives.check).toEqual(3);
      });

      then('each drive is handed its own attempt number', () => {
        expect(run.output).toContain('check-failure-of-attempt-3-drive-3');
      });

      then('the two non-final attempts are withheld', () => {
        const lines = asLinesWithMarker({
          output: run.output,
          marker: '[withheld]',
        });
        expect(lines.split('\n')).toHaveLength(2);
        expect(lines).toMatchSnapshot();
      });
    });
  });

  given('[case7] vitest, a snapshot that mismatches on attempt 1 only', () => {
    const dir = genFixtureDir({ slug: 'repeatably-vitest-snapshot-flake' });

    when('[t0] the baseline is written, then the flake runs as ci', () => {
      const runs = useThen('both runs complete', () => {
        setVitestFixture({ dir, body: BODY_SNAPSHOT_FLAKE });
        const baseline = getOneChildRun({
          dir,
          runner: 'vitest',
          args: ['-u'],
          env: { FLAKE: 'none', CI: '' },
        });
        const snapshot = getOneSnapshotFile({ dir, runner: 'vitest' });
        const flake = getOneChildRun({
          dir,
          runner: 'vitest',
          args: [],
          env: { FLAKE: 'first', CI: 'true' },
        });
        return { baseline, snapshot, flake };
      });

      then('the baseline run passes', () => {
        expectRunPassed(runs.baseline);
      });

      then('the snapshot key carries no attempt ordinal', () => {
        expect(runs.snapshot).not.toContain('attempt');
        expect(runs.snapshot).toContain('when: [t0] the value is derived');
      });

      then('the flake run passes', () => {
        expectRunPassed(runs.flake);
      });

      then('the factory re-ran for the retry', () => {
        expect(runs.flake.drives.derive).toEqual(2);
      });

      then('the snapshot mismatch is named in the withheld log', () => {
        expect(runs.flake.output).toContain(
          '[withheld] attempt 1 failed, a retry follows',
        );
      });

      then('the withheld lines match their snapshot', () => {
        expect(
          asLinesWithMarker({
            output: runs.flake.output,
            marker: '[withheld]',
          }),
        ).toMatchSnapshot();
      });
    });
  });

  given('[case5] vitest, EVERY over a stable snapshot', () => {
    const dir = genFixtureDir({ slug: 'repeatably-vitest-snapshot-every' });

    when('[t0] the baseline is written, then re-checked as ci', () => {
      const runs = useThen('both runs complete', () => {
        setVitestFixture({ dir, body: BODY_SNAPSHOT_EVERY });
        const baseline = getOneChildRun({
          dir,
          runner: 'vitest',
          args: ['-u'],
          env: { CI: '' },
        });
        const snapshot = getOneSnapshotFile({ dir, runner: 'vitest' });
        const check = getOneChildRun({
          dir,
          runner: 'vitest',
          args: [],
          env: { CI: 'true' },
        });
        return { baseline, snapshot, check };
      });

      then('one key holds the baseline, with no attempt ordinal', () => {
        expectRunPassed(runs.baseline);
        expect(runs.snapshot).not.toContain('attempt');
        expect(runs.snapshot.split('exports[').length - 1).toEqual(1);
      });

      then('every attempt checks against it and passes', () => {
        expectRunPassed(runs.check);
        expect(runs.check.drives.derive).toEqual(3);
      });
    });
  });

  given('[case4] vitest, EVERY over a value that flips on attempt 3', () => {
    const dir = genFixtureDir({ slug: 'repeatably-vitest-every-late-flip' });

    when('[t0] the run completes', () => {
      const run = useThen('the run completes', () => {
        setVitestFixture({ dir, body: BODY_EVERY_LATE_FLIP });
        return getOneChildRun({ dir, runner: 'vitest', args: [], env: {} });
      });

      then('the run fails', () => {
        expect(run.status).not.toEqual(0);
      });

      then('every attempt was driven', () => {
        expect(run.drives.derive).toEqual(3);
      });
    });
  });

  given('[case9] vitest, an ask that hangs past the budget', () => {
    const dir = genFixtureDir({ slug: 'repeatably-vitest-timeout-flake' });

    when('[t0] the ask hangs on attempts 1 and 2, and returns on 3', () => {
      const run = useThen('the run completes', () => {
        setVitestFixture({ dir, body: BODY_TIMEOUT_FLAKE });
        return getOneChildRun({
          dir,
          runner: 'vitest',
          args: [],
          env: { HANG: 'first-two' },
        });
      });

      then('the run passes', () => {
        expectRunPassed(run);
      });

      then('the ask was driven once per attempt', () => {
        expect(run.drives.ask).toEqual(3);
      });

      then('the overrun is named in the withheld log', () => {
        expect(run.output).toContain(`exceeded the ${BUDGET_MS}ms budget`);
      });

      then('the withheld lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[withheld]' }),
        ).toMatchSnapshot();
      });
    });

    when('[t1] the ask hangs on every attempt', () => {
      const run = useThen('the run completes', () =>
        getOneChildRun({
          dir,
          runner: 'vitest',
          args: [],
          env: { HANG: 'every' },
        }),
      );

      then('the run fails', () => {
        expect(run.status).not.toEqual(0);
      });

      then('every attempt was driven', () => {
        expect(run.drives.ask).toEqual(3);
      });

      then("the final attempt's overrun is shown", () => {
        expect(run.output).toContain(`exceeded the ${BUDGET_MS}ms budget`);
      });

      then('the two non-final attempts are withheld, the final is not', () => {
        const lines = asLinesWithMarker({
          output: run.output,
          marker: '[withheld]',
        }).split('\n');

        // each attempt fails two tests: the overrun ask, and the check that reads it
        expect(lines).toHaveLength(4);
        expect(
          lines.filter((line) => line.includes('attempt 1 failed')),
        ).toHaveLength(2);
        expect(
          lines.filter((line) => line.includes('attempt 2 failed')),
        ).toHaveLength(2);
        expect(lines.some((line) => line.includes('attempt 3'))).toEqual(false);
      });

      then('the withheld lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[withheld]' }),
        ).toMatchSnapshot();
      });
    });
  });

  given('[case10] vitest, a setup hook that fails once', () => {
    const dir = genFixtureDir({ slug: 'repeatably-vitest-setup-flake' });

    when('[t0] the setup throws on attempt 1, and passes on 2', () => {
      const run = useThen('the run completes', () => {
        setVitestFixture({ dir, body: BODY_SETUP_FLAKE });
        return getOneChildRun({
          dir,
          runner: 'vitest',
          args: [],
          env: { SETUP: 'first' },
        });
      });

      then('the run passes', () => {
        expectRunPassed(run);
      });

      then('the setup re-ran for the retry', () => {
        expect(run.drives.setup).toEqual(2);
      });

      then('the setup failure is named in the withheld log', () => {
        expect(run.output).toContain(
          '[withheld] attempt 1 failed, a retry follows',
        );
      });

      then('the withheld lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[withheld]' }),
        ).toMatchSnapshot();
      });

      then('the setup after the pass is skipped, and says so', () => {
        expect(run.output).toContain(
          '[skipped] prior repeatably attempt passed (setup)',
        );
      });

      then('the skipped lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[skipped]' }),
        ).toMatchSnapshot();
      });
    });
  });

  given('[case2] vitest, an assertion that throws on attempt 1 only', () => {
    const dir = genFixtureDir({ slug: 'repeatably-vitest-throw-flake' });

    when('[t0] the flake runs', () => {
      const run = useThen('the run completes', () => {
        setVitestFixture({ dir, body: BODY_THROW_FLAKE });
        return getOneChildRun({
          dir,
          runner: 'vitest',
          args: [],
          env: { FLAKE: 'first' },
        });
      });

      then('the run passes, after a retry', () => {
        expectRunPassed(run);
        expect(run.drives.derive).toEqual(2);
      });

      then('the thrown failure is named in the withheld log', () => {
        expect(run.output).toContain(
          '[withheld] attempt 1 failed, a retry follows',
        );
      });

      then('the withheld lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[withheld]' }),
        ).toMatchSnapshot();
      });

      then('the attempt after the pass is skipped, and says so', () => {
        expect(run.output).toContain(
          '[skipped] prior repeatably attempt passed',
        );
      });

      then('the skipped lines match their snapshot', () => {
        expect(
          asLinesWithMarker({ output: run.output, marker: '[skipped]' }),
        ).toMatchSnapshot();
      });
    });
  });

  given(
    '[case9] vitest, a then.repeatably body that hangs on attempt 1',
    () => {
      const dir = genFixtureDir({ slug: 'repeatably-vitest-then-hang' });

      when('[t0] the check runs', () => {
        const run = useThen('the run completes', () => {
          setVitestFixture({ dir, body: BODY_THEN_REPEATABLY_HANG });
          return getOneChildRun({ dir, runner: 'vitest', args: [], env: {} });
        });

        then('the run passes, after a retry', () => {
          expectRunPassed(run);
          expect(run.drives.ask).toEqual(2);
        });

        then('the overrun is named in the withheld log', () => {
          expect(run.output).toContain(
            '[withheld] attempt 1 failed, a retry follows',
          );
          expect(run.output).toContain(`exceeded the ${BUDGET_MS}ms budget`);
        });

        then('the withheld lines match their snapshot', () => {
          expect(
            asLinesWithMarker({ output: run.output, marker: '[withheld]' }),
          ).toMatchSnapshot();
        });
      });
    },
  );

  given(
    '[case8] vitest, then.repeatably over a snapshot that flakes once',
    () => {
      const dir = genFixtureDir({
        slug: 'repeatably-vitest-then-snapshot-flake',
      });

      when(
        '[t0] the baseline is written, then the flake runs under --ci',
        () => {
          const runs = useThen('both runs complete', () => {
            setVitestFixture({ dir, body: BODY_THEN_REPEATABLY_FLAKE });
            const baseline = getOneChildRun({
              dir,
              runner: 'vitest',
              args: ['-u'],
              env: { FLAKE: 'none' },
            });
            const flake = getOneChildRun({
              dir,
              runner: 'vitest',
              args: [],
              env: { FLAKE: 'first', CI: 'true' },
            });
            return { baseline, flake };
          });

          then('the flake run passes, after a retry', () => {
            expectRunPassed(runs.baseline);
            expectRunPassed(runs.flake);
            expect(runs.flake.drives.derive).toEqual(2);
          });

          then('the snapshot failure is named in the withheld log', () => {
            expect(runs.flake.output).toContain(
              '[withheld] attempt 1 failed, a retry follows',
            );
          });

          then('the withheld lines match their snapshot', () => {
            expect(
              asLinesWithMarker({
                output: runs.flake.output,
                marker: '[withheld]',
              }),
            ).toMatchSnapshot();
          });
        },
      );
    },
  );
});
