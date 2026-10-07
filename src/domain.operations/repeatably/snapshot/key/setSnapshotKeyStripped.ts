import { MalfunctionError } from 'helpful-errors';

import type { TestRunner } from '@src/infra/isomorph.test/detectTestRunner';

import type { RepeatableScope } from '../../../registryDescribeRepeatable';
import type { ExpectSnapshotState } from '../getOneExpectSnapshotState';
import { asTestNameWithoutAttempts } from './asTestNameWithoutAttempts';

/**
 * .what = the slice of a vitest task this code reads: its name and its parent
 * .why = vitest derives a snapshot key from the task chain, so the chain is the lever
 */
export interface VitestTaskNamed {
  name: string;
  suite?: VitestTaskNamed;
  file?: unknown;
}

/**
 * .what = points the snapshot key of the test under way at its ordinal-free name
 * .why = every attempt must check one baseline. the reported test name keeps its
 *        `, attempt N`, so a human still reads which attempt ran
 *
 * .note = each runner derives the key differently, so each has its own lever:
 *         - jest keys on `currentConcurrentTestName?.() ?? currentTestName`, both on
 *           the expect state (jest-snapshot `_toMatchSnapshot`) — so both are pointed
 *           at the stripped name for the body, and both restored after, so a
 *           consumer's own hook that reads the name still sees the real one
 *         - vitest keys on the task chain's names (`getNames(task).slice(1)`), read at
 *           each `toMatchSnapshot` call — so the attempt suites are renamed for the
 *           body, and restored after, before the reporter reads them
 *
 * @returns the stripped name the key now carries, and a restore for the vitest rename
 */
export const setSnapshotKeyStripped = (input: {
  runner: TestRunner;
  snap: ExpectSnapshotState;
  scopes: RepeatableScope[];
  task: VitestTaskNamed | null;
}): { nameStripped: string; restore: () => void } => {
  // jest: overwrite the name the key derives from, for the body
  if (input.runner === 'jest') {
    const stateBefore = input.snap.expect.getState();
    const nameConcurrentBefore: unknown = stateBefore.currentConcurrentTestName;
    const nameCurrentBefore: unknown = stateBefore.currentTestName;
    const nameAttempt = String(
      (typeof nameConcurrentBefore === 'function'
        ? nameConcurrentBefore()
        : undefined) ??
        stateBefore.currentTestName ??
        '',
    );
    const nameStripped = asTestNameWithoutAttempts({
      name: nameAttempt,
      scopes: input.scopes,
    });
    input.snap.expect.setState({
      currentTestName: nameStripped,
      currentConcurrentTestName: () => nameStripped,
    });
    return {
      nameStripped,
      restore: () =>
        input.snap.expect.setState({
          currentTestName: nameCurrentBefore,
          currentConcurrentTestName: nameConcurrentBefore,
        }),
    };
  }

  // vitest: rename each task in the chain that carries an ordinal
  const chain = getAllTasksInChain({ task: input.task });

  // fail loud on a task whose name is not a string, rather than key on "undefined"
  const taskUnnamed = chain.find((task) => typeof task.name !== 'string');
  if (taskUnnamed)
    throw new MalfunctionError(
      'repeatably: the vitest runner no longer exposes task.name as a string',
      {
        field: 'task.name',
        nameType: typeof taskUnnamed.name,
        hint: 'test-fns reads this runner internal to give each repeatable attempt one snapshot key; please report the runner version at https://github.com/ehmpathy/test-fns/issues',
      },
    );

  const namesBefore = chain.map((task) => task.name);
  chain.forEach((task) => {
    // .note = deliberate mutation: vitest reads the live task name for the key
    task.name = asTestNameWithoutAttempts({
      name: task.name,
      scopes: input.scopes,
    });
  });
  const nameStripped = chain
    .filter((task) => task !== input.task?.file && task.name.length > 0)
    .map((task) => task.name)
    .join(' > ');
  return {
    nameStripped,
    restore: () =>
      chain.forEach((task, index) => {
        task.name = namesBefore[index] ?? task.name;
      }),
  };
};

/**
 * .what = lists a vitest task and its parents, outermost first
 * .why = mirrors vitest's own `getNames`, so the stripped name matches its key
 *
 * .note = a top-level suite's `suite` may or may not be the file task, so the caller
 *         drops the file by identity (`task.file`), never by position
 */
const getAllTasksInChain = (input: {
  task: VitestTaskNamed | null;
}): VitestTaskNamed[] =>
  input.task
    ? [...getAllTasksInChain({ task: input.task.suite ?? null }), input.task]
    : [];
