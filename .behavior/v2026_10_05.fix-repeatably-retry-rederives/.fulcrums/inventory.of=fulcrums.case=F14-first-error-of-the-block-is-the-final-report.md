# F14 — the first error of the block is the final report, for every test in it

## .the fork

on the final `SOME` attempt, a test that fails rethrows:

- (a) the first error of ANY attempt of the block (`ctx.anyError`, block-level) — as shipped
- (b) the first error of THIS test across attempts, a per-test record

## .taken — (a)

`anyError` lives on the block's shared `RepeatableState` on `main` (`givenWhenThen.ts`, the
`state` literal in `given.repeatably` / `when.repeatably`), and case23 clamps it: "the final
failure rethrows the first error of any attempt". this change keeps that contract and extends
it to setup hooks (`setAttemptFailed`); it does not widen it.

the block is the unit of retry, so the block's first cause is the most useful single report:
under a `useThen` cascade, the dependent `then`s fail only because the factory failed, so a
per-test record would report the cascade echo, not the cause.

## .rework

clean — `setAttemptFailed` is the one place the record is kept; a per-test key there is local.

## .confidence — 85%

a reviewer flagged that a dependent `then` with an unrelated live failure would report the
block's first cause instead. true, and it is the shipped contract; a change belongs in its own
issue, not inside this fix.
