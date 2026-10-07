# F1 — #71's D1 is a blind wrapper, not a memo

## .the fork

- (a) take #71 at its word: `useThen` memoizes across attempts → add a re-derive mode to `useThen`
- (b) the measured cause: the jest `SOME` wrapper cannot see a snapshot mismatch, so it marks a red
  attempt as passed and skips the rest — which reads as "one drive, re-asserted"

## .taken — (b), and why at the time

a scratch probe in this repo (2026-10-05, jest 30.2.0) measured:

- factory under `SOME`, 3 attempts, each assertion fails → **3** invocations (B1 already holds)
- fail-then-pass factory under `SOME` → **green** (B4 already holds)
- pass-then-fail under `EVERY` → **red** (B5 holds; D3 is not a defect)
- drifted snapshot at attempt 1 under `SOME` → attempt 1 **✕**, attempt 2 printed
  `🫧 [skipped] prior repeatably attempt passed`, factory count **1**, no `attempt 2` key written

mechanism: `jest-snapshot/build/index.js:1535-1537` calls `context.dontThrow()`; the failure goes to
`expect.getState().suppressedErrors`, which `jest-circus/build/jestAdapterInit.js:2036-2042` attaches
to the test after it ends. the wrapper's `try/catch` (`givenWhenThen.ts:445-461`) never sees it.

the consumer log's 128 ms / 13 ms "drives" are skip markers, not memo hits.

## .rework

clean — the wish's outcome ("re-runs its factory once per attempt") is met by (b); no `useThen`
contract change. if the wisher wants (a) as well, it is additive.

## .confidence — 95%

measured, not inferred. residual 5%: the consumer may also have a memo of its own; that is theirs.

## .where

`1.vision.yield.md` § groundwork.
