// .note = RELATIVE, never the @src alias. this module sits on the globalSetup
//         path, which a runner loads OUTSIDE its moduleNameMapper — so every
//         module reachable from a setup adapter must import without the alias
import { genIsolatedTempInfra } from '../../infra/isomorph.fs/genIsolatedTempInfra';
import { getGitRoot } from '../../infra/isomorph.fs/getGitRoot';

/**
 * .what = yields the root that genTempDir writes into, both views of it
 * .why = a consumer who counts temp dirs — or points a human at one — must
 *        DERIVE that path, never hardcode a literal of it. the root is keyed on
 *        the repo, so a change to that key moves the dirs; a hardcoded literal
 *        would then count zero before and zero after, and read as green
 *
 * @returns pathPhysical — the real dir, outside every git repo (/tmp/test-fns/...)
 * @returns pathSymlink — the discoverable link at @gitroot/.temp/genTempDir.symlink
 *
 * @example
 * const { pathPhysical } = getOneTempDirRoot();
 * const count = fs
 *   .readdirSync(pathPhysical)
 *   .filter((name) => isTempDir({ path: name })).length;
 *
 * @note
 * - the root holds a readme.md and a .gitignore by construction, so a RAW entry
 *   count reads 2 on a pristine root. filter through isTempDir
 * - it is idempotent: it findserts the root rather than assume one exists
 */
export const getOneTempDirRoot = (): {
  pathPhysical: string;
  pathSymlink: string;
} => genIsolatedTempInfra({ gitRoot: getGitRoot() });
