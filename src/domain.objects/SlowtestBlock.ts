/**
 * .what = time data for a single test (then block)
 * .why = leaf node in block hierarchy
 */
export interface SlowtestTest {
  /** test name (with "then: " prefix) */
  name: string;

  /** test duration in ms */
  duration: number;
}

/**
 * .what = time data for a describe/given/when block
 * .why = enables hierarchical drill-down into slow blocks
 */
export interface SlowtestBlock {
  /** block type: "given", "when", "describe" */
  type: 'given' | 'when' | 'describe';

  /** block name (without type prefix) */
  name: string;

  /** total block duration in ms */
  duration: number;

  /**
   * derived hook duration: duration - sum(children)
   *
   * note
   * - includes beforeAll, afterAll, beforeEach, afterEach time
   * - derived because neither jest nor vitest expose individual hook durations
   */
  hookDuration: number;

  /** child blocks (nested given/when/describe) */
  blocks?: SlowtestBlock[];

  /** leaf tests (then blocks) */
  tests?: SlowtestTest[];
}
