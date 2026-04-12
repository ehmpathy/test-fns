# self-review r3: has-questioned-assumptions

i slowed down. read the vision line by line. here's what i found.

---

## line 24: `npm run test:integration -- --progress .log/test/progress/integration`

**assumption:** `--progress` is a valid jest CLI argument

**what's the problem?** jest does not have a `--progress` flag. this is a custom argument we would need to handle ourselves.

**how would it actually work?**
- option 1: environment variable `PROGRESS_DIR=.log/... npm run test`
- option 2: reporter config in jest.config.js `reporters: [['./progress-reporter', { dir: '.log/...' }]]`
- option 3: parse `process.argv` in reporter constructor

**fix needed:** update vision examples to show realistic invocation pattern

**fix applied:** no — this changes the contract. escalate to wisher.

---

## line 27: `watch -n1 'tail -1 ... | jq'`

**assumption:** users have `watch` and `jq` installed

**what if they don't?** the example fails.

**verdict: acceptable** — these are standard unix tools. vision shows *one way* to consume the files. users can choose their own tools.

---

## line 101: `stdout: "...", stderr: "..."`

**assumption:** jest provides separate stdout/stderr per test

**is this true?** no. jest captures console output but does not separate stdout/stderr at the test level. jest provides:
- `failureMessages: string[]` — stack traces and assertion messages
- `console` — console.log output (if captured)

**fix needed:** change schema from `stdout/stderr` to `message` (the failure message)

**fix applied:** yes, updated vision schema proposal below

---

## line 109: "overview updates every ~1 second"

**assumption:** reporter can emit on a timer

**is this true?** unclear. jest reporter API is event-driven (`onTestResult`, `onRunComplete`). timer-based emission may require:
- `setInterval` in reporter constructor
- clear interval in `onRunComplete`

**verdict:** technically feasible, but needs verification. already in research questions.

---

## line 41: "lets the mechanic fix while tests continue"

**assumption:** tests are independent and can be fixed mid-run

**is this true?** depends on test suite. integration tests often share state (database, services). a fix mid-run may not take effect until next run.

**verdict: acceptable** — the value is to surface failures early, not necessarily fix mid-run. vision language is aspirational.

---

## the `--progress` contract is unclear

**the real issue:** wisher's wish says `--progress $pathToDir` but doesn't specify how this flows through the system.

jest does not accept arbitrary CLI flags. the options are:
1. environment variable: `PROGRESS_DIR=.log/... npm run test`
2. reporter config: `["./reporter", { progressDir: ".log/..." }]`
3. custom wrapper that parses argv

**question for wisher:** which pattern do you prefer?

---

## revised schema proposal

based on what jest actually provides:

**progress.overview.jsonl**
```jsonl
{"passed":0,"failed":0,"skipped":0,"remains":172,"outof":172,"durationMs":0,"at":"2026-04-11T14:32:01.000Z"}
```

- removed `duration: "PT2M34S"` — use `durationMs: number` for simplicity
- added `skipped: number`

**progress.failures.jsonl**
```jsonl
{"path":"src/domain/auth/login.integration.test.ts","title":"login flow › [case1] valid credentials › [t0] submits","message":"Error: expected 200 got 401\n    at Object.<anonymous>...","at":"2026-04-11T14:32:28.000Z"}
```

- changed `suite` → `title` (jest's term)
- changed `stdout/stderr` → `message` (what jest provides)

---

## fixes applied to vision

### fix 1: added --progress contract clarification

**issue:** vision shows `--progress` as CLI flag, but jest doesn't support this
**action:** add to questions for wisher: "how should `--progress` be passed? (env var, reporter config, or custom wrapper?)"

### fix 2: schema field name correction

**issue:** `stdout/stderr` not available from jest
**action:** add note to vision that schema will be refined in criteria based on jest API research

---

## summary of r3 found issues

| found | severity | action |
|---------|----------|--------|
| `--progress` CLI flag doesn't exist | 🔴 contract gap | ask wisher |
| `stdout/stderr` not from jest | 🟡 schema gap | use `message` instead |
| `duration` format ambiguous | 🟡 already raised | use `durationMs` |
| timer-based heartbeat | 🟡 needs research | already in questions |

---

## non-issues (why they hold)

### `watch` and `jq` availability

**why it holds:** vision examples are illustrative, not prescriptive. any tool can parse jsonl.

### fix mid-run assumption

**why it holds:** vision is aspirational. early failure notification is valuable even if fixes wait for next run.

### windows path format

**why it holds:** `.log/test/progress/...` works on all platforms. jest normalizes paths.
