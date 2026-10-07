# F9 — read runner internals in one reader each, not inject them

## .the fork

- (a) `getOneTestBudget` and `getOneExpectSnapshotState` read `globalThis` themselves
- (b) the caller injects an accessor (`context.getBudget`, the expect state)

## .taken — (a)

the runner is the ambient process: jest and vitest inject their globals, and the test body
runs inside them. no caller above the test body holds these values — the caller would read
the same globals one frame earlier. (b) moves the read; the tie to the runner stays.

each reader is a communicator: it owns the one boundary to the runner internal, narrows each
field (never casts), and fails loud with `MalfunctionError` when a field moves (vision I4).
the pure work downstream already takes the read state as input (`setSnapshotCounterRebased`,
`setSnapshotTallyRestored`, `isSnapshotKeyRenamed` — each unit-tested with a demo state).

the I4 path is clamped by `getOneTestBudget.integration.jest.test.ts` (vitest read under jest).

## .rework

clean — add an optional accessor param later if a second caller appears.

## .confidence — 85%
