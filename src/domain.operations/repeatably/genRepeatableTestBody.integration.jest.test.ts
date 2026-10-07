import { getError, MalfunctionError } from 'helpful-errors';

import { given, then, useThen, when } from '@src/contract';

import type { RepeatableState } from '../registryDescribeRepeatable';
import { genRepeatableState } from './genRepeatableState';
import { genRepeatableTestBody } from './genRepeatableTestBody';

/**
 * .what = a SOME state at attempt 1
 * .why = a SOME state makes the body read the time budget, the fail-loud read under test
 */
const genStateDemo = (): RepeatableState => ({
  ...genRepeatableState({ attempts: 3 }),
  thisAttemptIndex: 1,
});

describe('genRepeatableTestBody', () => {
  given(
    '[case1] a vitest attempt whose runner budget cannot be read (here, under jest)',
    () => {
      when('[t0] the body runs', () => {
        const result = useThen('it fails loud', async () => {
          // a vitest task chain whose names carry the attempt ordinal
          const suite = { name: 'when: the wave is read, attempt 1' };
          const task = { name: 'then: it holds', suite, id: 'task-1' };
          const body = genRepeatableTestBody({
            testFn: () => undefined,
            ctx: genStateDemo(),
            scopes: [
              {
                nameAttempt: 'when: the wave is read, attempt 1',
                nameBase: 'when: the wave is read',
              },
            ],
            runner: 'vitest',
          });
          const error = await getError(() => body({ task }));
          return { error, suite, task };
        });

        then('the budget read fails loud', () => {
          expect(result.error).toBeInstanceOf(MalfunctionError);
          expect(result.error.message).toContain(
            'could not read the test timeout budget',
          );
        });

        then('the surfaced message matches its snapshot', () => {
          // .note = the installed runner version is masked, so a runner bump does not resnap
          expect(
            result.error.message.replace(
              /(jest|vitest)@[\w.-]+/g,
              '$1@<version>',
            ),
          ).toMatchSnapshot();
        });

        then(
          'the shared task names are left as found, so no neighbor test inherits a rename',
          () => {
            expect(result.suite.name).toEqual(
              'when: the wave is read, attempt 1',
            );
            expect(result.task.name).toEqual('then: it holds');
          },
        );
      });
    },
  );
});
