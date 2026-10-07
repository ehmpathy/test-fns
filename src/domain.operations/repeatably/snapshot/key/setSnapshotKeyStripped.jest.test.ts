import { getError, MalfunctionError } from 'helpful-errors';

import { given, then, useThen, when } from '@src/contract';

import type { ExpectSnapshotState } from '../getOneExpectSnapshotState';
import {
  setSnapshotKeyStripped,
  type VitestTaskNamed,
} from './setSnapshotKeyStripped';

const SCOPES = [
  { nameAttempt: 'when: the ask, attempt 2', nameBase: 'when: the ask' },
];

/**
 * .what = a fake snapshot state whose expect state is a plain record
 * .why = the jest branch reads and writes only the expect state
 */
const genSnapFake = (input: {
  state: Record<string, unknown>;
}): ExpectSnapshotState => ({
  expect: {
    getState: () => input.state,
    setState: (next) => Object.assign(input.state, next),
  },
  counters: { get: () => undefined, set: () => undefined },
  snapshotData: {},
  suppressedErrors: [],
  snapshotState: {},
});

describe('setSnapshotKeyStripped', () => {
  given('[case1] the jest runner', () => {
    when('[t0] the key is stripped, then restored', () => {
      const result = useThen('it runs', () => {
        const state: Record<string, unknown> = {
          currentTestName:
            'given: a scene when: the ask, attempt 2 then: it holds',
          currentConcurrentTestName: undefined,
        };
        const stripped = setSnapshotKeyStripped({
          runner: 'jest',
          snap: genSnapFake({ state }),
          scopes: SCOPES,
          task: null,
        });
        const nameConcurrent = state.currentConcurrentTestName;
        const nameInBody =
          typeof nameConcurrent === 'function' ? nameConcurrent() : null;
        stripped.restore();
        return { stripped, nameInBody, state };
      });

      then('the key name drops the ordinal', () => {
        expect(result.stripped.nameStripped).toEqual(
          'given: a scene when: the ask then: it holds',
        );
        expect(result.nameInBody).toEqual(
          'given: a scene when: the ask then: it holds',
        );
      });

      then('the concurrent name is restored after', () => {
        expect(result.state.currentConcurrentTestName).toEqual(undefined);
      });

      then('the current test name is restored after, with its ordinal', () => {
        expect(result.state.currentTestName).toEqual(
          'given: a scene when: the ask, attempt 2 then: it holds',
        );
      });
    });
  });

  given('[case2] the vitest runner', () => {
    when('[t0] the key is stripped, then restored', () => {
      const result = useThen('it runs', () => {
        const taskFile: VitestTaskNamed = { name: 'fixture.test.mjs' };
        const taskGiven: VitestTaskNamed = {
          name: 'given: a scene',
          suite: taskFile,
        };
        const taskWhen: VitestTaskNamed = {
          name: 'when: the ask, attempt 2',
          suite: taskGiven,
        };
        const taskThen: VitestTaskNamed = {
          name: 'then: it holds',
          suite: taskWhen,
          file: taskFile,
        };
        const stripped = setSnapshotKeyStripped({
          runner: 'vitest',
          snap: genSnapFake({ state: {} }),
          scopes: SCOPES,
          task: taskThen,
        });
        const nameInBody = taskWhen.name;
        stripped.restore();
        return { stripped, nameInBody, nameAfter: taskWhen.name };
      });

      then('the key name drops the ordinal and the file', () => {
        expect(result.stripped.nameStripped).toEqual(
          'given: a scene > when: the ask > then: it holds',
        );
        expect(result.nameInBody).toEqual('when: the ask');
      });

      then('the suite name is restored after, for the reporter', () => {
        expect(result.nameAfter).toEqual('when: the ask, attempt 2');
      });
    });
  });

  given(
    '[case3] the vitest runner, with a task whose name is no string',
    () => {
      when('[t0] the key is stripped', () => {
        const result = useThen('it fails', async () => {
          const taskWhen: VitestTaskNamed = {
            name: 'when: the ask, attempt 2',
          };
          const taskThen: VitestTaskNamed = {
            name: 'then: it holds',
            suite: taskWhen,
          };

          // .note = a runner upgrade could change the field's type; the typed shape forbids it
          Reflect.set(taskWhen, 'name', 42);
          const error = await getError(() =>
            setSnapshotKeyStripped({
              runner: 'vitest',
              snap: genSnapFake({ state: {} }),
              scopes: SCOPES,
              task: taskThen,
            }),
          );
          return { error, nameAfter: taskThen.name };
        });

        then('it fails loud, and names the field and its type', () => {
          expect(result.error).toBeInstanceOf(MalfunctionError);
          expect(result.error.message).toContain(
            'the vitest runner no longer exposes task.name as a string',
          );
          expect(result.error.message).toContain('"nameType": "number"');
        });

        then('the message matches its snapshot', () => {
          expect(result.error.message).toMatchSnapshot();
        });

        then('no task in the chain was renamed', () => {
          expect(result.nameAfter).toEqual('then: it holds');
        });
      });
    },
  );
});
