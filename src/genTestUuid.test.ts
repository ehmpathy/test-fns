import { genTestUuid, isTestUuid } from './genTestUuid';

describe('genTestUuid', () => {
  it('should generate a uuid', () => {
    const uuid = genTestUuid();
    expect(uuid).toBeTruthy();
  });
  it('should generate a uuid that is namespaced for testing by whodis', () => {
    const uuid = genTestUuid();
    expect(uuid).toMatch(/^beef.*-.*-.*-.*-.*beef$/);
    expect(isTestUuid(uuid)).toEqual(true);
  });
  it('should generate a uuid that is different every time', () => {
    const uuid1 = genTestUuid();
    const uuid2 = genTestUuid();
    expect(uuid1).not.toEqual(uuid2);
  });
});
