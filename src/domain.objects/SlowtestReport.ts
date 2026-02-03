import type { SlowtestBlock } from './SlowtestBlock';

/**
 * .what = time data for a single test file
 * .why = captures file-level and block-level time
 */
export interface SlowtestFileData {
  /** relative path to test file */
  path: string;

  /** total file duration in ms */
  duration: number;

  /** whether file exceeds slow threshold */
  slow: boolean;

  /**
   * nested block hierarchy (if bdd structure detected)
   *
   * note
   * - present when given/when/then structure found
   * - absent for plain describe/it tests
   */
  blocks?: SlowtestBlock[];
}

/**
 * .what = full slowtest report data
 * .why = captures all time data for terminal output and json export
 */
export interface SlowtestReport {
  /** iso timestamp when report was generated */
  generated: string;

  /** summary statistics */
  summary: {
    /** total duration in ms */
    total: number;

    /** count of test files */
    files: number;

    /** count of files above slow threshold */
    slow: number;
  };

  /** per-file time data */
  files: SlowtestFileData[];
}

/**
 * .what = simplified shard report format
 * .why = minimal format for shard tools to parse
 */
export interface SlowtestShardReport {
  /** format version */
  version: 1;

  /** map of file path to duration in ms */
  files: Record<string, number>;
}
