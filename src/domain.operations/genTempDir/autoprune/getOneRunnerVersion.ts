// .note = RELATIVE, never the @src alias. this module sits on the globalTeardown
//         path, which a runner loads OUTSIDE its moduleNameMapper

import { UnexpectedCodePathError } from 'helpful-errors';

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  asErrnoCode,
  ERRNOS_ENTRY_ABSENT,
} from '../../../infra/isomorph.fs/asErrnoCode';
import type { TestRunner } from '../../../infra/isomorph.test/detectTestRunner';

/**
 * .what = names the runner in play, and its installed version
 * .why = a break in the mint chain is a runner-version defect, so the report must
 *        NAME the version rather than leave a human to hunt for it
 *
 * .note = the runner is DECLARED by the caller rather than detected from env, and
 *         that is forced rather than preferred. the only caller runs on the global
 *         teardown path, in the MAIN process, where neither JEST_WORKER_ID nor
 *         VITEST is set — so an env probe would report 'unknown' from precisely the
 *         one place whose entire job is to name a version
 *
 * @returns e.g. 'jest@30.2.0', or the bare name where the manifest is unreadable
 */
export const getOneRunnerVersion = (input: { runner: TestRunner }): string => {
  const version = getOneInstalledVersion({ name: input.runner });
  return version ? `${input.runner}@${version}` : input.runner;
};

/**
 * .what = reads a package's version from node_modules
 * .why = the runner's own version is the fact a maintainer needs; a require of
 *        the runner itself would load it, so we read its manifest instead
 *
 * .note = ONE guarded read, never an existsSync + an unguarded one. this reads a
 *         path we do not own, on the failure path of a report — so the check-then-act
 *         pair would answer the question twice and still throw where the answer
 *         changed between them, from the one code path whose job is to explain
 *
 * .note = narrowed via `in`, never an as-cast. the manifest is a foreign file, so
 *         its shape must be CHECKED rather than asserted (rule.forbid.as-cast)
 */
const getOneInstalledVersion = (input: { name: string }): string | null => {
  const pathManifest = path.join(
    process.cwd(),
    'node_modules',
    input.name,
    'package.json',
  );

  const content = ((): string | null => {
    try {
      return fs.readFileSync(pathManifest, 'utf8');
    } catch (error) {
      // 🔴 ALLOWLIST. an ABSENT manifest is the legitimate case this fallback
      // exists for — a consumer under pnpm's strict layout, yarn pnp, or a monorepo
      // hoist has no `./node_modules/<runner>` to read, and the bare runner name is
      // the honest answer for them.
      //
      // an EACCES or an i/o fault is NOT that case, and swallowed it degrades to a
      // name that reads AS the honest answer — so a maintainer sees `jest` and
      // concludes their layout is unusual, when their disk is at fault
      if (!ERRNOS_ENTRY_ABSENT.includes(asErrnoCode({ error }) ?? ''))
        throw error;
      return null;
    }
  })();
  if (content === null) return null;

  // 🔴 the PARSE is not allowlisted at all — it throws. a manifest that exists and
  // does not parse is a corrupt install, never a layout difference, and this call
  // sits on the failure path of a REPORT. to degrade here would answer the one
  // question that report was written to answer with a plausible guess
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== 'object' || parsed === null)
    UnexpectedCodePathError.throw('a package manifest is not an object', {
      pathManifest,
    });
  if (!('version' in parsed)) return null;

  return typeof parsed.version === 'string' ? parsed.version : null;
};
