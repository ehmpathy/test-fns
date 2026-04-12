# self-review r3: has-questioned-questions

i checked the extant codebase. found `SlowtestReporterJest.ts` — an extant jest reporter in this repo. this answers most research questions.

---

## research questions — answered from codebase

### r1: jest custom reporter API

**triage changed:** [research] → [answered from codebase]

**source:** `src/domain.operations/slowtestReporter/reporter/SlowtestReporterJest.ts`

**answer:**
```ts
class SlowtestReporterJest implements Reporter {
  onRunStart(_results, _options): void {}
  onTestFileResult(_test, testResult, _aggregatedResult): void {}
  onTestFileStart(_test): void {}
  onTestCaseResult(_test, _testCaseResult): void {}
  async onRunComplete(_testContexts, results): Promise<void> {}
  getLastError(): Error | undefined { return undefined; }
}
```

key hooks for progress reporter:
- `onRunStart` — emit initial overview (all remains)
- `onTestFileResult` — update counts after each file, emit failure if any
- `onRunComplete` — emit final overview

### r2: jest parallel execution

**triage changed:** [research] → [answered from codebase]

**answer:** reporters run in the **main process** and receive aggregated results from workers. `onTestFileResult` is called once per file, regardless of which worker ran it.

**evidence:** `SlowtestReporterJest` uses `this.files.push()` to collect results — this works because all callbacks run in the same process.

### r3: jest reporter config

**triage changed:** [research] → [answered from codebase]

**source:** `src/contract/slowtest.reporter.jest.ts`

**answer:**
```ts
// jest.config.ts
reporters: [
  'default',
  ['test-fns/slowtest.reporter.jest', { slow: '3s', output: '.slowtest/report.json' }]
]
```

config passed via `options` parameter in constructor:
```ts
constructor(_globalConfig: Config.GlobalConfig, options?: SlowtestConfig) {
  this.config = options ?? {};
}
```

**this answers question 7!** the pattern is: reporter config in jest.config.js, not CLI flag.

### r4: jest TestResult type

**triage changed:** [research] → [answered from codebase]

**source:** `SlowtestReporterJest.ts` lines 64-75

**answer:**
```ts
interface TestResult {
  testFilePath: string;
  perfStats: { start: number; end: number };
  testResults: Array<{
    ancestorTitles: string[];
    title: string;
    duration: number | null;
    status: 'passed' | 'failed' | 'skipped' | 'pending' | 'todo';
    failureMessages: string[];  // <-- this is what we use for failures
  }>;
}
```

**this answers the stdout/stderr question!** use `failureMessages`, not stdout/stderr.

### r5: timer-based heartbeat

**triage:** [answered via logic]

**answer:** yes, we can use `setInterval` in `onRunStart` and clear it in `onRunComplete`.

```ts
onRunStart() {
  this.heartbeatInterval = setInterval(() => this.emitOverview(), 1000);
}
onRunComplete() {
  clearInterval(this.heartbeatInterval);
}
```

---

## questions for wisher — updated triage

### q7 is now answerable

**original:** how should `--progress` be passed?

**answer from codebase:** use reporter config pattern, same as slowtest:

```ts
// jest.config.ts
reporters: [
  'default',
  ['test-fns/progress.reporter.jest', { dir: '.log/test/progress/integration' }]
]
```

**triage changed:** [wisher] → [answered from codebase]

**remaining wisher questions:**
- q1: auto vs explicit path — UX preference
- q4: summary.json at end — nice to have
- q6: duration format — clarification needed

---

## fixes applied to vision (with file references)

### fix 1: answer q7 in vision

**file:** `.behavior/v2026_04_11.progress-reporter/1.vision.md`
**section:** open questions & assumptions > questions for wisher > q7
**before:** `[wisher] how should --progress be passed?`
**after:** `[answered: reporter config] ... use reporter config in jest.config.js`

**how fixed:** edited 1.vision.md to update q7 triage from [wisher] to [answered: reporter config], added code example.

### fix 2: update research items

**file:** `.behavior/v2026_04_11.progress-reporter/1.vision.md`
**section:** open questions & assumptions > external research needed
**before:** all items marked [research]
**after:** all items marked [answered: extant ...] with source references

**how fixed:** edited 1.vision.md to update r1-r5 triage, added source file references for each.

### fix 3: schema refinement noted

**what:** failures should use `failureMessages` field, not stdout/stderr
**where noted:** this review file, section r4
**vision update:** schema will be refined in criteria stone; noted here for reference

---

## summary

| item | old triage | new triage | source |
|------|------------|------------|--------|
| r1: reporter API | [research] | [answered] | SlowtestReporterJest.ts |
| r2: parallel exec | [research] | [answered] | SlowtestReporterJest.ts |
| r3: reporter config | [research] | [answered] | slowtest.reporter.jest.ts |
| r4: TestResult type | [research] | [answered] | SlowtestReporterJest.ts |
| r5: timer heartbeat | [research] | [answered] | logic |
| q7: how pass config | [wisher] | [answered] | reporter config pattern |

all research questions answered from extant codebase. only 3 wisher questions remain.

---

## non-issues (why they hold)

### remaining wisher questions (q1, q4, q6)

**why they hold as [wisher]:**
- q1 (auto vs path): UX preference — cannot be answered without wisher input
- q4 (summary.json): feature preference — cannot be answered without wisher input
- q6 (duration format): clarification needed — wisher used contradictory term "duration: IsoTimeStamp"

these are not answerable via logic or extant code. they require wisher decision.

### research items fully resolved

**why resolved:** all 5 research items were answerable from extant `SlowtestReporterJest.ts` and `slowtest.reporter.jest.ts`. no external research needed — pattern already established in this repo.
