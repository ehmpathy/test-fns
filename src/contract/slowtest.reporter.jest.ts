/**
 * .what = slowtest reporter for jest
 * .why = provides jest-compatible reporter via `test-fns/slowtest.reporter.jest`
 *
 * .usage:
 *   // jest.config.ts
 *   reporters: [
 *     'default',
 *     ['test-fns/slowtest.reporter.jest', { slow: '3s', output: '.slowtest/report.json' }]
 *   ]
 */

// biome-ignore lint/style/noDefaultExport: jest reporter api requires default export
export { default } from '@src/domain.operations/slowtestReporter/reporter/SlowtestReporterJest';
// re-export types for convenience
export type {
  SlowtestBlock,
  SlowtestConfig,
  SlowtestFileData,
  SlowtestReport,
  SlowtestShardReport,
  SlowtestTest,
} from '@src/domain.operations/slowtestReporter/slowtestReporter';
