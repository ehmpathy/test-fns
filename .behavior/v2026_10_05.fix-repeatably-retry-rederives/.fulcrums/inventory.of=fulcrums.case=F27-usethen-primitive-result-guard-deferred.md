# F27 — a fail-loud guard for a primitive `useThen` result is deferred, dreamed

## .the fork

the 5.3 walkthrough showed a plain-js `useThen` that returns a string: both runners snapshot it as
a char-indexed object, with no error. the typed contract (`T extends Record<string, any>`) forbids
it; plain js does not.

- (a) defer: catch a dream, ship #71 without it
- (b) fix here: throw a `ConstraintError` when the `useThen` result is not an object

## .taken — (a)

- it predates #71 (`useThen.ts` on `main`) and sits outside the retry semantics the wish names
- the fix is not safe as a ride-along: it turns a silent pass red for every plain-js consumer who
  returns a primitive today, and that deserves its own release note
- a typescript consumer cannot hit it, so the harm is bounded to untyped callers

dream: `.dream/2026_10_06.usethen-primitive-result-snapshots-as-char-index.dream.md`.

## .rework

clean — one guard in `createUseThenProxy` plus a clamp; it ripples into no other file.

## .confidence — 85%

## .verdict

ruled by wisher 2026-10-07: (a). defer; the guard ships in its own release, with its own note.

low only in that a reviewer may judge the bounded harm worth the release-note cost now.
