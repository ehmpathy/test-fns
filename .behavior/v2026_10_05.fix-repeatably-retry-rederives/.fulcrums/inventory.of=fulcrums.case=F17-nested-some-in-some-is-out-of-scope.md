# F17 — nested SOME-in-SOME stays out of scope

## .the fork

a `given.repeatably(SOME)` that wraps a `when.repeatably(SOME)`: every `then` reports to the
inner state only, so the outer block marks itself passed after its first attempt. outer
`attempts: 3` acts as `attempts: 1`.

- (a) leave it; record it as a dream for its own change
- (b) fix it here — propagate an inner failure to every outer state

## .taken — (a)

- prior to this change: the context stack that shadows the outer state is on `main`, unchanged
- no false green: the inner block's final attempt still reds the file, so no defect ships
- not in #71: the wish names one level of `when.repeatably`; the vision's dimension walk holds
  no nested cell
- (b) changes how often consumer bodies run under nest — a behavior change that needs its own
  wish, not a ride-along

caught as a dream: `.dream/2026_10_06.nested-some-in-some-outer-retry-collapses.dream.md`.

## .rework

dirty — a fix reshapes the context stack every repeatable block reads.

## .confidence — 85%
