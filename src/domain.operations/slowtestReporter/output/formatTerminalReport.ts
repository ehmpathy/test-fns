import { asDurationInWords, type IsoDurationShape } from 'iso-time';

import type { SlowtestBlock } from '@src/domain.objects/SlowtestBlock';
import type { SlowtestConfig } from '@src/domain.objects/SlowtestConfig';
import type { SlowtestReport } from '@src/domain.objects/SlowtestReport';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = MS_PER_SECOND * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;

/**
 * .what = convert milliseconds to IsoDurationShape
 * .why = iso-time's asDurationInWords needs a proper duration shape
 */
const msToShape = (ms: number): IsoDurationShape => {
  if (ms === 0) return { seconds: 0 };

  const hours = Math.floor(ms / MS_PER_HOUR);
  const remainderAfterHours = ms % MS_PER_HOUR;

  const minutes = Math.floor(remainderAfterHours / MS_PER_MINUTE);
  const remainderAfterMinutes = remainderAfterHours % MS_PER_MINUTE;

  const seconds = Math.floor(remainderAfterMinutes / MS_PER_SECOND);
  const milliseconds = remainderAfterMinutes % MS_PER_SECOND;

  // return shape with largest non-zero unit
  if (hours > 0) return { hours, minutes, seconds, milliseconds };
  if (minutes > 0) return { minutes, seconds, milliseconds };
  if (seconds > 0) return { seconds, milliseconds };
  if (milliseconds > 0) return { milliseconds };

  return { seconds: 0 };
};

/**
 * .what = format duration in ms to human-readable string via iso-time
 * .why = provides consistent duration display across report
 */
export const formatDuration = (input: { ms: number }): string => {
  const shape = msToShape(input.ms);
  return asDurationInWords(shape);
};

/**
 * .what = render a single block with tree structure
 * .why = creates visual hierarchy for nested blocks via tree characters
 */
const renderBlock = (input: {
  block: SlowtestBlock;
  prefix: string;
  isLast: boolean;
}): string[] => {
  const lines: string[] = [];
  const duration = formatDuration({ ms: input.block.duration });

  // tree branch characters
  const branch = input.isLast ? '└── ' : '├── ';
  const childPrefix = input.prefix + (input.isLast ? '    ' : '│   ');

  // render block line with type and name
  const blockLine = `${input.prefix}${branch}${input.block.type}: ${input.block.name}`;
  const durationPad = Math.max(0, 60 - blockLine.length);
  lines.push(`${blockLine}${' '.repeat(durationPad)}${duration}`);

  // collect children (hooks indicator, nested blocks, tests)
  const children: Array<{ type: 'hook' | 'block' | 'test'; data: unknown }> =
    [];

  if (input.block.hookDuration > 0) {
    children.push({ type: 'hook', data: input.block.hookDuration });
  }
  if (input.block.blocks) {
    for (const childBlock of input.block.blocks) {
      children.push({ type: 'block', data: childBlock });
    }
  }
  if (input.block.tests) {
    for (const test of input.block.tests) {
      children.push({ type: 'test', data: test });
    }
  }

  // render children with proper tree structure
  children.forEach((child, index) => {
    const isLastChild = index === children.length - 1;
    const childBranch = isLastChild ? '└── ' : '├── ';

    if (child.type === 'hook') {
      const hookDuration = formatDuration({ ms: child.data as number });
      lines.push(`${childPrefix}${childBranch}(hooks: ${hookDuration})`);
    }

    if (child.type === 'block') {
      lines.push(
        ...renderBlock({
          block: child.data as SlowtestBlock,
          prefix: childPrefix,
          isLast: isLastChild,
        }),
      );
    }

    if (child.type === 'test') {
      const test = child.data as { name: string; duration: number };
      const testDuration = formatDuration({ ms: test.duration });
      const testLine = `${childPrefix}${childBranch}${test.name}`;
      const testPad = Math.max(0, 60 - testLine.length);
      lines.push(`${testLine}${' '.repeat(testPad)}${testDuration}`);
    }
  });

  return lines;
};

/**
 * .what = render file entry with optional hierarchy
 * .why = shows file duration and nested block details
 */
const renderFileEntry = (input: {
  file: SlowtestReport['files'][number];
  showHierarchy: boolean;
}): string[] => {
  const lines: string[] = [];
  const duration = formatDuration({ ms: input.file.duration });
  const slowMarker = input.file.slow ? ' [SLOW]' : '';

  // file path line with snail emoji for slow files
  const prefix = input.file.slow ? '🐌 ' : '';
  const fileLine = `${prefix}${input.file.path}`;
  const filePad = Math.max(0, 60 - fileLine.length);
  lines.push(`${fileLine}${' '.repeat(filePad)}${duration}${slowMarker}`);

  // render hierarchy if present and enabled (indented to align with file name after emoji)
  if (input.showHierarchy && input.file.blocks) {
    const hierarchyPrefix = input.file.slow ? '   ' : ''; // 3 spaces to align with emoji
    input.file.blocks.forEach((block, index) => {
      const isLast = index === input.file.blocks!.length - 1;
      lines.push(...renderBlock({ block, prefix: hierarchyPrefix, isLast }));
    });
  }

  return lines;
};

/**
 * .what = format slowtest report for terminal display
 * .why = provides human-readable slow test visibility
 */
export const formatTerminalReport = (input: {
  report: SlowtestReport;
  config: SlowtestConfig;
}): string => {
  const lines: string[] = [];

  // header
  lines.push('');
  lines.push('slowtest report:');
  lines.push('-'.repeat(70));

  // filter to slow files only, sorted by duration (slowest first)
  const slowFiles = [...input.report.files]
    .filter((f) => f.slow)
    .sort((a, b) => b.duration - a.duration);

  // apply top limit if configured
  const limitedFiles = input.config.top
    ? slowFiles.slice(0, input.config.top)
    : slowFiles;

  // render each slow file with hierarchy
  for (const file of limitedFiles) {
    const fileLines = renderFileEntry({ file, showHierarchy: true });
    lines.push(...fileLines);
    lines.push(''); // blank line between files
  }

  // summary
  lines.push('-'.repeat(70));
  const totalDuration = formatDuration({ ms: input.report.summary.total });
  lines.push(`total: ${totalDuration}`);
  lines.push(`files: ${input.report.summary.files}`);

  if (input.report.summary.slow > 0) {
    lines.push(`slow: ${input.report.summary.slow} file(s) above threshold`);
  }

  // tip if top was applied
  if (input.config.top && slowFiles.length > input.config.top) {
    lines.push(
      `(shows ${input.config.top} of ${slowFiles.length} slow files, use 'top' to adjust)`,
    );
  }

  lines.push('');

  return lines.join('\n');
};
