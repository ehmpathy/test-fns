# F7 — write into the runner's live state, rather than a copy

## .the fork

- (a) a withheld attempt, a key strip, and a rename hint write into objects the runner owns:
  `suppressedErrors`, `snapshotState.unmatched`, vitest task names, the error's message
- (b) build new values (a fresh Error, a renamed copy of the task) and hand them back

## .taken — (a), with each write marked `.note = deliberate mutation`

the runner decides its verdict from its own live objects, after the body returns:

- jest fails a test on any entry in `expect.getState().suppressedErrors`, and fails `--ci`
  on `snapshotState.unmatched` — a copy of either is never read
- vitest builds the snapshot key from the live task chain (`getNames(task)`); a renamed
  copy is never consulted, so no key strip happens
- jest prints the message of the error object it holds in its suppressed list; a new Error
  with the hint is never printed

no public api exposes any of these levers (vision I4, F2, F3). (b) does not reach the runner,
so it fixes no part of #71.

## .scope

each write sits in one named operation with the note:
`setSnapshotTallyRestored`, `setSnapshotErrorsHinted`, `setSnapshotKeyStripped`,
`setSnapshotCounterRebased`. the vitest task names are restored after the body, before the
reporter reads them (clamped by unit `setSnapshotKeyStripped`).

## .rework

clean — each write is behind one named operation; a future public api swaps one body.

## .confidence — 95%

the levers are measured in source (yield `.levers`) and proven by acceptance case1, case6, case7.
