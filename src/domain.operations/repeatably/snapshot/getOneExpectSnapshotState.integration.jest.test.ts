import { getError, MalfunctionError } from 'helpful-errors';

import { given, then, useThen, when } from '@src/contract';

import { getOneExpectSnapshotState } from './getOneExpectSnapshotState';

/**
 * .what = runs a read with one live jest internal replaced, then restores it
 * .why = each fail-loud branch guards one runner internal; the only way to reach a
 *        branch is to remove that internal from the live runner for one call
 */
const getErrorWithInternalBroken = async (input: {
  owner: () => object;
  key: string | symbol;
  value: unknown;
}): Promise<Error> => {
  const owner = input.owner();
  const valueBefore: unknown = Reflect.get(owner, input.key);
  Reflect.set(owner, input.key, input.value);
  try {
    return await getError(() => getOneExpectSnapshotState({ runner: 'jest' }));
  } finally {
    Reflect.set(owner, input.key, valueBefore);
  }
};

/** the live jest expect state, whose fields the cases below break one at a time */
const getStateLive = (): object => expect.getState();

/** the live jest snapshot state of this file */
const getSnapshotStateLive = (): object =>
  Reflect.get(expect.getState(), 'snapshotState');

const TEST_CASES = [
  {
    field: 'expect.getState',
    owner: () => globalThis,
    key: 'expect',
    value: {},
  },
  {
    field: 'expect.getState()',
    owner: () => globalThis,
    key: 'expect',
    value: { getState: () => null, setState: () => undefined },
  },
  {
    field: 'expect.getState().snapshotState',
    owner: getStateLive,
    key: 'snapshotState',
    value: undefined,
  },
  {
    field: 'snapshotState._counters',
    owner: getSnapshotStateLive,
    key: '_counters',
    value: null,
  },
  {
    field: 'snapshotState._counters.get',
    owner: getSnapshotStateLive,
    key: '_counters',
    value: { set: () => undefined },
  },
  {
    field: 'snapshotState._counters.set',
    owner: getSnapshotStateLive,
    key: '_counters',
    value: { get: () => undefined },
  },
  {
    field: 'snapshotState._snapshotData',
    owner: getSnapshotStateLive,
    key: '_snapshotData',
    value: null,
  },
  {
    field: 'expect.getState().suppressedErrors',
    owner: getStateLive,
    key: 'suppressedErrors',
    value: undefined,
  },
  {
    field: 'snapshotState.unmatched',
    owner: getSnapshotStateLive,
    key: 'unmatched',
    value: 'not-a-number',
  },
];

describe('getOneExpectSnapshotState', () => {
  given('[case1] the jest runner, with every internal in place', () => {
    when('[t0] the state is read', () => {
      then('it returns the typed slice', () => {
        const snap = getOneExpectSnapshotState({ runner: 'jest' });
        expect(typeof snap.expect.getState).toEqual('function');
        expect(Array.isArray(snap.suppressedErrors)).toEqual(true);
      });
    });
  });

  given('[case2] the jest runner, with one internal absent', () => {
    TEST_CASES.map((thisCase, index) =>
      when(`[t${index}] ${thisCase.field} is absent`, () => {
        const result = useThen('the read fails', async () => ({
          error: await getErrorWithInternalBroken(thisCase),
        }));

        then('it fails loud, and names the absent field', () => {
          expect(result.error).toBeInstanceOf(MalfunctionError);
          expect(result.error.message).toContain(
            `the jest runner no longer exposes ${thisCase.field}`,
          );
        });

        then('the message matches its snapshot', () => {
          // .note = the installed runner version is masked, so a jest bump does not resnap
          expect(
            result.error.message.replace(
              /(jest|vitest)@[\w.-]+/g,
              '$1@<version>',
            ),
          ).toMatchSnapshot();
        });
      }),
    );
  });

  given('[case3] the message a maintainer reads', () => {
    when('[t0] the snapshot counters are absent', () => {
      then('the message matches its snapshot', async () => {
        const error = await getErrorWithInternalBroken(TEST_CASES[3]!);
        expect(
          error.message.replace(/(jest|vitest)@[\w.-]+/g, '$1@<version>'),
        ).toMatchSnapshot();
      });
    });
  });
});
