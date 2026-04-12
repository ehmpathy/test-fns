# self-review r8: has-consistent-mechanisms

review for new mechanisms that duplicate extant functionality.

---

## extant mechanisms search

### method

1. grep for "Reporter" in `**/*.ts` → found SlowtestReporterJest, SlowtestReporterVitest
2. grep for "emit|appendFile|writeFile" in slowtestReporter → found emitJsonReport.ts
3. grep for "getDuration|IsoDuration|iso-time" in codebase → found formatTerminalReport.ts
4. read iso-time package exports → found getDuration, asIsoDurationWords

### results

| search | results |
|--------|---------|
| Reporter | SlowtestReporterJest, SlowtestReporterVitest |
| emitJsonReport | slowtestReporter/output/emitJsonReport.ts |
| formatDuration | slowtestReporter/output/formatTerminalReport.ts |
| getDuration | iso-time package |
| asIsoDurationWords | iso-time package |

### key findings

**emitJsonReport.ts** (slowtestReporter/output/):
- uses fs.mkdir with recursive: true (same pattern)
- uses fs.writeFile for single json output
- does NOT use appendFile

**formatTerminalReport.ts** (slowtestReporter/output/):
- has custom `msToShape()` function to convert ms to IsoDurationShape
- uses `asDurationInWords()` for human-readable output ("2 minutes 34 seconds")
- does NOT use iso-time's `getDuration()` (potential tech debt)

**iso-time package**:
- exports `getDuration({ of: { milliseconds } })` → IsoDurationShape
- exports `asIsoDurationWords(shape)` → IsoDurationWords ("PT2M34S")

---

## mechanism comparison

### ProgressReporterJest vs SlowtestReporterJest

| aspect | ProgressReporterJest | SlowtestReporterJest |
|--------|---------------------|---------------------|
| purpose | stream progress to files | aggregate time data |
| outputs | jsonl (stream), json (final) | json (final only) |
| events | uses heartbeat interval | no stream events |
| state | counts, failures | time data |

**verdict:** ✅ distinct. different purposes, different outputs, different event model.

### emitProgressFiles vs emitJsonReport

| aspect | emitProgressFiles | emitJsonReport |
|--------|-------------------|----------------|
| purpose | stream + finalize progress | write single json |
| operations | appendFile (jsonl) + writeFile (json) | writeFile only |
| files | 3 (overview, failures, summary) | 1 (report) |

**verdict:** ✅ distinct. emitProgressFiles uses appendFile for stream output; emitJsonReport uses writeFile for final output.

### asIsoDurationWords vs formatDuration

| aspect | asIsoDurationWords (blueprint) | formatDuration (extant) |
|--------|-------------------------------|------------------------|
| output | ISO 8601 words: "PT2M34S" | human words: "2 minutes 34 seconds" |
| uses | getDuration + asIsoDurationWords from iso-time | custom msToShape + asDurationInWords |
| purpose | machine-readable duration | human-readable duration |

**verdict:** ✅ distinct. different output formats for different consumers.

**observation:** extant formatDuration has custom msToShape that could use getDuration from iso-time. not a concern for this blueprint, but noted for future refactor.

---

## summary

| mechanism | extant equivalent? | verdict |
|-----------|-------------------|---------|
| ProgressReporterJest | SlowtestReporterJest | ✅ distinct (different purpose) |
| emitProgressFiles | emitJsonReport | ✅ distinct (append vs write) |
| asIsoDurationWords | formatDuration | ✅ distinct (machine vs human) |
| asProgressOverviewLine | none | ✅ new (no extant) |
| asProgressFailureLine | none | ✅ new (no extant) |

no duplicate mechanisms. blueprint is consistent with extant patterns.

---

## non-issues

### similar file structure to slowtestReporter

**questioned:** should progressReporter share structure with slowtestReporter?

**why it holds:** the structure is intentionally similar — both are reporters with transform/, output/, reporter/ directories. this is consistency, not duplication. each has distinct implementations within that structure.

### both use fs/promises

**questioned:** should there be a shared file output utility?

**why it holds:** the operations are fundamentally different (append vs write). a shared utility would need to abstract over this difference, which adds complexity without benefit. each module has simple, focused file operations.

