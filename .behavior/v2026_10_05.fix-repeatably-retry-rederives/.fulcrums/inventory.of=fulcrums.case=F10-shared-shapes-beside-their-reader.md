# F10 — shared runner shapes and the timeout constant live beside their reader

## .the fork

- (a) `ExpectSnapshotState` sits in `getOneExpectSnapshotState.ts`; `VitestTestContext` and
  `VitestTaskNamed` beside their consumer; `TIMEOUT_MAX_MS` beside `getOneTestBudget`
- (b) move each into its own module, or inline each shape at every call site

## .taken — (a)

- these are not procedure inputs/outputs in the `rule.forbid.io-as-interfaces` sense. they are
  typed slices of a foreign runner's state — the domain shape every repeatably operation reads.
  `ExpectSnapshotState` is consumed by 7 operations; the rule's own exception allows a named
  type at 3+
- inline copies across 7 files would drift from the one reader that narrows them
- `TIMEOUT_MAX_MS` is the other half of the budget contract: the test registers with it so
  the runner's timer never fires, and `getOneTestBudget` supplies the real deadline. the
  `.why` on it says so. a constant is not a second procedure

## .rework

clean — a file move and an import update.

## .confidence — 80%
