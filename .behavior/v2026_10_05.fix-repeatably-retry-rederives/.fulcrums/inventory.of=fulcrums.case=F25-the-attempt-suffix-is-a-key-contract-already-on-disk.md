# F25 — the `, attempt N` suffix stays a literal at each site

## .the fork

the suffix `, attempt N` is written at three registration sites and matched by one regex in
`isSnapshotKeyRenamed`.

- (a) leave each site its literal
- (b) one module that exports the format and the pattern

## .taken — (a)

- the suffix is a contract already on disk: it lives in every consumer's test report, and in
  every pre-#71 snapshot file `isSnapshotKeyRenamed` must still recognize. it cannot change
  without another forced resnap, so a shared constant guards no drift that could ship
- the reader and the writers mean different things: the writers render THIS attempt; the
  reader matches ANY attempt of a stale baseline. one export for both would be two concepts
  under one name
- drift is caught today: acceptance case6 (a legacy baseline) fails if the reader and the
  writers disagree

## .rework

clean — a later extraction touches four lines.

## .confidence — 80%
