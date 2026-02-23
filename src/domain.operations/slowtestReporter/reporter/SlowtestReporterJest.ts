import type {
  AggregatedResult,
  Config,
  Reporter,
  ReporterOnStartOptions,
  Test,
  TestContext,
  TestResult,
} from '@jest/reporters';

import type { SlowtestConfig } from '@src/domain.objects/SlowtestConfig';
import type {
  SlowtestFileData,
  SlowtestReport,
} from '@src/domain.objects/SlowtestReport';
import {
  buildBlockHierarchy,
  type FlatTestResult,
} from '@src/domain.operations/slowtestReporter/hierarchy/buildBlockHierarchy';
import { emitJsonReport } from '@src/domain.operations/slowtestReporter/output/emitJsonReport';
import { formatTerminalReport } from '@src/domain.operations/slowtestReporter/output/formatTerminalReport';
import {
  evaluateThreshold,
  getDefaultThreshold,
  parseThresholdToMs,
} from '@src/domain.operations/slowtestReporter/threshold/evaluateThreshold';

/**
 * .what = jest reporter implementation for slowtest
 * .why = collects test time via jest reporter lifecycle hooks
 */
export class SlowtestReporterJest implements Reporter {
  private config: SlowtestConfig;
  private files: SlowtestFileData[] = [];
  private thresholdMs: number;

  constructor(_globalConfig: Config.GlobalConfig, options?: SlowtestConfig) {
    this.config = options ?? {};
    this.thresholdMs = this.config.slow
      ? parseThresholdToMs({ threshold: this.config.slow })
      : getDefaultThreshold({ scope: 'unit' });
  }

  /**
   * .what = called when test run starts
   * .why = optional; can be used for init
   */
  onRunStart(
    _results: AggregatedResult,
    _options: ReporterOnStartOptions,
  ): void {
    // no-op: we collect data at test execution time
  }

  /**
   * .what = called after each test file completes
   * .why = collect per-file and per-test time data
   */
  onTestFileResult(
    _test: Test,
    testResult: TestResult,
    _aggregatedResult: AggregatedResult,
  ): void {
    // extract file path relative to cwd
    const filePath = testResult.testFilePath.replace(process.cwd() + '/', '');

    // compute file duration from perfStats
    const fileDuration = testResult.perfStats.end - testResult.perfStats.start;

    // convert jest test results to flat format for hierarchy builder
    const flatTests: FlatTestResult[] = testResult.testResults.map((tr) => ({
      ancestorTitles: tr.ancestorTitles,
      title: tr.title,
      duration: tr.duration ?? 0,
    }));

    // build block hierarchy from flat results
    const blocks = buildBlockHierarchy({ tests: flatTests });

    // classify as slow
    const slow = evaluateThreshold({
      duration: fileDuration,
      threshold: this.thresholdMs,
    });

    // store file data
    this.files.push({
      path: filePath,
      duration: fileDuration,
      slow,
      blocks: blocks.length > 0 ? blocks : undefined,
    });
  }

  /**
   * .what = called when test file starts
   * .why = optional; not used for slowtest
   */
  onTestFileStart(_test: Test): void {
    // no-op
  }

  /**
   * .what = called when a test case result is available
   * .why = optional; we use onTestFileResult instead
   */
  onTestCaseResult(_test: Test, _testCaseResult: unknown): void {
    // no-op: we collect all data in onTestFileResult
  }

  /**
   * .what = called after all tests complete
   * .why = emit terminal report and write json file
   */
  async onRunComplete(
    _testContexts: Set<TestContext>,
    results: AggregatedResult,
  ): Promise<void> {
    // compute total duration
    const totalDuration = results.startTime
      ? Date.now() - results.startTime
      : this.files.reduce((sum, f) => sum + f.duration, 0);

    // count slow files
    const slowCount = this.files.filter((f) => f.slow).length;

    // build report
    const report: SlowtestReport = {
      generated: new Date().toISOString(),
      summary: {
        total: totalDuration,
        files: this.files.length,
        slow: slowCount,
      },
      files: this.files,
    };

    // emit terminal report
    const terminalOutput = formatTerminalReport({
      report,
      config: this.config,
    });
    console.log(terminalOutput);

    // emit json report if configured
    await emitJsonReport({ report, config: this.config });
  }

  /**
   * .what = get the last error encountered
   * .why = required by Reporter interface
   */
  getLastError(): Error | undefined {
    return undefined;
  }
}

// biome-ignore lint/style/noDefaultExport: jest reporter api requires default export for custom reporters
export default SlowtestReporterJest;
