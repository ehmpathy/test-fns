import { given, then, when } from '@src/contract';

import {
  buildBlockHierarchy,
  type FlatTestResult,
  parseBlockTitle,
} from './buildBlockHierarchy';

describe('parseBlockTitle', () => {
  given('[case1] title with given: prefix', () => {
    when('[t0] parse is called', () => {
      then('returns type=given and name without prefix', () => {
        const result = parseBlockTitle({
          title: 'given: [case1] some scenario',
        });
        expect(result.type).toEqual('given');
        expect(result.name).toEqual('[case1] some scenario');
      });
    });
  });

  given('[case2] title with when: prefix', () => {
    when('[t0] parse is called', () => {
      then('returns type=when and name without prefix', () => {
        const result = parseBlockTitle({ title: 'when: [t0] action occurs' });
        expect(result.type).toEqual('when');
        expect(result.name).toEqual('[t0] action occurs');
      });
    });
  });

  given('[case3] title without bdd prefix', () => {
    when('[t0] parse is called', () => {
      then('returns type=describe and full name', () => {
        const result = parseBlockTitle({ title: 'my test suite' });
        expect(result.type).toEqual('describe');
        expect(result.name).toEqual('my test suite');
      });
    });
  });

  given('[case4] case-insensitive prefix', () => {
    when('[t0] parse is called', () => {
      then('handles uppercase prefixes', () => {
        const result = parseBlockTitle({ title: 'GIVEN: uppercase' });
        expect(result.type).toEqual('given');
        expect(result.name).toEqual('uppercase');
      });
    });
  });
});

describe('buildBlockHierarchy', () => {
  given('[case1] flat tests with given/when/then structure', () => {
    const flatTests: FlatTestResult[] = [
      {
        ancestorTitles: ['given: [case1] scenario', 'when: [t0] action'],
        title: 'then: expected outcome',
        duration: 100,
      },
      {
        ancestorTitles: ['given: [case1] scenario', 'when: [t0] action'],
        title: 'then: another outcome',
        duration: 50,
      },
    ];

    when('[t0] build is called', () => {
      then('returns nested hierarchy', () => {
        const result = buildBlockHierarchy({ tests: flatTests });

        expect(result).toHaveLength(1);
        expect(result[0]!.type).toEqual('given');
        expect(result[0]!.name).toEqual('[case1] scenario');
        expect(result[0]!.blocks).toHaveLength(1);

        const whenBlock = result[0]!.blocks![0]!;
        expect(whenBlock.type).toEqual('when');
        expect(whenBlock.name).toEqual('[t0] action');
        expect(whenBlock.tests).toHaveLength(2);
      });

      then('computes durations from tests', () => {
        const result = buildBlockHierarchy({ tests: flatTests });

        const whenBlock = result[0]!.blocks![0]!;
        expect(whenBlock.duration).toEqual(150); // 100 + 50

        expect(result[0]!.duration).toEqual(150);
      });
    });
  });

  given('[case2] multiple given blocks', () => {
    const flatTests: FlatTestResult[] = [
      {
        ancestorTitles: ['given: [case1] first'],
        title: 'then: test a',
        duration: 100,
      },
      {
        ancestorTitles: ['given: [case2] second'],
        title: 'then: test b',
        duration: 200,
      },
    ];

    when('[t0] build is called', () => {
      then('returns separate top-level blocks', () => {
        const result = buildBlockHierarchy({ tests: flatTests });

        expect(result).toHaveLength(2);
        expect(result[0]!.name).toEqual('[case1] first');
        expect(result[1]!.name).toEqual('[case2] second');
      });
    });
  });

  given('[case3] nested given inside given', () => {
    const flatTests: FlatTestResult[] = [
      {
        ancestorTitles: [
          'given: [case1] outer',
          'given: [case1.1] inner',
          'when: [t0] action',
        ],
        title: 'then: outcome',
        duration: 75,
      },
    ];

    when('[t0] build is called', () => {
      then('preserves full hierarchy', () => {
        const result = buildBlockHierarchy({ tests: flatTests });

        expect(result).toHaveLength(1);
        expect(result[0]!.type).toEqual('given');
        expect(result[0]!.blocks).toHaveLength(1);

        const innerGiven = result[0]!.blocks![0]!;
        expect(innerGiven.type).toEqual('given');
        expect(innerGiven.name).toEqual('[case1.1] inner');
        expect(innerGiven.blocks).toHaveLength(1);

        const whenBlock = innerGiven.blocks![0]!;
        expect(whenBlock.type).toEqual('when');
      });
    });
  });

  given('[case4] plain describe blocks (no bdd)', () => {
    const flatTests: FlatTestResult[] = [
      {
        ancestorTitles: ['my suite', 'nested suite'],
        title: 'it works',
        duration: 50,
      },
    ];

    when('[t0] build is called', () => {
      then('marks them as describe type', () => {
        const result = buildBlockHierarchy({ tests: flatTests });

        expect(result[0]!.type).toEqual('describe');
        expect(result[0]!.name).toEqual('my suite');
        expect(result[0]!.blocks![0]!.type).toEqual('describe');
      });
    });
  });

  given('[case5] empty tests array', () => {
    when('[t0] build is called', () => {
      then('returns empty array', () => {
        const result = buildBlockHierarchy({ tests: [] });
        expect(result).toEqual([]);
      });
    });
  });

  given('[case6] tests with hooks (inferred)', () => {
    const flatTests: FlatTestResult[] = [
      {
        ancestorTitles: ['given: [case1] scenario', 'when: [t0] action'],
        title: 'then: test 1',
        duration: 50,
      },
      {
        ancestorTitles: ['given: [case1] scenario', 'when: [t0] action'],
        title: 'then: test 2',
        duration: 50,
      },
    ];

    when('[t0] build is called', () => {
      then(
        'hookDuration is 0 when block duration equals sum of children',
        () => {
          const result = buildBlockHierarchy({ tests: flatTests });

          const whenBlock = result[0]!.blocks![0]!;
          // duration = 100 (sum of tests), hookDuration = 0 (no extra time)
          expect(whenBlock.duration).toEqual(100);
          expect(whenBlock.hookDuration).toEqual(0);
        },
      );
    });
  });
});
