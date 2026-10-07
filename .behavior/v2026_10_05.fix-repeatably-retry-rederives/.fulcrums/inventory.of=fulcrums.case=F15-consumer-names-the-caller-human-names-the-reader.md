# F15 — "consumer" names the caller; "human" names the reader

## .the fork

doc copy in `setSnapshotErrorsHinted` / `isSnapshotKeyRenamed` says both "consumer" and "human":

- (a) keep both, each for its own referent
- (b) collapse to one word

## .taken — (a)

two referents, two words:

- **consumer** = the package that calls `test-fns` — the repo whose snapshot file holds the old
  key. it is a code role, not a person. the readme and #71 use the same word.
- **human** = the person who reads the log line. `rule.require.term-human` asks for this word
  where a person is meant, and the copy uses it there.

to collapse them to one word would make one word name two concepts — the overload
`rule.require.ubiqlang` forbids.

## .rework

clean — a word swap in two doc headers.

## .confidence — 85%

a reviewer read the two as a mixed vocabulary for one concept. they are two concepts.
