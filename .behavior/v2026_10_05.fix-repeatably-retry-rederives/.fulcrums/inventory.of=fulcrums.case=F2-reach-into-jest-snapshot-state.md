# F2 — reach into jest snapshot state

## .the fork

- (a) read + reset jest internals per attempt: `expect.getState().suppressedErrors`,
  `snapshotState._counters` (delete the stripped name), `snapshotState.unmatched` (restore on withhold)
- (b) route jest `SOME` through `jest.retryTimes`, whose `test_retry` handler calls
  `snapshotState.clear()` — rejected earlier in this repo for global pollution (`givenWhenThen.ts:514`),
  and `clear()` wipes the whole file's state, not one test's
- (c) forbid `toMatchSnapshot` inside a repeatable block — fails the wish

## .taken — (a)

`suppressedErrors` and `setState` are public on `expect`. `_counters` and `unmatched` are fields of
`SnapshotState`, verified in jest 29.7.0 (github source) and 30.2.0 (installed). jest-circus sets
`currentTestName` at `test_start` and drains `suppressedErrors` at `test_done`
(`jestAdapterInit.js:2001-2044`), so a wrapper inside the test body can read, clear, and override
both. fail-fast if the shape is absent, so a future jest breaks loud, never silent.

## .rework

clean — contained in the jest branch of one wrapper.

## .confidence — 80%

the low part: `_counters` is underscore-private, and `suppressedErrors` on jest 29 is unverified.
