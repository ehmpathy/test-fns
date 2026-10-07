# F16 — `getOneAttemptOutcome` stays one `get` compute leaf

## .the fork

`getOneAttemptOutcome` runs a body against a budget and returns `{ error }`:

- (a) one leaf, named as a `get` compute-subtype
- (b) split into a pure race transformer plus a `get*` orchestrator; rename
  `getAllSuppressedErrorsSince` to an `as*`

## .taken — (a)

the reviewer grants the `get` compute name is defensible (`rule.require.get-set-gen-verbs`:
"deterministic derivation stays a get compute-subtype"). the race IS the operation: a timer and
a body, one `Promise.race`. split it and the "pure" half still needs the timer, so naught pure is
left to extract.

`getAllSuppressedErrorsSince` reads the runner's live suppressed list from an index — a
retrieval of extant state, so `get*` fits; `as*` is for a shape cast of a value in hand.

## .rework

clean — both are leaves with one caller each.

## .confidence — 80%
