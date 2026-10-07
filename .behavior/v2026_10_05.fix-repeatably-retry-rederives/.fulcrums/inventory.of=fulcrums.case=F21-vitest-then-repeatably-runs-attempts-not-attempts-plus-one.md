# F21 — vitest `then.repeatably` SOME runs `attempts` times, not `attempts + 1`

## .the fork

on `main`, vitest `then.repeatably({ attempts: 3, criteria: 'SOME' })` passes
`{ retry: 3 }`. vitest `retry` counts retries, so the body may run 4 times; jest runs 3. the
`{ attempt }` handed to the body came from a `beforeEach` counter that every test in the outer
describe bumps.

- (a) fix it here: `{ retry: attempts - 1 }`, attempt read from `task.result.retryCount + 1`
- (b) defer to its own issue (the prior call, as a dream)

## .taken — (a)

- the readme promises "`attempts`: how many times to run the test", with no runner caveat;
  jest keeps that promise, vitest broke it. this aligns vitest with the documented contract
- this wish already rewires `then.repeatably` SOME on vitest (`withAttemptWithheldReport`), so
  the fix lands in a file the change opens anyway — clean
- two reviewers (i006 enroll-impl-behavior-intent point 1, enroll-impl-arch-defects open item)
  asked it be either fixed or ruled; the fix costs one line
- clamp: acceptance `[case27] vitest, a then.repeatably that never passes` expects 3 drives and
  attempt numbers 1..3; proven red with the old `retry` (4 drives)

## .the effect a consumer sees

a vitest body that passed only on its 4th try under `attempts: 3` now fails. that body had
exceeded its own declared budget; the release note names it.

## .rework

clean — one line in `setThenRepeatablySomeViaNativeRetry`. to revert, restore `retry: attempts`.

## .for the wisher

if you prefer to keep vitest's extra run until a separate release, say so and the line reverts.

## .confidence — 85%

## .verdict

ruled by wisher 2026-10-07: (a). keep the fix; the readme note names the effect.
