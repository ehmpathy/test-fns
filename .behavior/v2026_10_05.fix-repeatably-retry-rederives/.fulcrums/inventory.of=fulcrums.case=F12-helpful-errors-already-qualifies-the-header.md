# F12 — `helpful-errors` already writes the qualified error header

## .the fork

- (a) throw `MalfunctionError` / `ConstraintError` with a plain message
- (b) also prefix each message by hand with `💥 MalfunctionError:`

## .taken — (a)

`helpful-errors` prefixes the glyph and the class itself. the committed snapshots show it:

```
💥 MalfunctionError: repeatably: could not read the test timeout budget from the runner
✋ ConstraintError: exceeded the 20ms budget (the test timeout)
```

(`repeatably/__snapshots__/getOneTestBudget.integration.jest.test.ts.snap`,
`getOneAttemptOutcome.jest.test.ts.snap`). a hand prefix would print the header twice.
`rule.require.qualified-error-headers` says, for typescript: *"throw the class"*.

## .rework

clean.

## .confidence — 98%

measured by snapshot.
