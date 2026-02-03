import * as fs from 'fs/promises';
import * as path from 'path';

import type { SlowtestConfig } from '@src/domain.objects/SlowtestConfig';
import type {
  SlowtestReport,
  SlowtestShardReport,
} from '@src/domain.objects/SlowtestReport';

/**
 * .what = format report for shard output
 * .why = simplified format for ci shard tools
 */
const formatShardReport = (report: SlowtestReport): SlowtestShardReport => {
  const files: Record<string, number> = {};
  for (const file of report.files) {
    files[file.path] = file.duration;
  }
  return { version: 1, files };
};

/**
 * .what = write time data to json file
 * .why = enables tools, trends, and shard optimization
 */
export const emitJsonReport = async (input: {
  report: SlowtestReport;
  config: SlowtestConfig;
}): Promise<void> => {
  // skip if no output path configured
  if (!input.config.output) return;

  // ensure output directory exists
  const dir = path.dirname(input.config.output);
  await fs.mkdir(dir, { recursive: true });

  // format based on config.format
  const content =
    input.config.format === 'shard'
      ? formatShardReport(input.report)
      : input.report;

  // write json file
  await fs.writeFile(input.config.output, JSON.stringify(content, null, 2));
};
