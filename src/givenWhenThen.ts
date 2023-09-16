export const given = (desc: string, fn: () => Promise<void> | void): void =>
  describe(`given: ${desc}`, fn);
export const when = (desc: string, fn: () => Promise<void> | void): void =>
  describe(`when: ${desc}`, fn);
export const then = (desc: string, fn: () => Promise<void> | void): void =>
  test(`then: ${desc}`, fn as any);
