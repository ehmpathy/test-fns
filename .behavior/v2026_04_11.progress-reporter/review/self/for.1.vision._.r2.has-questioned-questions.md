# self-review: has-questioned-questions

triage of all open questions in the vision.

---

## questions for wisher — triage

### q1: `--progress auto` vs explicit path

**triage:** [wisher]

**why:** this is a UX decision. only wisher knows if they prefer explicit paths or magic defaults.

### q2: truncate stdout/stderr if huge?

**triage:** [answered]

**answer:** yes, truncate to 10kb per failure.

**why:**
- prevents bloat in failures.jsonl
- most errors are readable in first 10kb
- user can always re-run single test for full output
- reasonable default; user can configure if needed

### q3: test names in overview?

**triage:** [answered]

**answer:** no, just counts.

**why:**
- wisher's schema shows `{ passed, failed, remains, outof }` — no test names
- to add test names would require different format (which test is current?)
- counts are simpler and sufficient for progress checks
- names appear in failures.jsonl when needed

### q4: progress.summary.json at end?

**triage:** [wisher]

**why:** nice-to-have feature. wisher should decide if final summary is valuable vs just read last line of overview.jsonl.

### q5: include skipped count?

**triage:** [answered]

**answer:** yes, include `skipped` in overview.

**why:**
- jest provides skipped/todo counts
- completeness: `passed + failed + skipped + remains = outof`
- no extra cost to include
- helps users understand test coverage

### q6: duration format clarification

**triage:** [wisher]

**why:** wisher wrote "duration: IsoTimeStamp" which is contradictory. need clarification:
- did you mean ISO 8601 duration (`PT2M34S`)?
- or milliseconds integer (`154000`)?
- or start timestamp to compute from?

### q7: how to pass `--progress`?

**triage:** [wisher]

**why:** critical contract decision. jest doesn't accept custom CLI flags. wisher must choose:
- (a) env var: `PROGRESS_DIR=.log/... npm run test`
- (b) reporter config: `["./reporter", { dir: ".log/..." }]`
- (c) custom wrapper binary

---

## external research — triage

### r1: jest custom reporter API

**triage:** [research]

**why:** need to understand hooks: `onTestResult`, `onRunComplete`, constructor args.

### r2: jest parallel execution

**triage:** [research]

**why:** need to understand if reporter runs per-worker or single main process.

### r3: jest reporter config

**triage:** [research] — related to q7

**why:** need to understand how reporter receives config options.

### r4: jest TestResult type

**triage:** [research]

**why:** need to understand what data is available for failures (`failureMessages` vs captured output).

### r5: timer-based heartbeat

**triage:** [research]

**why:** need to verify if we can use `setInterval` in reporter or if purely event-driven.

---

## summary

| question | triage | notes |
|----------|--------|-------|
| q1: auto vs path | [wisher] | ux decision |
| q2: truncate output | [answered] | yes, 10kb |
| q3: test names in overview | [answered] | no, counts only |
| q4: summary.json | [wisher] | nice to have |
| q5: skipped count | [answered] | yes, include |
| q6: duration format | [wisher] | need clarification |
| q7: how to pass --progress | [wisher] | critical contract |
| r1-r5 | [research] | jest api details |

---

## fixes applied to vision

### fix 1: updated questions with triage markers

questions 2, 3, 5 can be answered now — marked as [answered] in vision.

questions 1, 4, 6, 7 require wisher input — marked as [wisher] in vision.

research items already marked as [research].
