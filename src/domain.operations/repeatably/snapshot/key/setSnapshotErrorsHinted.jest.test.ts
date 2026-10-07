import { given, then, when } from '@src/contract';

import { setSnapshotErrorsHinted } from './setSnapshotErrorsHinted';

describe('setSnapshotErrorsHinted', () => {
  given('[case1] a snapshot error beside an unrelated throw', () => {
    when('[t0] the failures are hinted', () => {
      const errorSnapshot = new Error(
        'expect(received).toMatchSnapshot()\n\nNew snapshot was not written.',
      );
      const errorOther = new Error('boom');
      setSnapshotErrorsHinted({ failures: [errorSnapshot, errorOther, null] });

      then('the snapshot error carries the hint', () => {
        expect(errorSnapshot.message).toContain('run the suite once with -u');
      });

      then('the snapshot error message matches its snapshot', () => {
        expect(errorSnapshot.message).toMatchSnapshot();
      });

      then('the unrelated throw is untouched', () => {
        expect(errorOther.message).toEqual('boom');
      });
    });

    when('[t1] the same failure is hinted twice', () => {
      const errorSnapshot = new Error('Snapshot `a value 1` mismatched');
      setSnapshotErrorsHinted({ failures: [errorSnapshot] });
      const messageOnce = errorSnapshot.message;
      setSnapshotErrorsHinted({ failures: [errorSnapshot] });

      then('the hint appears once', () => {
        expect(errorSnapshot.message).toEqual(messageOnce);
      });
    });
  });

  given("[case2] a consumer's own error that mentions snapshots", () => {
    when('[t0] the failures are hinted', () => {
      const errorConsumer = new Error(
        'expected the backup snapshot to hold 3 rows, got 2',
      );
      setSnapshotErrorsHinted({ failures: [errorConsumer] });

      then(
        'it is untouched, so no resnap advice lands on an unrelated bug',
        () => {
          expect(errorConsumer.message).toEqual(
            'expected the backup snapshot to hold 3 rows, got 2',
          );
        },
      );
    });
  });

  given('[case3] a vitest snapshot mismatch', () => {
    when('[t0] the failures are hinted', () => {
      const errorVitest = new Error('Snapshot `a value 1` mismatched');
      setSnapshotErrorsHinted({ failures: [errorVitest] });

      then('it carries the hint', () => {
        expect(errorVitest.message).toContain('run the suite once with -u');
      });
    });
  });
});
