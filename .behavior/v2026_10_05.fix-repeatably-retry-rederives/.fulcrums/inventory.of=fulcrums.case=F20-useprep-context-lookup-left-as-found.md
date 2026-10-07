# F20 — `usePrep`'s path-walk context lookup is left as found

## .the fork

`then()` reads its repeatable context once, at registration. `usePrep()` reads
`findRepeatableContext(path) ?? ctxAtRegistration` — a registry path-walk with a fallback.

- (a) leave both as on `main`
- (b) collapse to one resolution primitive, and drop the registry walk if it never disagrees

## .taken — (a)

- both reads are on `main`; this change adds `setAttemptTracked`, which writes the same
  registry entry the walk reads, at the same moment as before
- the reviewer grants that by construction the two reads agree; then the walk is redundant,
  not wrong — its removal is a cleanup, not a fix for #71
- the 327 acceptance tests, `useBeforeAll` + `useBeforeEach` inside SOME among them, pass
  through the walk today

## .rework

clean — one call site; the registry has one writer.

## .confidence — 80%
