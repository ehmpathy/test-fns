# self-review r2: has-questioned-assumptions

deeper dive — assumptions r1 may have missed.

## assumption: `duration` vs `IsoTimeStamp`

**the issue:** wisher said `duration: IsoTimeStamp` but I wrote `duration: "PT2M34S"`

**what's the difference?**
- `IsoTimeStamp` = `2026-04-11T14:32:01.000Z` (a point in time)
- `PT2M34S` = ISO 8601 duration (an interval)

**what did wisher mean?** unclear. "duration: IsoTimeStamp" is contradictory — duration is not a timestamp.

**fix applied:** added to open questions. need wisher clarification.

**potential resolution:** wisher may have meant:
- `startedAt: IsoTimeStamp` (when run started) + compute duration from `at - startedAt`
- or just use milliseconds integer for simplicity

## assumption: `remains` excludes skipped tests

**what did we assume?** `remains = outof - passed - failed`

**what if skipped?** jest has `skipped` and `todo` states. these are not passed, not failed.

**should `remains` include skipped?** unclear.

**fix needed:** add `skipped` to schema, or clarify with wisher.

**updated schema proposal:**
```jsonl
{"passed":45,"failed":1,"skipped":3,"remains":123,"outof":172,...}
```

## assumption: heartbeat is time-based (~1s)

**what did we assume?** reporter emits overview every ~1 second

**what's the problem?** jest reporter API provides hooks like `onTestResult`, `onRunComplete` — these are event-driven, not time-driven.

**what if opposite?** heartbeat on every test completion, not on timer.

**implications:**
- if tests take 30s each, no update for 30s
- if tests complete fast, many updates per second

**verdict: needs research** — check if jest supports timer-based callbacks or if we need our own interval

## assumption: `--progress` flag is parsed by our code

**what did we assume?** user passes `--progress path` and our reporter reads it

**what's the problem?** jest does NOT have a `--progress` CLI flag. jest does not accept arbitrary CLI flags.

**this is a contract gap.** the vision shows:
```bash
npm run test:integration -- --progress .log/test/progress/integration
```

but this would fail — jest would reject `--progress` as unknown option.

**actual options:**
1. environment variable: `PROGRESS_DIR=.log/... npm run test`
2. reporter config: `["./reporter", { progressDir: ".log/..." }]`
3. custom wrapper that parses argv before jest

**fix applied:** added question 7 to vision: "how should `--progress` be passed?"

**this is the biggest gap found** — the contract example in the vision doesn't work as shown.

## assumption: parallel tests work correctly

**what did we assume?** reporter sees all test events regardless of workers

**what's the problem?** jest runs tests in parallel workers. each worker has its own reporter instance.

**questions:**
- do reporters merge results?
- is there a main reporter that aggregates?
- could we get race conditions on file writes?

**fix needed:** add to external research questions

## assumption: `suite` format

**what did we assume?** `suite` is `"login flow › [case1] valid credentials › [t0] submits"`

**what's the problem?** this assumes jest's default test title format. but:
- nested describes create `parent › child › test`
- user may have different nested structure
- format depends on jest config

**verdict: reasonable** — jest's format is consistent. document as implementation detail.

## assumption: `stdout`/`stderr` are separate fields

**what did we assume?** failures have `stdout` and `stderr` fields

**what's the problem?** jest does NOT provide separate stdout/stderr per test. jest provides:
- `failureMessages: string[]` — formatted error messages with stack traces
- `console` output — only if captured, not per-test

**the vision schema shows:**
```jsonl
{"path":"...","suite":"...","stdout":"...","stderr":"Error: ..."}
```

**but jest provides:**
```ts
interface TestResult {
  failureMessages: string[];  // not stdout/stderr
  // ...
}
```

**fix needed:** change schema to use `message` (concatenated failureMessages) instead of stdout/stderr

**fix applied:** added note to vision that schema fields will be refined based on jest API research

## issues found in this review

| issue | severity | action | status |
|-------|----------|--------|--------|
| `--progress` CLI flag doesn't exist | 🔴 contract gap | ask wisher (q7) | ✅ added |
| duration vs timestamp | 🔴 unclear | ask wisher (q6) | ✅ added |
| stdout/stderr not from jest | 🔴 schema gap | use `message` instead | ✅ noted |
| skipped tests absent | 🟡 gap | ask wisher (q5) | ✅ added |
| heartbeat not time-based | 🟡 technical | research jest api | ✅ noted |
| parallel worker behavior | 🟡 technical | research jest api | ✅ noted |

## fixes applied to vision (1.vision.md)

### fix 1: added duration clarification question

**file:** `.behavior/v2026_04_11.progress-reporter/1.vision.md`
**section:** open questions & assumptions > questions for wisher
**added:** question 6: "wisher wrote `duration: IsoTimeStamp` — did you mean iso 8601 duration (`PT2M34S`) or a start timestamp?"

### fix 2: added skipped tests question

**file:** `.behavior/v2026_04_11.progress-reporter/1.vision.md`
**section:** open questions & assumptions > questions for wisher
**added:** question 5: "should overview include `skipped` count? (jest has skipped/todo states beyond pass/fail)"

### fix 3: added technical research items

**file:** `.behavior/v2026_04_11.progress-reporter/1.vision.md`
**section:** open questions & assumptions > external research needed
**added:**
- item 3: "jest reporter config — how does `--progress` CLI arg reach the reporter?"
- item 4: "jest TestResult type — what failure data is available? (`failureMessages` vs `stdout/stderr`)"
- item 5: "timer-based heartbeat — can reporter set interval, or only event-driven callbacks?"

### fix 4: added --progress CLI contract question

**file:** `.behavior/v2026_04_11.progress-reporter/1.vision.md`
**section:** open questions & assumptions > questions for wisher
**added:** question 7: "how should `--progress` be passed? jest doesn't accept custom CLI flags. options: (a) env var, (b) reporter config, (c) custom wrapper"

**why critical:** the vision examples show `npm run test -- --progress path` but jest rejects unknown flags. this is a contract gap that must be resolved.

## non-issues (why they hold)

### `suite` format assumption

**why it holds:** jest's test title format (`describe › describe › test`) is consistent across all jest projects. users cannot change this format via config. the format is jest's internal standard.

### parallel workers assumption

**why it holds as research item:** this is a technical implementation concern, not a vision-level issue. the vision correctly identifies it needs research. parallel execution may require file locking or a single aggregator process — details for blueprint phase.

## next steps

vision is now complete with all gaps documented as open questions.

**critical questions for wisher before proceeding:**
1. question 7: how should `--progress` be passed? (the vision examples don't work as shown)
2. question 6: what did you mean by `duration: IsoTimeStamp`?
3. question 5: should we track skipped tests?

proceed to criteria stone after wisher answers these.
