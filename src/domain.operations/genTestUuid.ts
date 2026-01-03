import { v4 as uuid } from 'uuid';

/**
 * generates a random uuid namespaced for tests, pattern `beef****-****-****-****-********beef`
 *
 * usecase
 * - produces a uuid that can be clearly identified as one produced for tests
 */
export const genTestUuid = (): string => {
  return ['beef', uuid().slice(4, -4), 'beef'].join('');
};

/**
 * decides whether a uuid is namespaced for tests
 */
export const isTestUuid = (userUuid: string): boolean =>
  /^beef.{4}-.{4}-.{4}-.{4}-.{8}beef$/.test(userUuid);
