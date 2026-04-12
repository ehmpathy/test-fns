# self-review: has-questioned-assumptions

## assumption: jsonl format

**what did we assume?** that jsonl (one json object per line) is the output format

**what did wisher actually say?** showed `{ passed: number, failed: number, ... }` examples

**evidence?** the curly brace syntax strongly suggests json. wisher's use case mentions "programatically" access — jsonl fits.

**what if opposite?** could use csv, plain text, or sqlite. but wisher showed json shapes.

**verdict: reasonable inference** — wisher's examples clearly show json objects

## assumption: ~1s heartbeat interval

**what did we assume?** emit overview every ~1 second

**what did wisher actually say?** "once per second maybe?"

**evidence?** the "maybe?" indicates uncertainty. wisher wanted real-time feel but wasn't prescriptive.

**what if opposite?** could emit every 5s (less i/o), or on every test completion (event-driven).

**verdict: escalate as open question** — added to vision as question for wisher

## assumption: iso 8601 duration format (PT2M34S)

**what did we assume?** duration uses `PT2M34S` format

**what did wisher actually say?** "duration: IsoTimeStamp"

**evidence?** "IsoTimeStamp" is ambiguous. could mean:
- timestamp (`2026-04-11T14:32:01.000Z`) — but that's not a duration
- duration (`PT2M34S`) — iso 8601 duration format

**what if opposite?** milliseconds integer (`154000`). simpler to compute with.

**verdict: clarify with wisher** — iso 8601 duration is more human-readable, but wisher may have meant something else

## assumption: reporter creates directory if absent

**what did we assume?** if `--progress .log/test/progress/foo` doesn't exist, create it

**what did wisher actually say?** no specification on this behavior

**evidence?** common ux pattern — create parent dirs automatically

**what if opposite?** fail if dir doesn't exist. forces user to create it first.

**verdict: reasonable default** — fail-fast on absent dir would be annoying. create is safer.

## assumption: append to files, don't overwrite

**what did we assume?** new runs append to files rather than truncate

**what did wisher actually say?** no specification on this behavior

**evidence?** jsonl is designed for append. enables "resume" use case.

**what if opposite?** truncate on new run. cleaner for single-run analysis.

**verdict: needs clarification** — could go either way. added to vision as design decision.

**fix applied:** vision already documents this in "pit of success" section

## assumption: `at` timestamp in every line

**what did we assume?** every line includes `at: "2026-04-11T14:32:01.000Z"`

**what did wisher actually say?** no timestamps mentioned in schema

**evidence?** timestamps are critical for debug and correlation

**what if opposite?** no timestamp. simpler schema, but loses temporal context.

**verdict: reasonable addition** — timestamps add value, minimal overhead

## assumption: jest reporter implementation

**what did we assume?** this is a jest custom reporter

**what did wisher actually say?** "invoke our custom reporter"

**evidence?** test-fns is a jest helper library. context suggests jest.

**what if opposite?** could be vitest, mocha, or framework-agnostic

**verdict: reasonable inference** — test-fns uses jest. check repo to confirm.

## summary

| assumption | verdict | action |
|------------|---------|--------|
| jsonl format | ✅ reasonable | wisher showed json shapes |
| ~1s heartbeat | ⚠️ uncertain | escalate to wisher |
| iso 8601 duration | ⚠️ ambiguous | clarify PT vs timestamp |
| create directory | ✅ reasonable | standard ux pattern |
| append vs truncate | ⚠️ unclear | added to vision questions |
| `at` timestamp | ✅ reasonable | adds debug value |
| jest reporter | ✅ reasonable | verify with codebase |

three assumptions need wisher input. others are reasonable inferences.
