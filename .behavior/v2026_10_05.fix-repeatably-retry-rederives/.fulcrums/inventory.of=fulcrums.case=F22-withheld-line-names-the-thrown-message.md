# F22 — the withheld line names the thrown error's own message, not its cause chain

## .the fork

a withheld attempt logs one line: the first non-blank line of `error.message`. for a wrapped
error (helpful-errors `.wrap`, `{ cause }`), that names the wrapper.

- (a) name the thrown error's message, as is
- (b) walk `error.cause` and name the root

## .taken — (a)

- the withheld line is a pointer, not the report: the final attempt, or the run's own failure
  output, prints the full error with its cause chain
- the thrown message is what the consumer's own code chose to say; a wrapper message such as
  `invoice.send.error: <cause message>` already carries the cause text by helpful-errors
  convention
- to walk `cause` would make the one line name an error the consumer never threw at that
  site — a second surprise to read
- the reviewer (i006 ergo-friction-hazards blocker.1) wrote: "the message is actionable enough
  for the common cases; no change requested here"

## .rework

clean — `asFirstLine` in `reportAttemptWithheld.ts`.

## .confidence — 85%
