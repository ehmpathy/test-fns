# F24 — a per-attempt closure is not a procedure decoration

## .the fork

`setThenRepeatablySomeViaNativeRetry` applies `withAttemptWithheldReport` to the consumer's
`fnAttempt`, inline at registration.

- (a) apply the wrapper where the body is registered
- (b) the hook-wrapper pattern: a named `_body` plus a named wrapped export

## .taken — (a)

`rule.require.hook-wrapper-pattern` governs a named, exported procedure whose diff should
stay one line when a hook is added. here the wrapped value is the consumer's test body, built
per registration call; there is no procedure to export, and naught to name — the body is the
consumer's. the wrapper call is already a named line of its own (`const fnReported = ...`).

## .rework

clean — local to one registrar.

## .confidence — 80%
