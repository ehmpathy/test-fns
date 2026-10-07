# F13 — the attempt primitives stay in `repeatably/`

## .the fork

- (a) `getOneAttemptOutcome`, `getOneTestBudget` (+ `TIMEOUT_MAX_MS`), `reportAttemptWithheld`,
  `setAttemptFailed` stay in `src/domain.operations/repeatably/`
- (b) lift them to a neighbor folder, or hide them behind one new seam

## .taken — (a)

`repeatably/` is the folder for the repeatable-attempt feature as a whole, not for snapshot
keys alone. every primitive in it serves one concern: an attempt of a `repeatably` block.
`usePrep.ts` and `givenWhenThen.ts` are the two entry points of that feature (the setup hook
and the test body), so their imports reach the feature's own folder, not a foreign domain.
`rule.prefer.most-common-denominator` lifts an operation when a second, unrelated domain reuses
it; no such domain exists.

the drift risk the reviewer named is closed at its cause: `setAttemptFailed` now holds the one
rule for "mark failed, keep the first error, judge final", and both entry points call it.

## .rework

clean — a folder move plus import paths.

## .confidence — 80%

the placement is a taste call; a reviewer who reads `repeatably/` as "snapshot keys only" would
lift them.
