import type { Config } from '@jest/reporters';

import type { SlowtestConfig } from '@src/domain.objects/SlowtestConfig';

import { SlowtestReporterJest } from './reporter/SlowtestReporterJest';
import { SlowtestReporterVitest } from './reporter/SlowtestReporterVitest';

/**
 * .what = factory function that returns runner-specific reporter
 * .why = provides unified api that creates the correct reporter type
 *
 * note
 * - use slowtestReporter.jest() for explicit jest reporter
 * - use slowtestReporter.vitest() for explicit vitest reporter
 * - the factory itself cannot auto-detect since it runs at config time
 */
export const slowtestReporter = {
  /**
   * .what = create jest reporter instance
   * .why = use in jest.config.ts reporters array
   */
  jest: (config?: SlowtestConfig): typeof SlowtestReporterJest => {
    // return the class itself (jest instantiates it)
    // store config for later via closure
    return class extends SlowtestReporterJest {
      constructor(globalConfig: Config.GlobalConfig) {
        super(globalConfig, config);
      }
    } as typeof SlowtestReporterJest;
  },

  /**
   * .what = create vitest reporter instance
   * .why = use in vitest.config.ts reporters array
   */
  vitest: (config?: SlowtestConfig): SlowtestReporterVitest => {
    return new SlowtestReporterVitest(config);
  },
};

export type {
  SlowtestBlock,
  SlowtestTest,
} from '@src/domain.objects/SlowtestBlock';
// re-export types for convenience
export type { SlowtestConfig } from '@src/domain.objects/SlowtestConfig';
export type {
  SlowtestFileData,
  SlowtestReport,
  SlowtestShardReport,
} from '@src/domain.objects/SlowtestReport';
