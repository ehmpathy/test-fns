# self-review: has-questioned-requirements

## requirement: `--progress $pathToDir`

**who said this?** wisher, in 0.wish.md

**why?** user provides explicit path for progress files

**what if we didn't?** alternative: auto-pick path like `.log/test/progress/`. but explicit path gives user control over where files land. better for different test types (unit vs integration).

**verdict: holds** — explicit path is more flexible, less magic

## requirement: two separate files (overview + failures)

**who said this?** wisher, explicitly requested both files

**why?** different consumers want different things — some watch progress, some watch failures

**what if we didn't?** could merge into single file with type discriminator. but then consumers must filter. separate files = simpler to tail.

**verdict: holds** — separation of concerns, simpler consumers

## requirement: jsonl format

**who said this?** wisher (implied by `{ ... }` examples)

**why?** append-only, streamable, greppable, one jq away from pretty

**what if we didn't?** json array would require read-modify-write. ndjson is the same as jsonl. csv loses structure.

**verdict: holds** — jsonl is the right choice for append-only logs

## requirement: heartbeat ~1s

**who said this?** wisher ("once per second maybe?")

**why?** real-time progress visibility

**what if we didn't?** emit only on test completion. but then no progress until first test finishes (could be 30s for slow tests).

**verdict: holds** — real-time feel requires frequent updates. 1s is a reasonable default.

## requirement: stdout/stderr in failures

**who said this?** wisher (in the failure schema)

**why?** debug failures without need to re-run tests

**what if we didn't?** just log path + suite. but then user has to hunt for output elsewhere.

**concern raised:** large outputs could bloat failures.jsonl. documented as open question for wisher: truncation policy?

**verdict: holds with caveat** — include output, but consider max size

## requirement: duration as IsoTimeStamp

**who said this?** wisher (used "IsoTimeStamp" in schema)

**why?** human-readable when viewed with jq

**what if we didn't?** milliseconds integer. but `PT2M34S` is clearer than `154000`.

**note:** wisher said "IsoTimeStamp" but duration should be ISO 8601 duration format (`PT2M34S`), not timestamp. updated vision to clarify.

**verdict: holds** — ISO duration is readable

## summary

| requirement | verdict | notes |
|-------------|---------|-------|
| `--progress $path` | ✅ holds | explicit > magic |
| two files | ✅ holds | separation of concerns |
| jsonl | ✅ holds | right tool for append logs |
| ~1s heartbeat | ✅ holds | enables real-time feel |
| stdout/stderr | ⚠️ caveat | consider truncation |
| ISO duration | ✅ holds | clarified format |

no requirements need to be removed. one open question escalated: truncation policy for large outputs.
