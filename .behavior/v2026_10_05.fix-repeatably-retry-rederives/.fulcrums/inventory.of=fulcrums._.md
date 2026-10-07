# inventory.of=fulcrums

| case | title | rework | status | confidence |
|---|---|---|---|---|
| F1-d1-is-a-blind-wrapper-not-a-memo | #71's D1 re-diagnosed: the SOME wrapper is blind to jest's suppressed snapshot errors; useThen never memoizes | clean | best-guessed | 95% |
| F2-reach-into-jest-snapshot-state | the fix reads + resets jest internals (`suppressedErrors`, `snapshotState._counters`, `.unmatched`) | clean | best-guessed | 80% |
| F3-key-strip-via-current-test-name | strip the ordinal from the snapshot KEY only; the reported test name keeps `attempt N` | clean | best-guessed | 75% |
| F5-strip-the-ordinal-vs-pin-to-attempt-1 | strip the key ordinal (wish B2) vs pin all attempts to the `attempt 1` key (zero resnap for every SOME consumer) | clean | ruled by wisher 2026-10-05: strip the ordinal | 100% |
| F6-absorb-every-failure-kind-not-only-snapshots | a non-final SOME attempt absorbs timeouts and hook failures too, not only snapshot mismatches — the dispatcher's case | clean | ruled by wisher 2026-10-05: (b), all three failure kinds are the point to solve | 100% |
| F4-release-as-fix-not-major | ship as `fix` with a migration note, not a major | clean | ruled by wisher 2026-10-05: `fix` | 100% |
| F7-runner-state-mutation-is-the-lever | write into the runner's live state (suppressed list, unmatched, task names, error message), each write noted | clean | best-guessed; disputes arch-hazards blocker.1, blocker.3 | 95% |
| F8-verb-of-a-log-emit-and-a-body-builder | keep `reportAttemptWithheld` (imperative emit) and `genRepeatableTestBody` (construct) | clean | best-guessed; disputes arch-opport blocker.1, nitpick.1 | 80% |
| F9-read-runner-internals-where-they-live | read runner globals in one narrowed reader each, not via an injected accessor | clean | best-guessed; disputes arch-opport nitpick.2, nitpick.3 | 85% |
| F10-shared-shapes-beside-their-reader | runner-state shapes and `TIMEOUT_MAX_MS` stay beside their reader | clean | best-guessed; disputes arch-hazards nitpick.1, nitpick.2, arch-opport nitpick.5 | 80% |
| F11-prior-shapes-left-as-found | prior shapes the diff touches but does not author stay as on `main` | clean | best-guessed; disputes arch-hazards nitpick.3, nitpick.6, arch-opport nitpick.4 | 85% |
| F12-helpful-errors-already-qualifies-the-header | no hand prefix: `helpful-errors` writes `💥 MalfunctionError:` itself | clean | best-guessed; disputes mech-failhides blocker.1 | 98% |
| F13-attempt-primitives-stay-in-repeatably | the attempt primitives stay in `repeatably/`, the feature's own folder | clean | best-guessed; disputes enroll-impl-arch-defects nitpick 3 | 80% |
| F14-first-error-of-the-block-is-the-final-report | the final attempt rethrows the block's first error for every test, as shipped on main | clean | best-guessed; answers enroll-impl-behavior-intent i003 point 3 | 85% |
| F15-consumer-names-the-caller-human-names-the-reader | "consumer" = the caller package, "human" = the log reader; two referents, two words | clean | best-guessed; disputes ergo-friction-hazards i005 nitpick.7 | 85% |
| F16-attempt-outcome-is-a-get-compute | `getOneAttemptOutcome` stays one `get` compute leaf; the race is the operation | clean | best-guessed; disputes arch-opport i005 nitpick.2 | 80% |
| F17-nested-some-in-some-is-out-of-scope | a SOME block nested in a SOME block collapses the outer retry; prior to #71, dreamed | dirty | best-guessed; disputes enroll-impl-behavior-intent i005 point 3 | 85% |
| F18-vitest-esm-import-gap-ships-as-known | vitest esm drops `useThen` / `useBeforeAll`; prior to #71, dreamed — wisher sign-off asked | dirty | ruled by wisher 2026-10-07: ship as a documented gap; fix in its own change | 100% |
| F19-cross-kind-final-attempt-stays-itemized | throw-then-mismatch on the final attempt stays an itemized alterpath (cell 20) | clean | best-guessed; disputes enroll-impl-behavior-intent i005 point 6 | 85% |
| F20-useprep-context-lookup-left-as-found | `usePrep`'s registry path-walk + fallback stays as on main | clean | best-guessed; disputes enroll-impl-arch-defects i005 point 2, i006 nitpick.2 | 80% |
| F21-vitest-then-repeatably-runs-attempts-not-attempts-plus-one | vitest `then.repeatably` SOME now runs `attempts` times (was `attempts + 1`), attempt read from the runner — fixed here | clean | ruled by wisher 2026-10-07: keep the fix | 100% |
| F22-withheld-line-names-the-thrown-message | the withheld line names the thrown error's own message, not its cause chain | clean | best-guessed; disputes ergo-friction-hazards i006 blocker.1 | 85% |
| F23-private-operations-stay-beside-their-sole-reader | `isSnapshotKeyRenamed`'s two private transformers stay in its file | clean | best-guessed; disputes arch-smell-scopeleaks i006 nitpick.4 | 85% |
| F24-a-per-attempt-closure-is-not-a-procedure-decoration | `withAttemptWithheldReport` wraps the consumer's body at registration, no `_body` export | clean | best-guessed; disputes arch-hazards-behavior i006 nitpick.3 | 80% |
| F26-jest-timeout-ghost-snapshot-leak-ships-as-known | a timed-out jest attempt's late snapshot mismatch can land in the next attempt's tally; dreamed — wisher sign-off asked | dirty | best-guessed; awaits wisher; disputes enroll-impl-arch-defects i007 nitpick.1 | 80% |
| F27-usethen-primitive-result-guard-deferred | a primitive `useThen` result snapshots char-indexed in plain js; the fail-loud guard predates #71 and is unsafe as a ride-along — dreamed | clean | ruled by wisher 2026-10-07: defer to its own release | 100% |
| F25-the-attempt-suffix-is-a-key-contract-already-on-disk | `, attempt N` stays a literal at each site; it is a key contract already on disk | clean | best-guessed; disputes enroll-impl-arch-defects i006 nitpick.1 | 80% |
