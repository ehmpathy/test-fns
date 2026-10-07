# F6 — absorb every failure kind in a non-final SOME attempt, not only snapshots

## .the fork

- (a) fix only what the wish names: re-derive (B1) and the snapshot key + withhold (B2–B6)
- (b) fix the general cause: a non-final `SOME` attempt absorbs every failure jest would record
  against it — throw, suppressed snapshot mismatch, timeout, hook failure

## .the evidence that raised it

the dispatcher, 2026-10-05: *"when its when.repeatably, and ANY of the attempts timeout, they all
fail"*. measured in this repo the same day (scratch probe, removed):

- `useThen` over the jest timeout on attempt 1 → 2 drives, attempt 2 passes, file **red**
- `useBeforeAll` throws on attempt 1 → 1 setup, attempts 2–3 skip, file **red**

and in `ehmpathy/rhachet-roles-bhrain` (`howto.deflake-live-brain-tests.md`, pr #567): both shapes
reddened its integration suite, and it moved to `jest.retryTimes(2)`.

## .taken — (b)

all three share one cause — the wrapper absorbs only what a `then` body throws — and one place to
fix it. under (a) the dispatcher's own case stays red, and the consumer that left for
`jest.retryTimes` has no reason to come back.

## .rework

clean — the timeout race and the `usePrep` catch are additive, inside the wrapper and the hook. to
drop them is to delete two blocks and two bars (B7, B8).

## .confidence — 85%

the scope widens past the wish's text, though not past its stated outcome (*"a test file passes when
a later attempt passes after an earlier one failed"*). the open part is how the wrapper reads the
test budget per runner (vision open question 8).

## .verdict — ruled 2026-10-05

the wisher chose (b): *"this is the point to solve"* — a non-final `SOME` attempt must absorb a
timeout, a `useBeforeAll` setup failure, and a snapshot mismatch alike. B7 and B8 are bars of this
change. (a) is closed.
confirmed by the wisher, 2026-10-05: *"all in one"* — one change, no split.