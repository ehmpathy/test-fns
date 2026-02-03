/**
 * .what = slowtest reporter for vitest
 * .why = provides vitest-compatible reporter via `test-fns/slowtest.reporter.vitest`
 *
 * .usage:
 *   // vitest.config.ts
 *   export default defineConfig({
 *     test: {
 *       reporters: [
 *         'default',
 *         ['test-fns/slowtest.reporter.vitest', { slow: '3s', output: '.slowtest/report.json' }]
 *       ]
 *     }
 *   })
 */

// biome-ignore lint/style/noDefaultExport: vitest reporter api requires default export
export { SlowtestReporterVitest as default } from '@src/domain.operations/slowtestReporter/reporter/SlowtestReporterVitest';
// re-export types for convenience
export type {
  SlowtestBlock,
  SlowtestConfig,
  SlowtestFileData,
  SlowtestReport,
  SlowtestShardReport,
  SlowtestTest,
} from '@src/domain.operations/slowtestReporter/slowtestReporter';
