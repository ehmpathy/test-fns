import { given, then, useThen, when } from '@src/contract';

import { reportAttemptWithheld } from './reportAttemptWithheld';

/**
 * .what = the line reportAttemptWithheld logs for one failure
 * .why = each case reads the one line a consumer sees, and naught else
 */
const getOneLineLogged = (input: {
  attemptIndex: number;
  failure: unknown;
}): string => {
  const spy = jest.spyOn(console, 'log');
  try {
    reportAttemptWithheld(input);
    return String(spy.mock.calls.at(-1)?.[0] ?? '');
  } finally {
    spy.mockRestore();
  }
};

const TEST_CASES = [
  {
    description: 'a thrown error logs its first line only',
    given: { failure: new Error('boom\n    at stack line') },
    expect: { tail: 'a retry follows: boom' },
  },
  {
    description: 'a blank-led message logs its first non-blank line',
    given: { failure: new Error('\n\n  setup-failure-of-drive-1\n') },
    expect: { tail: 'a retry follows: setup-failure-of-drive-1' },
  },
  {
    description: 'a jest snapshot mismatch also names the snapshot',
    given: {
      failure: new Error(
        'expect(received).toMatchSnapshot()\n\nSnapshot name: `a value 1`\n\n- Snapshot\n+ Received',
      ),
    },
    expect: {
      tail: 'a retry follows: expect(received).toMatchSnapshot() — Snapshot name: `a value 1`',
    },
  },
  {
    description: 'a non-error throw logs its string form',
    given: { failure: 'plain string thrown' },
    expect: { tail: 'a retry follows: plain string thrown' },
  },
];

describe('reportAttemptWithheld', () => {
  given('[case1] each failure kind', () => {
    TEST_CASES.map((thisCase, index) =>
      when(`[t${index}] ${thisCase.description}`, () => {
        const result = useThen('the line is logged', () => ({
          line: getOneLineLogged({
            attemptIndex: 2,
            failure: thisCase.given.failure,
          }),
        }));

        then('the line names the attempt and the failure', () => {
          expect(result.line).toContain('🫧  [withheld] attempt 2 failed');
          expect(result.line.endsWith(thisCase.expect.tail)).toEqual(true);
        });

        then('the line is one line', () => {
          expect(result.line.includes('\n')).toEqual(false);
        });

        then('the line sits under its test, at a six-space indent', () => {
          expect(result.line).toMatch(/^ {6}🫧/);
        });

        then('the line matches its snapshot', () => {
          // .note = trimmed, as the acceptance snapshots hold it; the indent is asserted above
          expect(result.line.trim()).toMatchSnapshot();
        });
      }),
    );
  });
});
