import { given, then, when } from '@src/contract';

import { asErrno } from './asErrno';

/**
 * .what = the clamp on the ONE reason a residue report is worth a human's read
 * .why = 🔴 a reader this small invites a copy per reclaim, and two copies part
 *        company on the branch they rarely take: one falls back to `error.message`
 *        where `code` is absent, the other reports a bare 'UNKNOWN' for the SAME
 *        error. so one reclaim tells the human what went wrong and the other shrugs
 *
 * .note = a divergence like that hides from an `EACCES` drive — the path where any
 *         two copies agree. so a shared declaration with no clamp on the branch they
 *         would disagree upon re-diverges with no signal at all
 */
describe('asErrno', () => {
  given('an error that carries a filesystem code', () => {
    when('the errno is read', () => {
      then('it names the code', () => {
        const error = Object.assign(new Error('permission denied'), {
          code: 'EACCES',
        });
        expect(asErrno({ error })).toEqual('EACCES');
      });

      then('it prefers the code over the message', () => {
        const error = Object.assign(new Error('permission denied'), {
          code: 'EBUSY',
        });
        expect(asErrno({ error })).not.toEqual('permission denied');
      });
    });
  });

  given('an error that carries NO code, only a message', () => {
    when('the errno is read', () => {
      then('🔴 it names the message rather than shrug', () => {
        const error = new Error('the mount went away mid-remove');
        expect(asErrno({ error })).toEqual('the mount went away mid-remove');
      });

      then('🔴 it never shrugs a bare UNKNOWN where a message exists', () => {
        const error = new Error('the mount went away mid-remove');
        expect(asErrno({ error })).not.toEqual('UNKNOWN');
      });
    });
  });

  given('a thrown value that is no error at all', () => {
    when('the errno is read', () => {
      then('it says UNKNOWN rather than throw a second time', () => {
        expect(asErrno({ error: 'a bare string' })).toEqual('UNKNOWN');
        expect(asErrno({ error: null })).toEqual('UNKNOWN');
        expect(asErrno({ error: undefined })).toEqual('UNKNOWN');
        expect(asErrno({ error: 42 })).toEqual('UNKNOWN');
      });
    });
  });

  given('an error whose code is present but not a string', () => {
    when('the errno is read', () => {
      then('it falls through to the message rather than coerce', () => {
        const error = Object.assign(new Error('a numeric code'), { code: 13 });
        expect(asErrno({ error })).toEqual('a numeric code');
      });
    });
  });
});
