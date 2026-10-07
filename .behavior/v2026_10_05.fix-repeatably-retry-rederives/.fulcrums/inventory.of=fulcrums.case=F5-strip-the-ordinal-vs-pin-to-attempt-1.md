# F5 — strip the ordinal, or pin every attempt to the `attempt 1` key

## .the fork

- (a) **strip** — the key carries no ordinal (`... when: x then: y 1`). the wish's B2 asks this
  verbatim ("zero hits for `attempt [0-9]`") and B6 plans the migration for it.
- (b) **pin** — every attempt computes the `attempt 1` key (`... when: x, attempt 1 then: y 1`).
  extant `SOME` baselines are all `attempt 1` (the #71 census: 18 of 18), so they stay valid with
  **zero resnap**. only `EVERY` consumers who wrote `attempt 2`/`attempt 3` keys see obsolete keys.

## .the evidence that makes this a real fork

any key change orphans the old keys, and an orphan fails the run outside `-u`:
`@jest/core/build/index.js:1091` — `snapshot.failure = !updateAll && (unchecked || unmatched ||
filesRemoved)`; `:1162` folds it into `success`; `jest-circus/build/runner.js:130` counts unchecked
keys per file. so (a) forces every consumer with a repeatable snapshot to resnap once; (b) forces it
only on `EVERY` consumers with ordinal-2+ keys.

## .taken — (a), because the wish names it

the wish states B2 and B6 outright; the wisher weighed the migration and chose it. (a) also keeps
the key honest — under (b) a key reads `attempt 1` while attempt 3 asserted against it.

## .rework

clean — one function computes the key; (a) → (b) swaps a strip for a replace, and drops the
rename hint.

## .confidence — 60%

(b) saves every `SOME` consumer a forced resnap and a red ci on upgrade, which is most consumers.
the wisher may not have seen that the pin exists. this is the fulcrum to put first at the council.

## .verdict — ruled 2026-10-05

the wisher chose (a): strip the ordinal from the key. every consumer with a repeatable snapshot
resnaps once with `-u`, guided by the migration note and the rename hint. (b) is closed.