# F26 — a jest timeout ghost's late snapshot mismatch ships as a known, dreamed gap

## .the fork

a SOME attempt that overruns its budget cannot cancel its body. on jest, a late
`toMatchSnapshot()` mismatch from that ghost appends to the file-global suppressed list, and
the next attempt counts it as its own — a clean attempt can be withheld.

- (a) ship with the gap named; record it as a dream
- (b) fix it here

## .taken — (a)

- the root fix is a cancellable body; js has none
- a filter over jest's suppressed list needs per-call attribution jest does not expose, and it
  changes which mismatches fail a file — not safe as a ride-along
- the failure direction is a false RED (a clean attempt withheld, or an extra end-of-file
  count), never a false green; the final attempt still decides
- the readme already names the timeout ghost ("keep a retried body idempotent"); this sharpens
  the case it covers

dream: `.dream/2026_10_06.jest-timeout-ghost-can-leak-into-next-attempt-snapshot-tally.dream.md`.

## .for the wisher

a reviewer asks for a conscious sign-off, as for F17 / F18.

## .rework

dirty — attribution reaches into how jest records a mismatch.

## .confidence — 80%
