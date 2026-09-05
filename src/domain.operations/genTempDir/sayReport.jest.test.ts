/**
 * .what = clamps the ONE invariant every message in this behavior inherits: a report
 *         block is closed by a blank line, so two that stack are never read as one
 * .why = 🔴 a snapshot alone has no teeth on a developer machine — jest rewrites a
 *        changed snapshot in place and reports green (proven in
 *        `autoprune.messages.integration.jest.test.ts`'s own note). so the separator
 *        that repairs this defect would be silently un-repaired by the next
 *        `--resnap`, and every render would agree with the regression.
 *
 *        this is the assertion that bites on both machines. it is a UNIT test because
 *        `sayReport` crosses no boundary but the console — the invariant is a property
 *        of the render, never of the filesystem
 *
 * .note = the defect this guards is not per-message: repair it at ONE emission site and
 *         it stays open at the next. so the clamp is on the shared emitter rather than
 *         on any one message — a per-message clamp would have the same reach as a
 *         per-message fix, which does not hold
 */
import { given, then, when } from '@src/contract';

import { sayReport } from './sayReport';

/** captures console.error across one act, then restores it */
const getAllChunksSpoken = (act: () => void): string[] => {
  const chunks: string[] = [];
  const errorBefore = console.error;
  console.error = (...args: unknown[]): void => {
    chunks.push(args.map(String).join(' '));
  };
  try {
    act();
  } finally {
    console.error = errorBefore;
  }
  return chunks;
};

/**
 * .what = the text a TERMINAL receives — every chunk plus the newline console.error
 *         writes after it
 * .why = the invariant is about what a human SEES, so it must be asserted on the
 *        stream a human sees, never on the argument we passed
 */
const asTerminalText = (chunks: string[]): string =>
  chunks.map((chunk) => `${chunk}\n`).join('');

describe('sayReport', () => {
  given('[case1] one report', () => {
    when('[t0] it is said', () => {
      const text = asTerminalText(
        getAllChunksSpoken(() =>
          sayReport({ lines: ['🧹 test-fns: a header.', '   └─ fix: a fix.'] }),
        ),
      );

      then(
        'the block ends with a BLANK line, never flush with its last line',
        () => {
          // .why = the block must be separated from EVERYTHING after it — a peer
          //        report, the runner's summary, a stack trace. it earns that by
          //        closure, so it needs no knowledge of what follows
          expect(text).toEqual('🧹 test-fns: a header.\n   └─ fix: a fix.\n\n');
        },
      );

      then('it does NOT open with a blank line', () => {
        // .why = a blank at the TOP would separate this block from its predecessor
        //        and leave its own last line flush with whatever came next — the
        //        asymmetry is the whole point, so it is asserted rather than assumed
        expect(text.startsWith('\n')).toEqual(false);
      });
    });
  });

  given('[case2] two independent reports, in one pass', () => {
    // .why = 🔴 the real shape of the defect. up to four reports fire within a single
    //        gate pass, and each header restarts at column 0 — so with no separator
    //        the first block's `fix:` line reads as though it belongs to the second
    //        header, and once a path wraps a reader cannot tell the two blocks apart
    when('[t0] they stack', () => {
      const text = asTerminalText(
        getAllChunksSpoken(() => {
          sayReport({ lines: ['🧹 test-fns: the first.', '   └─ fix: one.'] });
          sayReport({ lines: ['🧹 test-fns: the second.', '   └─ fix: two.'] });
        }),
      );

      then('🔴 a blank line sits between them', () => {
        expect(text).toEqual(
          [
            '🧹 test-fns: the first.',
            '   └─ fix: one.',
            '',
            '🧹 test-fns: the second.',
            '   └─ fix: two.',
            '',
            '',
          ].join('\n'),
        );
      });

      then('🔴 no header ever follows a fix line directly', () => {
        // .why = the property stated as the human would state it, so it survives a
        //        reword of either message. this is the exact two-line adjacency the
        //        peer reviewer quoted from the [case11] snapshot
        expect(text).not.toMatch(/^.*fix:.*\n🧹/m);
      });
    });
  });
});
