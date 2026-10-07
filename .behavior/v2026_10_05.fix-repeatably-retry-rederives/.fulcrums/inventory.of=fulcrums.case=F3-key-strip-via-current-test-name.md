# F3 — strip the ordinal from the key, keep it in the report

## .the fork

- (a) the report keeps `, attempt N` (a human reads which attempt ran); only the snapshot key loses
  it — jest: `expect.setState({ currentTestName })` at test start; vitest: its equivalent hook
- (b) drop `, attempt N` from the describe/test names entirely — key and report both lose it

## .taken — (a)

the report line `when: x, attempt 2` is how a human sees a retry happened. (b) would hide it.

## .rework

clean — if vitest offers no key hook, fall back to (b) for vitest alone.

## .confidence — 75%

jest's `_toMatchSnapshot` reads `context.currentTestName` (`jest-snapshot/build/index.js:1544`), set
from expect state — verified. vitest builds the name from the task chain
(`getNames(test).slice(1).join(" > ")`, `vitest/dist/chunks/vi.2VT5v0um.js:187-191`), so (a)'s
"vitest: its equivalent hook" does not exist. the vitest half needs a different lever — a suite-task
rename at run time, a snapshot hint, or (b) for vitest alone. owed to the blueprint (yield open
question 4).
