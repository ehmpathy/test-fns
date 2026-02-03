/**
 * .what = config options for slowtest reporter
 * .why = allows users to customize slow threshold, output, and display
 */
export interface SlowtestConfig {
  /**
   * slow threshold in ms or human-readable string (e.g., "3s", "500ms")
   *
   * note
   * - when string, parsed via iso-time to milliseconds
   * - default: 3000ms for unit tests, 10000ms for integration/acceptance
   */
  slow?: number | string;

  /**
   * output json path (e.g., ".slowtest/report.json")
   *
   * note
   * - if not set, json output is skipped
   * - directory created if absent
   */
  output?: string;

  /**
   * output format for json file
   *
   * - 'full': nested hierarchy with all block details
   * - 'shard': simplified map { path: duration } for shard tools
   *
   * default: 'full'
   */
  format?: 'full' | 'shard';

  /**
   * max files to show in terminal output
   *
   * note
   * - when set, only top N slowest files displayed
   * - json output always contains all files regardless
   */
  top?: number;
}
