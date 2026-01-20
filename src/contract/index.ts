/**
 * .what = public contract for test-fns library
 * .why = provides the stable public API surface, re-exports from domain.operations
 */

// forward the getError method since it is almost always needed with tests
export { getError } from 'helpful-errors';

// test utilities
export {
  genTempDir,
  isTempDir,
} from '@src/domain.operations/genTempDir/genTempDir';
export { genTestUuid } from '@src/domain.operations/genTestUuid';
export { bdd, given, then, when } from '@src/domain.operations/givenWhenThen';
export {
  useBeforeAll,
  useBeforeEach,
  usePrep,
} from '@src/domain.operations/usePrep';
export { useThen } from '@src/domain.operations/useThen';
export { useWhen } from '@src/domain.operations/useWhen';
