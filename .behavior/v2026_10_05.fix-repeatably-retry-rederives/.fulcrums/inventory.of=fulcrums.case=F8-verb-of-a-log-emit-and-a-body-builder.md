# F8 — the verbs of a log emit (`report*`) and a body builder (`gen*`)

## .the fork

- (a) `reportAttemptWithheld` + `genRepeatableTestBody`
- (b) force the get/set/gen/del set: `setAttemptWithheldLog`, `getOneRepeatableTestBody`

## .taken — (a)

- `reportAttemptWithheld` mutates no state and returns naught. it emits one console line.
  `rule.require.get-set-gen-verbs` exempts imperative action commands
  (`dispatchTask`, `enqueueTask`); an emit is one. `set*` would claim a state write that
  never happens; `get*` would claim a return
- `genRepeatableTestBody` constructs a new closure per call — the rule's `gen` subtype
  "construct: build with generated id" (`genTask`). the repo already names its builders
  this way (`genTempDir`, `genFixtureDir`)

## .rework

clean — a rename of two symbols inside `src/domain.operations/repeatably/`, no public api.

## .confidence — 80%

the exemption clause names commands by example, not by a closed list; a reviewer may read it
narrower. the rename is cheap if the council rules (b).
