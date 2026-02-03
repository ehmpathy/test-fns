import type {
  SlowtestBlock,
  SlowtestTest,
} from '@src/domain.objects/SlowtestBlock';

import { computeHookDuration } from './computeHookDuration';

/**
 * .what = flat test result from jest/vitest
 * .why = common interface for hierarchy reconstruction
 */
export interface FlatTestResult {
  /** ancestor titles from describe blocks (e.g., ["given: x", "when: y"]) */
  ancestorTitles: string[];

  /** test title (e.g., "then: z" or "it should work") */
  title: string;

  /** test duration in ms */
  duration: number;
}

/**
 * .what = parse block type and name from title
 * .why = extracts "given:", "when:", "describe:" prefix
 */
export const parseBlockTitle = (input: {
  title: string;
}): { type: 'given' | 'when' | 'describe'; name: string } => {
  const title = input.title.trim();

  // check for given: prefix
  if (title.toLowerCase().startsWith('given:')) {
    return { type: 'given', name: title.slice(6).trim() };
  }

  // check for when: prefix
  if (title.toLowerCase().startsWith('when:')) {
    return { type: 'when', name: title.slice(5).trim() };
  }

  // fallback to describe for other blocks
  return { type: 'describe', name: title };
};

/**
 * .what = check if title is a test (then block)
 * .why = distinguishes leaf tests from describe blocks
 */
export const isTestTitle = (input: { title: string }): boolean => {
  const title = input.title.trim().toLowerCase();
  return title.startsWith('then:') || title.startsWith('it ');
};

/**
 * intermediate node for tree construction
 */
interface TreeNode {
  type: 'given' | 'when' | 'describe';
  name: string;
  duration: number;
  children: Map<string, TreeNode>;
  tests: SlowtestTest[];
}

/**
 * .what = reconstruct nested block hierarchy from flat test results
 * .why = jest and vitest provide flat results; we need hierarchy for report
 */
export const buildBlockHierarchy = (input: {
  tests: FlatTestResult[];
}): SlowtestBlock[] => {
  // root container for top-level blocks
  const root: Map<string, TreeNode> = new Map();

  // build tree from flat results
  for (const test of input.tests) {
    let currentLevel = root;
    let currentNode: TreeNode | undefined;

    // traverse/create ancestor path
    for (const ancestorTitle of test.ancestorTitles) {
      const parsed = parseBlockTitle({ title: ancestorTitle });
      const key = ancestorTitle;

      if (!currentLevel.has(key)) {
        currentLevel.set(key, {
          type: parsed.type,
          name: parsed.name,
          duration: 0,
          children: new Map(),
          tests: [],
        });
      }

      currentNode = currentLevel.get(key)!;
      currentLevel = currentNode.children;
    }

    // add test to leaf node
    if (currentNode) {
      currentNode.tests.push({
        name: test.title,
        duration: test.duration,
      });
    }
  }

  // convert tree to SlowtestBlock array, compute durations bottom-up
  const convertNode = (node: TreeNode): SlowtestBlock => {
    const childBlocks = Array.from(node.children.values()).map(convertNode);
    const testDurations = node.tests.map((t) => t.duration);
    const childBlockDurations = childBlocks.map((b) => b.duration);
    const allChildDurations = [...testDurations, ...childBlockDurations];

    // total duration is sum of all children (tests + nested blocks)
    const totalDuration = allChildDurations.reduce((a, b) => a + b, 0);

    // if node has explicit duration, use it; otherwise use computed
    const duration = node.duration > 0 ? node.duration : totalDuration;

    const hookDuration = computeHookDuration({
      blockDuration: duration,
      childDurations: allChildDurations,
    });

    const block: SlowtestBlock = {
      type: node.type,
      name: node.name,
      duration,
      hookDuration,
    };

    if (childBlocks.length > 0) {
      block.blocks = childBlocks;
    }

    if (node.tests.length > 0) {
      block.tests = node.tests;
    }

    return block;
  };

  return Array.from(root.values()).map(convertNode);
};

/**
 * .what = enrich hierarchy with actual block durations from reporter
 * .why = jest provides per-describe durations we can use instead of summed
 */
export const enrichBlockDurations = (input: {
  blocks: SlowtestBlock[];
  durations: Map<string, number>;
}): SlowtestBlock[] => {
  const enrich = (block: SlowtestBlock, path: string[]): SlowtestBlock => {
    const currentPath = [...path, block.name];
    const key = currentPath.join(' > ');
    const reportedDuration = input.durations.get(key);

    const enrichedBlocks = block.blocks?.map((b) => enrich(b, currentPath));
    const childDurations = [
      ...(block.tests?.map((t) => t.duration) ?? []),
      ...(enrichedBlocks?.map((b) => b.duration) ?? []),
    ];

    const duration = reportedDuration ?? block.duration;
    const hookDuration = computeHookDuration({
      blockDuration: duration,
      childDurations,
    });

    return {
      ...block,
      duration,
      hookDuration,
      blocks: enrichedBlocks,
    };
  };

  return input.blocks.map((b) => enrich(b, []));
};
