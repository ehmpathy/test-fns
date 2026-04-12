# self-review r3: has-questioned-deletables

try hard to delete before you optimize.

---

## feature traceability

| feature | traces to | verdict |
|---------|-----------|---------|
| progress.overview.jsonl | vision: "progress.overview.jsonl with heartbeat ~1s" | ✅ keep |
| progress.failures.jsonl | vision: "progress.failures.jsonl with path, suite, failure, stdout, stderr" | ✅ keep |
| progress.summary.json | vision: answered yes to "emit progress.summary.json at end" | ✅ keep |
| heartbeat interval 1000ms | vision: "heartbeat every ~1s" | ✅ keep |
| counts (passed, failed, skipped, remains, outof) | vision: explicit counts in output format | ✅ keep |
| ISO 8601 duration | vision: answered "PT2M34S" format | ✅ keep |
| console separation (stdout/stderr) | vision: "stdout = console.log, stderr = console.warn/error" | ✅ keep |
| truncation to 10kb | vision: answered "yes, 10kb max" | ✅ keep |
| dir config option | vision: reporter config with dir option | ✅ keep |
| directory creation | vision: "create directory if absent" | ✅ keep |

**conclusion:** all features trace to vision. none deletable.

---

## component deletion analysis

| component | can delete? | rationale |
|-----------|-------------|-----------|
| ProgressConfig.ts | no | config interface needed for type safety |
| ProgressReporterJest.ts | no | main reporter implementation |
| emitProgressFiles.ts | no | file operations, avoids duplication |
| asProgressOverviewLine.ts | no | transformer separates format from orchestrator |
| asProgressFailureLine.ts | no | transformer separates format from orchestrator |
| asIsoDurationWords.ts | no | transformer separates iso-time usage from orchestrator |
| progress.reporter.jest.ts (contract) | no | package entry point |
| package.json exports | no | required for import path |

### fix applied: delete progressReporter.ts barrel

**issue:** blueprint includes `[+] progressReporter.ts — barrel export for types`

**question:** can this be deleted?

**analysis:**
- rule.forbid.barrel-exports says barrel exports are forbidden
- the contract file (progress.reporter.jest.ts) already exports the types users need
- ProgressConfig type exports from the contract
- no other types need external exposure
- internal types can be imported directly from source files

**verdict:** delete. the barrel adds no value and violates rule.forbid.barrel-exports.

**fix:** removed `progressReporter.ts` from filediff tree in blueprint.

---

## simplification analysis

| component | simplest version? | rationale |
|-----------|-------------------|-----------|
| asIsoDurationWords | maybe merge into asProgressOverviewLine? | no — keeps iso-time dependency isolated |
| emitProgressFiles | single file or split functions? | single file correct — related functions |
| transformer structure | three separate files? | yes — each has distinct responsibility |

**conclusion:** component structure is already minimal.

---

## summary

| category | count |
|----------|-------|
| features questioned | 10 |
| features deleted | 0 |
| components questioned | 8 |
| components deleted | 1 (progressReporter.ts barrel) |

---

## non-issues

### three separate transformers

**questioned:** could merge asIsoDurationWords into asProgressOverviewLine

**why it holds:** asIsoDurationWords isolates the iso-time dependency. if iso-time API changes, only one file changes. also enables separate unit tests for duration format.

### separate emitProgressFiles

**questioned:** could inline file operations into reporter

**why it holds:** follows pattern from extant emitJsonReport.ts in slowtest reporter. separates i/o concerns from orchestration. enables future reuse.

