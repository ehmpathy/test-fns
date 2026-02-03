import type { TestCase, TestModule } from 'vitest/node';
import type { Reporter } from 'vitest/reporters';

import type { SlowtestConfig } from '@src/domain.objects/SlowtestConfig';
import type {
  SlowtestFileData,
  SlowtestReport,
} from '@src/domain.objects/SlowtestReport';

import {
  buildBlockHierarchy,
  type FlatTestResult,
} from '../hierarchy/buildBlockHierarchy';
import { emitJsonReport } from '../output/emitJsonReport';
import { formatTerminalReport } from '../output/formatTerminalReport';
import {
  evaluateThreshold,
  getDefaultThreshold,
  parseThresholdToMs,
} from '../threshold/evaluateThreshold';

/**
 * intermediate data per module
 */
interface ModuleData {
  tests: FlatTestResult[];
  duration: number;
}

/**
 * .what = extract ancestor titles from test's fullName
 * .why = vitest provides fullName with " > " separator, need to split into ancestors
 */
const parseFullName = (input: {
  fullName: string;
  testName: string;
}): string[] => {
  // fullName format: "Suite A > Suite B > test name"
  const parts = input.fullName.split(' > ');

  // remove the last part (test name itself)
  if (parts.length > 1) {
    parts.pop();
  } else {
    return [];
  }

  return parts;
};

/**
 * .what = vitest reporter implementation for slowtest
 * .why = collects test time via vitest reporter lifecycle hooks
 */
export class SlowtestReporterVitest implements Reporter {
  private config: SlowtestConfig;
  private modules: Map<string, ModuleData> = new Map();
  private thresholdMs: number;
  private startTime: number = 0;

  constructor(options?: SlowtestConfig) {
    this.config = options ?? {};
    this.thresholdMs = this.config.slow
      ? parseThresholdToMs({ threshold: this.config.slow })
      : getDefaultThreshold({ scope: 'unit' });
  }

  /**
   * .what = called when vitest is initialized
   * .why = capture start time
   */
  onInit(): void {
    this.startTime = Date.now();
  }

  /**
   * .what = called when a test run starts
   * .why = reset state for new run
   */
  onTestRunStart(): void {
    this.modules.clear();
    this.startTime = Date.now();
  }

  /**
   * .what = called after a test case finishes
   * .why = collect per-test time data
   */
  onTestCaseResult(testCase: TestCase): void {
    const moduleId = testCase.module.moduleId.replace(process.cwd() + '/', '');
    const diagnostic = testCase.diagnostic();
    const duration = diagnostic?.duration ?? 0;

    // extract ancestor titles from fullName
    const ancestorTitles = parseFullName({
      fullName: testCase.fullName,
      testName: testCase.name,
    });

    // get or create module data
    if (!this.modules.has(moduleId)) {
      this.modules.set(moduleId, { tests: [], duration: 0 });
    }
    const moduleData = this.modules.get(moduleId)!;

    // add test
    moduleData.tests.push({
      ancestorTitles,
      title: testCase.name,
      duration,
    });
  }

  /**
   * .what = called when a test module finishes
   * .why = finalize module duration
   */
  onTestModuleEnd(testModule: TestModule): void {
    const moduleId = testModule.moduleId.replace(process.cwd() + '/', '');
    const diagnostic = testModule.diagnostic();
    const duration = diagnostic?.duration ?? 0;

    // update module duration
    if (this.modules.has(moduleId)) {
      this.modules.get(moduleId)!.duration = duration;
    } else {
      this.modules.set(moduleId, { tests: [], duration });
    }
  }

  /**
   * .what = called when test run completes
   * .why = emit terminal report and write json file
   */
  async onTestRunEnd(): Promise<void> {
    // build file data from collected modules
    const files: SlowtestFileData[] = [];

    for (const [path, moduleData] of this.modules) {
      // build block hierarchy from flat results
      const blocks = buildBlockHierarchy({ tests: moduleData.tests });

      // classify as slow
      const slow = evaluateThreshold({
        duration: moduleData.duration,
        threshold: this.thresholdMs,
      });

      files.push({
        path,
        duration: moduleData.duration,
        slow,
        blocks: blocks.length > 0 ? blocks : undefined,
      });
    }

    // compute total duration
    const totalDuration = Date.now() - this.startTime;

    // count slow files
    const slowCount = files.filter((f) => f.slow).length;

    // build report
    const report: SlowtestReport = {
      generated: new Date().toISOString(),
      summary: {
        total: totalDuration,
        files: files.length,
        slow: slowCount,
      },
      files,
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
}
